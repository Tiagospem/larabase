import { ipcMain } from 'electron';
import { MysqlConnection } from '../../src/types/mysql-connection';
import { createConnection, safeEndConnection } from '../helpers/mysql';
import {
	BASE_COUNT_SQL,
	LIST_TABLES_SQL,
	HAS_FK_USAGE_SQL,
	COLUMN_SQL,
	FK_SQL,
	REFERENCE_CONSTRAINTS_SQL,
	OUTGOING_SQL,
	INCOMING_SQL,
	TABLE_INDEXES_SQL
} from '../helpers/sql';
import {
	DeleteRowsConfig,
	DropTableParams,
	Table,
	TableRecord,
	UpdateTableRecord
} from '../../src/types/table';

function error(type: string, message: string) {
	const base = { success: false, message };
	const map: Record<string, () => any> = {
		tables: () => ({ ...base, tables: [] }),
		count: () => ({ ...base, count: 0 }),
		structure: () => ({ ...base, columns: [] }),
		foreign: () => ({ ...base, foreignKeys: [] }),
		default: () => base
	};

	return (map[type] || map.default)();
}

async function toggleForeignKeyChecks(connection: any, enable: boolean) {
	await connection.query(`SET FOREIGN_KEY_CHECKS = ${enable ? 1 : 0}`);
}

function applySortingAndPagination(
	baseSql: string,
	connection: any,
	config: TableRecord
) {
	let sql = baseSql;

	if (config.sortColumn) {
		const sortCol = connection.escapeId(config.sortColumn);
		const dir = config.sortDirection === 'desc' ? 'DESC' : 'ASC';
		sql += ` ORDER BY ${sortCol} ${dir}`;
	}
	sql += ` LIMIT ? OFFSET ?`;

	return sql;
}

async function getTableStructure(
	connection: any,
	database: string,
	tableName: string
) {
	const [cols] = await connection.query(COLUMN_SQL, [database, tableName]);
	const [fks] = await connection.query(FK_SQL, [database, tableName]);
	const fkSet = new Set(fks.map((f: any) => f.column_name));

	return cols.map((c: any) => ({ ...c, foreign_key: fkSet.has(c.name) }));
}

async function findRestrictingIds(
	connection: any,
	tableName: string,
	ids: (string | number)[]
): Promise<(string | number)[]> {
	const [constraints]: any[] = await connection.query(
		REFERENCE_CONSTRAINTS_SQL,
		[tableName, connection.database]
	);

	const restricts = constraints.filter((c: any) =>
		['RESTRICT', 'NO ACTION'].includes(c.on_delete)
	);

	const problematic: (string | number)[] = [];

	for (const id of ids) {
		for (const { child_table, child_column } of restricts) {
			const sql = `
        SELECT 1
          FROM ${connection.escapeId(child_table)}
         WHERE ${connection.escapeId(child_column)} = ?
         LIMIT 1
      `;
			const [rows]: any[] = await connection.query(sql, [id]);
			if (rows.length) {
				problematic.push(id);
				break;
			}
		}
	}

	return problematic;
}

async function deleteRecords(
	connection: any,
	tableName: string,
	ids: (string | number)[]
): Promise<{ affectedRows: number }> {
	const placeholders = ids.map(() => '?').join(',');
	const sql = `
    DELETE
      FROM ${connection.escapeId(tableName)}
     WHERE id IN (${placeholders})
  `;
	const [result]: any[] = await connection.execute(sql, ids);

	return { affectedRows: result.affectedRows };
}

async function listTablesHandler(_: any, config: MysqlConnection) {
	let connection: any;

	try {
		connection = await createConnection(config);

		const [tables] = await connection.query(LIST_TABLES_SQL, [
			config.database
		]);

		if (tables.length === 0) {
			return { success: true, tables: [] };
		}

		try {
			const [info] = await connection.query(BASE_COUNT_SQL, [
				config.database
			]);
			const counts = Object.fromEntries(
				info.map(({ name, rowCount }: any) => [name, +rowCount || 0])
			);
			tables.forEach((t: any) => {
				t.rowCount = counts[t.name] || 0;
				t.isApproximate = true;
			});
		} catch (e) {
			console.error('Error fetching counts:', e);
			tables.forEach((t: any) => {
				t.rowCount = 0;
				t.isApproximate = true;
			});
		}

		return { success: true, tables };
	} catch (err: any) {
		return error('tables', err.message);
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableRecordCountHandler(
	_: any,
	config: MysqlConnection,
	table: Table
) {
	let connection: any;

	try {
		connection = await createConnection(config);
		const escaped = connection.escapeId(table.name);
		const [rows] = await connection.query(
			`SELECT COUNT(*) AS count FROM ${escaped}`
		);

		return rows.length
			? { success: true, count: rows[0].count || 0, isApproximate: false }
			: error('count', 'Failed to count records');
	} catch (err: any) {
		return error('count', err.message);
	} finally {
		await safeEndConnection(connection);
	}
}

async function dropTablesHandler(_: any, params: DropTableParams) {
	let connection: any;

	try {
		connection = await createConnection(params.dbConnection);
		await connection.query('START TRANSACTION');

		if (params.ignoreForeignKeys) {
			await toggleForeignKeyChecks(connection, false);
		}

		const failed: string[] = [];

		let successCount = 0;

		for (const name of params.tables) {
			try {
				const esc = connection.escapeId(name);
				const cascade = params.cascade ? ' CASCADE' : '';

				await connection.query(`DROP TABLE${cascade} ${esc}`);
				successCount++;
			} catch (e: any) {
				console.error(`Drop failed for ${name}:`, e.message);
				failed.push(name);
			}
		}

		if (params.ignoreForeignKeys) {
			await toggleForeignKeyChecks(connection, true);
		}

		if (failed.length === 0) {
			await connection.query('COMMIT');

			return {
				success: true,
				message: `Dropped ${successCount} tables successfully`
			};
		} else {
			await connection.query('ROLLBACK');

			return {
				success: false,
				message: `Failed to drop tables: ${failed.join(', ')}`
			};
		}
	} catch (err: any) {
		console.error('Error in dropTablesHandler:', err);

		if (connection) {
			try {
				await connection.query('ROLLBACK');
				if (params.ignoreForeignKeys) {
					await toggleForeignKeyChecks(connection, true);
				}
			} catch {}
		}

		return {
			success: false,
			message: err.message || 'Error dropping tables'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function truncateTableHandler(
	_: any,
	config: MysqlConnection,
	tableName: string
) {
	let connection: any;
	let fkDisabled = false;

	try {
		connection = await createConnection(config);

		const [fkRes] = await connection.query(HAS_FK_USAGE_SQL, [
			tableName,
			config.database
		]);

		fkDisabled = fkRes.length > 0;

		await connection.beginTransaction();

		if (fkDisabled) {
			await toggleForeignKeyChecks(connection, false);
		}
		await connection.query(
			`TRUNCATE TABLE ${connection.escapeId(tableName)}`
		);
		if (fkDisabled) {
			await toggleForeignKeyChecks(connection, true);
		}

		await connection.commit();

		return {
			success: true,
			message: `Table ${tableName} truncated successfully`
		};
	} catch (err: any) {
		console.error(`Error truncating ${tableName}:`, err);

		if (connection) {
			await connection.rollback().catch(() => {});

			if (fkDisabled) {
				await toggleForeignKeyChecks(connection, true).catch(() => {});
			}
		}

		return {
			success: false,
			message: err.message || 'Error truncating table'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableRecordsHandler(_: any, config: TableRecord) {
	let connection: any;

	try {
		connection = await createConnection(config.dbConnection);

		const structure = await getTableStructure(
			connection,
			config.dbConnection.database,
			config.tableName
		);

		const tableNameEsc = connection.escapeId(config.tableName);

		let filter = (config.filter || '').trim();

		if (filter.toLowerCase().startsWith('where')) {
			filter = filter.slice(5).trim();
		}

		const page = config.page || 1;
		const limit = Number(config.limit) || 100;
		const offset = (page - 1) * limit;
		const where = filter ? ` WHERE ${filter}` : '';

		const countQuery = `SELECT COUNT(*) AS totalRecords FROM ${tableNameEsc}${where}`;

		try {
			const [countRows] = await connection.query(countQuery);
			const totalRecords = countRows[0]?.totalRecords || 0;

			const baseSql = `SELECT * FROM ${tableNameEsc}${where}`;
			const sql = applySortingAndPagination(baseSql, connection, config);

			const [rows] = await connection.query(sql, [limit, offset]);

			return {
				success: true,
				data: rows,
				totalRecords,
				page,
				limit,
				structure
			};
		} catch (queryError: any) {
			console.error('SQL Error:', queryError);

			if (
				queryError.code === 'ER_PARSE_ERROR' &&
				queryError.sqlMessage.includes('order')
			) {
				return {
					success: false,
					message:
						'SQL syntax error: "order" is a reserved MySQL keyword. Please backtick it as `order` in your filter.',
					data: [],
					totalRecords: 0
				};
			}

			throw queryError;
		}
	} catch (err: any) {
		return {
			success: false,
			message: err.message || 'Error fetching records',
			data: [],
			totalRecords: 0
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableStructureHandler(
	_: any,
	config: MysqlConnection,
	tableName: string
) {
	let connection: any;

	try {
		connection = await createConnection(config);

		const structure = await getTableStructure(
			connection,
			config.database,
			tableName
		);

		return {
			success: true,
			structure
		};
	} catch (err: any) {
		return {
			success: false,
			message: err.message || 'Error fetching records'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableForeignKeysHandler(
	_: any,
	config: MysqlConnection,
	tableName: string
) {
	let connection: any;

	try {
		connection = await createConnection(config);

		const [out] = await connection.query(OUTGOING_SQL, [
			config.database,
			tableName
		]);
		const [inc] = await connection.query(INCOMING_SQL, [
			config.database,
			tableName
		]);

		return {
			success: true,
			foreignKeys: [
				...out.map((fk: any) => ({ ...fk, type: 'outgoing' })),
				...inc.map((fk: any) => ({ ...fk, type: 'incoming' }))
			]
		};
	} catch (err) {
		return error('foreign', err.message || 'Failed to fetch foreign keys');
	} finally {
		await safeEndConnection(connection);
	}
}

async function deleteTableRecordsHandler(
	_: any,
	{
		dbConnection: config,
		tableName,
		ids,
		ignoreForeignKeys
	}: DeleteRowsConfig
) {
	if (!Array.isArray(ids) || ids.length === 0) {
		throw new Error('At least one record ID is required');
	}

	let connection: any;

	try {
		connection = await createConnection(config);

		const valIds = ids.map((id) =>
			typeof id === 'string' && !isNaN(Number(id)) ? Number(id) : id
		);

		if (ignoreForeignKeys) {
			await toggleForeignKeyChecks(connection, false);
		} else {
			const problematic = await findRestrictingIds(
				connection,
				tableName,
				valIds
			);

			if (problematic.length) {
				return {
					success: false,
					message: `Cannot delete records with IDs ${problematic.join(', ')} because they are referenced by other tables`,
					problematicIds: problematic
				};
			}
		}

		const { affectedRows } = await deleteRecords(
			connection,
			tableName,
			valIds
		);

		if (ignoreForeignKeys) {
			await toggleForeignKeyChecks(connection, true);
		}

		return {
			success: true,
			message: `${affectedRows} record(s) deleted successfully`,
			affectedRows
		};
	} catch (err: any) {
		if (err.code === 'ER_ROW_IS_REFERENCED_2') {
			return {
				success: false,
				message:
					'Cannot delete these records because they are referenced by other tables',
				constraintError: true
			};
		}

		return { success: false, message: err.message };
	} finally {
		if (connection) {
			if (ignoreForeignKeys) {
				await toggleForeignKeyChecks(connection, true).catch((e: any) =>
					console.error('Error re-enabling foreign key checks:', e)
				);
			}

			await safeEndConnection(connection);
		}
	}
}

async function updateRecordHandler(_: any, config: UpdateTableRecord) {
	let connection: any;

	try {
		connection = await createConnection(config.dbConnection);

		const { tableName, data, id } = config;

		if (!tableName || !data || !id) {
			return { success: false, message: 'Missing required parameters' };
		}

		const tableNameEsc = connection.escapeId(tableName);

		const { id: _, ...updateData } = data;

		if (Object.keys(updateData).length === 0) {
			return { success: true, message: 'No fields to update' };
		}

		const structure = await getTableStructure(
			connection,
			config.dbConnection.database,
			tableName
		);
		const jsonColumns = structure
			.filter((col: any) => col.type?.toLowerCase().includes('json'))
			.map((col: any) => col.name);

		const processedData = Object.fromEntries(
			Object.entries(updateData).map(([key, value]) => {
				if (jsonColumns.includes(key) && typeof value === 'string') {
					try {
						JSON.parse(value);
						return [key, value];
					} catch (e) {
						return [key, value];
					}
				}
				return [key, value];
			})
		);

		const setClause = Object.entries(processedData)
			.map(([key, _]) => `${connection.escapeId(key)} = ?`)
			.join(', ');

		const sql = `UPDATE ${tableNameEsc} SET ${setClause} WHERE id = ?`;

		const values = [...Object.values(processedData), id];

		const [result] = await connection.execute(sql, values);

		return {
			success: true,
			message: `Record updated successfully`,
			affectedRows: result.affectedRows
		};
	} catch (err: any) {
		console.error('Error updating record:', err);
		return {
			success: false,
			message: err.message || 'Error updating record'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableIndexesHandler(
	_: any,
	config: MysqlConnection,
	tableName: string
) {
	let connection: any;

	try {
		connection = await createConnection(config);

		const [indexes] = await connection.query(TABLE_INDEXES_SQL, [
			config.database,
			tableName
		]);

		indexes.forEach((index: any) => {
			if (index.columns && typeof index.columns === 'string') {
				index.columns = index.columns.split(',');
			} else {
				index.columns = [];
			}

			if (index.name === 'PRIMARY') {
				index.type = 'PRIMARY';
			} else if (index.is_unique === 0) {
				index.type = 'UNIQUE';
			} else if (index.type === 'FULLTEXT') {
				index.type = 'FULLTEXT';
			} else if (index.type === 'SPATIAL') {
				index.type = 'SPATIAL';
			} else {
				index.type = 'INDEX';
			}

			delete index.is_unique;
		});

		return {
			success: true,
			indexes
		};
	} catch (err: any) {
		return {
			success: false,
			message: err.message || 'Error fetching table indexes',
			indexes: []
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getDatabaseSchemaForAIHandler(_: any, config: MysqlConnection) {
	let connection: any;

	try {
		connection = await createConnection(config);

		const [tables] = await connection.query(LIST_TABLES_SQL, [
			config.database
		]);

		if (tables.length === 0) {
			return { success: true, databaseSchema: { tables: [] } };
		}

		const databaseSchema: { tables: any[] } = { tables: [] };

		for (const table of tables) {
			const tableName = table.name;

			const structure = await getTableStructure(
				connection,
				config.database,
				tableName
			);

			const [outgoing] = await connection.query(OUTGOING_SQL, [
				config.database,
				tableName
			]);
			const [incoming] = await connection.query(INCOMING_SQL, [
				config.database,
				tableName
			]);

			const foreignKeys = [
				...outgoing.map((fk: any) => ({ ...fk, type: 'outgoing' })),
				...incoming.map((fk: any) => ({ ...fk, type: 'incoming' }))
			];

			const [indexes] = await connection.query(TABLE_INDEXES_SQL, [
				config.database,
				tableName
			]);

			indexes.forEach((index: any) => {
				if (index.columns && typeof index.columns === 'string') {
					index.columns = index.columns.split(',');
				} else {
					index.columns = [];
				}

				if (index.name === 'PRIMARY') {
					index.type = 'PRIMARY';
				} else if (index.is_unique === 0) {
					index.type = 'UNIQUE';
				} else if (index.type === 'FULLTEXT') {
					index.type = 'FULLTEXT';
				} else if (index.type === 'SPATIAL') {
					index.type = 'SPATIAL';
				} else {
					index.type = 'INDEX';
				}

				delete index.is_unique;
			});

			databaseSchema.tables.push({
				name: tableName,
				columns: structure,
				foreignKeys,
				indexes
			});
		}

		return {
			success: true,
			databaseSchema
		};
	} catch (err: any) {
		return {
			success: false,
			message: err.message || 'Error fetching database schema',
			databaseSchema: { tables: [] }
		};
	} finally {
		await safeEndConnection(connection);
	}
}

function registerTablesHandlers() {
	ipcMain.handle('list-tables', listTablesHandler);
	ipcMain.handle('get-table-record-count', getTableRecordCountHandler);
	ipcMain.handle('drop-tables', dropTablesHandler);
	ipcMain.handle('truncate-table', truncateTableHandler);
	ipcMain.handle('get-table-records', getTableRecordsHandler);
	ipcMain.handle('delete-table-records', deleteTableRecordsHandler);
	ipcMain.handle('get-table-foreign-keys', getTableForeignKeysHandler);
	ipcMain.handle('update-table-record', updateRecordHandler);
	ipcMain.handle('get-table-structure', getTableStructureHandler);
	ipcMain.handle('get-table-indexes', getTableIndexesHandler);
	ipcMain.handle('get-database-schema-for-ai', getDatabaseSchemaForAIHandler);
}

export { registerTablesHandlers };

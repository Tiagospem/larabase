import { ipcMain } from 'electron';
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
import { AppConnection } from '../../src/types/ssh-connection';
import { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface TableRow extends RowDataPacket {
	name: string;
	rowCount?: number;
	isApproximate?: boolean;
}

interface TableCountRow extends RowDataPacket {
	name: string;
	rowCount: number;
}

interface CountResult extends RowDataPacket {
	count: number;
}

interface TableColumn extends RowDataPacket {
	name: string;
	type?: string;
	foreign_key?: boolean;
}

interface ForeignKeyRow extends RowDataPacket {
	type?: 'outgoing' | 'incoming';
}

interface IndexRow extends RowDataPacket {
	name: string;
	columns?: string | string[];
	is_unique?: number;
	type: string;
}

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

function getDatabaseName(config: AppConnection): string {
	return config.remote
		? config.remote.remoteDbConfig.database
		: config.localDbConfig.database;
}

async function toggleForeignKeyChecks(
	connection: PoolConnection,
	enable: boolean
): Promise<void> {
	await connection.query(`SET FOREIGN_KEY_CHECKS = ${enable ? 1 : 0}`);
}

async function withTransaction<T>(
	connection: PoolConnection,
	callback: () => Promise<T>,
	disableForeignKeys = false
): Promise<T> {
	let fkDisabled = false;

	try {
		await connection.beginTransaction();

		if (disableForeignKeys) {
			await toggleForeignKeyChecks(connection, false);
			fkDisabled = true;
		}

		const result = await callback();

		if (fkDisabled) {
			await toggleForeignKeyChecks(connection, true);
		}

		await connection.commit();
		return result;
	} catch (err) {
		await connection.rollback().catch(() => {});

		if (fkDisabled) {
			await toggleForeignKeyChecks(connection, true).catch(() => {});
		}

		throw err;
	}
}

function applySortingAndPagination(
	baseSql: string,
	connection: PoolConnection,
	config: TableRecord
): string {
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
	connection: PoolConnection,
	database: string,
	tableName: string
): Promise<TableColumn[]> {
	const [cols] = await connection.query<RowDataPacket[]>(COLUMN_SQL, [
		database,
		tableName
	]);
	const [fks] = await connection.query<RowDataPacket[]>(FK_SQL, [
		database,
		tableName
	]);
	const fkSet = new Set(fks.map((f) => f.column_name));

	return cols.map((c) => {
		return {
			...(c as unknown as Record<string, unknown>),
			name: c.name as string,
			type: c.type as string,
			foreign_key: fkSet.has(c.name as string)
		} as TableColumn;
	});
}

async function getTableForeignKeys(
	connection: PoolConnection,
	database: string,
	tableName: string
): Promise<ForeignKeyRow[]> {
	const [out] = await connection.query<ForeignKeyRow[]>(OUTGOING_SQL, [
		database,
		tableName
	]);
	const [inc] = await connection.query<ForeignKeyRow[]>(INCOMING_SQL, [
		database,
		tableName
	]);

	return [
		...out.map((fk) => ({ ...fk, type: 'outgoing' as const })),
		...inc.map((fk) => ({ ...fk, type: 'incoming' as const }))
	];
}

function processIndexes(indexes: IndexRow[]): IndexRow[] {
	return indexes.map((index) => {
		const result = { ...index };

		if (result.columns && typeof result.columns === 'string') {
			(result.columns as unknown) = (result.columns as string).split(',');
		} else if (!result.columns) {
			(result.columns as unknown) = [];
		}

		if (result.name === 'PRIMARY') {
			result.type = 'PRIMARY';
		} else if (result.is_unique === 0) {
			result.type = 'UNIQUE';
		} else if (result.type === 'FULLTEXT') {
			result.type = 'FULLTEXT';
		} else if (result.type === 'SPATIAL') {
			result.type = 'SPATIAL';
		} else {
			result.type = 'INDEX';
		}

		delete result.is_unique;
		return result;
	});
}

async function getTableIndexes(
	connection: PoolConnection,
	database: string,
	tableName: string
): Promise<IndexRow[]> {
	const [indexes] = await connection.query<IndexRow[]>(TABLE_INDEXES_SQL, [
		database,
		tableName
	]);

	return processIndexes(indexes);
}

async function findRestrictingIds(
	connection: PoolConnection,
	tableName: string,
	ids: (string | number)[]
): Promise<(string | number)[]> {
	const [constraints] = await connection.query<RowDataPacket[]>(
		REFERENCE_CONSTRAINTS_SQL,
		[tableName, connection.config.database]
	);

	const restricts = constraints.filter((c: RowDataPacket) =>
		['RESTRICT', 'NO ACTION'].includes(c.on_delete as string)
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
			const [rows] = await connection.query<RowDataPacket[]>(sql, [id]);
			if (rows.length) {
				problematic.push(id);
				break;
			}
		}
	}

	return problematic;
}

async function deleteRecords(
	connection: PoolConnection,
	tableName: string,
	ids: (string | number)[]
): Promise<{ affectedRows: number }> {
	const placeholders = ids.map(() => '?').join(',');

	// noinspection SqlResolve
	const sql = `
    DELETE
      FROM ${connection.escapeId(tableName)}
     WHERE id IN (${placeholders})
  `;
	const [result] = await connection.execute<ResultSetHeader>(sql, ids);

	return { affectedRows: result.affectedRows };
}

async function listTablesHandler(_: unknown, config: AppConnection) {
	let connection: PoolConnection | null = null;

	const db =
		config.localDbConfig || (config.remote && config.remote.remoteDbConfig);

	if (!db) {
		return {
			success: false,
			message: 'No valid database configuration found',
			tables: []
		};
	}

	try {
		connection = await createConnection(config);

		const [tables] = await connection.query<TableRow[]>(LIST_TABLES_SQL, [
			db.database
		]);

		if (tables.length === 0) {
			return { success: true, tables: [] };
		}

		try {
			const [info] = await connection.query<TableCountRow[]>(
				BASE_COUNT_SQL,
				[db.database]
			);
			const counts = Object.fromEntries(
				info.map(({ name, rowCount }) => [name, +rowCount || 0])
			);
			tables.forEach((t) => {
				t.rowCount = counts[t.name] || 0;
				t.isApproximate = true;
			});
		} catch (e) {
			console.error('Error fetching counts:', e);
			tables.forEach((t) => {
				t.rowCount = 0;
				t.isApproximate = true;
			});
		}

		return { success: true, tables };
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return error('tables', errorMessage);
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableRecordCountHandler(
	_: unknown,
	config: AppConnection,
	table: Table
) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config);
		const escaped = connection.escapeId(table.name);
		const [rows] = await connection.query<CountResult[]>(
			`SELECT COUNT(*) AS count FROM ${escaped}`
		);

		return rows.length
			? { success: true, count: rows[0].count || 0, isApproximate: false }
			: error('count', 'Failed to count records');
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return error('count', errorMessage);
	} finally {
		await safeEndConnection(connection);
	}
}

async function dropTablesHandler(_: unknown, params: DropTableParams) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(params.appConnection);

		const dropTables = async () => {
			const failed: string[] = [];
			let successCount = 0;

			for (const name of params.tables) {
				try {
					const esc = connection.escapeId(name);
					const cascade = params.cascade ? ' CASCADE' : '';

					await connection.query(`DROP TABLE${cascade} ${esc}`);
					successCount++;
				} catch (e) {
					const errorMessage =
						e instanceof Error ? e.message : String(e);
					console.error(`Drop failed for ${name}:`, errorMessage);
					failed.push(name);
				}
			}

			if (failed.length > 0) {
				throw new Error(`Failed to drop tables: ${failed.join(', ')}`);
			}

			return { successCount };
		};

		const { successCount } = await withTransaction(
			connection,
			dropTables,
			params.ignoreForeignKeys
		);

		return {
			success: true,
			message: `Dropped ${successCount} tables successfully`
		};
	} catch (err) {
		console.error('Error in dropTablesHandler:', err);
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: errorMessage || 'Error dropping tables'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function truncateTableHandler(
	_: unknown,
	config: AppConnection,
	tableName: string
) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config);
		const database = getDatabaseName(config);

		const [fkRes] = await connection.query<RowDataPacket[]>(
			HAS_FK_USAGE_SQL,
			[tableName, database]
		);

		const hasFkReferences = fkRes.length > 0;

		await withTransaction(
			connection,
			async () => {
				await connection.query(
					`TRUNCATE TABLE ${connection.escapeId(tableName)}`
				);
				return true;
			},
			hasFkReferences
		);

		return {
			success: true,
			message: `Table ${tableName} truncated successfully`
		};
	} catch (err) {
		console.error(`Error truncating ${tableName}:`, err);
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: errorMessage || 'Error truncating table'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableRecordsHandler(_: unknown, config: TableRecord) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config.appConnection);
		const database = getDatabaseName(config.appConnection);

		const structure = await getTableStructure(
			connection,
			database,
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
			interface TotalRecordsRow extends RowDataPacket {
				totalRecords: number;
			}

			const [countRows] =
				await connection.query<TotalRecordsRow[]>(countQuery);
			const totalRecords = countRows[0]?.totalRecords || 0;

			const baseSql = `SELECT * FROM ${tableNameEsc}${where}`;
			const sql = applySortingAndPagination(baseSql, connection, config);

			const [rows] = await connection.query<RowDataPacket[]>(sql, [
				limit,
				offset
			]);

			return {
				success: true,
				data: rows,
				totalRecords,
				page,
				limit,
				structure
			};
		} catch (queryError) {
			console.error('SQL Error:', queryError);

			interface SqlError extends Error {
				code?: string;
				sqlMessage?: string;
			}

			const sqlError = queryError as SqlError;

			if (
				sqlError.code === 'ER_PARSE_ERROR' &&
				sqlError.sqlMessage?.includes('order')
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
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: errorMessage || 'Error fetching records',
			data: [],
			totalRecords: 0
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableStructureHandler(
	_: unknown,
	config: AppConnection,
	tableName: string
) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config);
		const database = getDatabaseName(config);
		const structure = await getTableStructure(
			connection,
			database,
			tableName
		);

		return {
			success: true,
			structure
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: errorMessage || 'Error fetching records'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableForeignKeysHandler(
	_: unknown,
	config: AppConnection,
	tableName: string
) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config);
		const database = getDatabaseName(config);

		const foreignKeys = await getTableForeignKeys(
			connection,
			database,
			tableName
		);

		return {
			success: true,
			foreignKeys
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return error('foreign', errorMessage || 'Failed to fetch foreign keys');
	} finally {
		await safeEndConnection(connection);
	}
}

async function deleteTableRecordsHandler(
	_: unknown,
	{
		appConnection: config,
		tableName,
		ids,
		ignoreForeignKeys
	}: DeleteRowsConfig
) {
	if (!Array.isArray(ids) || ids.length === 0) {
		throw new Error('At least one record ID is required');
	}

	let connection: PoolConnection | null = null;

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
	} catch (err) {
		interface SqlError extends Error {
			code?: string;
		}

		const sqlError = err as SqlError;

		if (sqlError.code === 'ER_ROW_IS_REFERENCED_2') {
			return {
				success: false,
				message:
					'Cannot delete these records because they are referenced by other tables',
				constraintError: true
			};
		}

		const errorMessage = err instanceof Error ? err.message : String(err);
		return { success: false, message: errorMessage };
	} finally {
		if (connection) {
			if (ignoreForeignKeys) {
				await toggleForeignKeyChecks(connection, true).catch((e) =>
					console.error('Error re-enabling foreign key checks:', e)
				);
			}

			await safeEndConnection(connection);
		}
	}
}

async function updateRecordHandler(_: unknown, config: UpdateTableRecord) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config.appConnection);
		const database = getDatabaseName(config.appConnection);
		const { tableName, data, id } = config;

		if (!tableName || !data || !id) {
			return { success: false, message: 'Missing required parameters' };
		}

		const tableNameEsc = connection.escapeId(tableName);

		const updateData = { ...data };

		if (Object.keys(updateData).length === 0) {
			return { success: true, message: 'No fields to update' };
		}

		const structure = await getTableStructure(
			connection,
			database,
			tableName
		);
		const jsonColumns = structure
			.filter((col) => col.type?.toLowerCase().includes('json'))
			.map((col) => col.name);

		const processedData = Object.fromEntries(
			Object.entries(updateData).map(([key, value]) => {
				if (jsonColumns.includes(key) && typeof value === 'string') {
					try {
						JSON.parse(value);
						return [key, value];
					} catch (e: unknown) {
						console.error(
							`Invalid JSON for column ${key}:`,
							e,
							value
						);

						return [key, value];
					}
				}
				return [key, value];
			})
		);

		const setClause = Object.entries(processedData)
			.map(([key, _]) => `${connection.escapeId(key)} = ?`)
			.join(', ');

		// noinspection SqlResolve
		const sql = `UPDATE ${tableNameEsc} SET ${setClause} WHERE id = ?`;

		const values = [...Object.values(processedData), id];

		const [result] = await connection.execute<ResultSetHeader>(sql, values);

		return {
			success: true,
			message: `Record updated successfully`,
			affectedRows: result.affectedRows
		};
	} catch (err) {
		console.error('Error updating record:', err);
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: errorMessage || 'Error updating record'
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getTableIndexesHandler(
	_: unknown,
	config: AppConnection,
	tableName: string
) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config);
		const database = getDatabaseName(config);

		const indexes = await getTableIndexes(connection, database, tableName);

		return {
			success: true,
			indexes
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: errorMessage || 'Error fetching table indexes',
			indexes: []
		};
	} finally {
		await safeEndConnection(connection);
	}
}

async function getDatabaseSchemaForAIHandler(
	_: unknown,
	config: AppConnection
) {
	let connection: PoolConnection | null = null;

	try {
		connection = await createConnection(config);
		const database = getDatabaseName(config);

		const [tables] = await connection.query<TableRow[]>(LIST_TABLES_SQL, [
			database
		]);

		if (tables.length === 0) {
			return { success: true, databaseSchema: { tables: [] } };
		}

		const databaseSchema: { tables: any[] } = { tables: [] };

		for (const table of tables) {
			const tableName = table.name;

			const structure = await getTableStructure(
				connection,
				database,
				tableName
			);

			const foreignKeys = await getTableForeignKeys(
				connection,
				database,
				tableName
			);

			const indexes = await getTableIndexes(
				connection,
				database,
				tableName
			);

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
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: errorMessage || 'Error fetching database schema',
			databaseSchema: { tables: [] }
		};
	} finally {
		await safeEndConnection(connection);
	}
}

function registerTablesHandlers(): void {
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

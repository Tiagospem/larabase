import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useConnectionsStore } from './connections';

export const useDatabaseStore = defineStore('database', () => {
  const tables = ref({});
  const isLoading = ref(false);
  const usedConnectionsStore = useConnectionsStore;
  const tableRecords = ref({});
  const tableStructures = ref({});
  const tableIndexes = ref({});
  const tableForeignKeys = ref({});
  const tableMigrations = ref({});

  const mockDatabases = {
    1: {
      keys: ['key1', 'key2', 'user:1', 'user:2', 'session:123'],
      keyCount: 5
    },
    2: {
      tables: [
        { name: 'users', columnCount: 8 },
        { name: 'products', columnCount: 12 },
        { name: 'orders', columnCount: 10 },
        { name: 'customers', columnCount: 15 },
        { name: 'inventory', columnCount: 7 },
        { name: 'payments', columnCount: 9 },
        { name: 'shipping', columnCount: 11 }
      ]
    },
    3: {
      tables: [
        { name: 'students', columnCount: 10 },
        { name: 'courses', columnCount: 8 },
        { name: 'enrollments', columnCount: 5 },
        { name: 'instructors', columnCount: 9 },
        { name: 'modules', columnCount: 6 },
        { name: 'assignments', columnCount: 7 }
      ]
    },
    4: {
      tables: [
        { name: 'users', columnCount: 6 },
        { name: 'posts', columnCount: 5 },
        { name: 'comments', columnCount: 4 },
        { name: 'categories', columnCount: 3 }
      ]
    },
    5: {
      tables: [
        { name: 'simple_table_1', columnCount: 4 },
        { name: 'simple_table_2', columnCount: 3 },
        { name: 'simple_table_3', columnCount: 5 }
      ]
    },
    6: {
      tables: [
        { name: 'action_trackers', columnCount: 5 },
        { name: 'ad_impression_tags', columnCount: 6 },
        { name: 'ad_server_dates', columnCount: 4 },
        { name: 'ad_server_media', columnCount: 8 },
        { name: 'ad_server_media_trackers', columnCount: 5 },
        { name: 'ad_server_third_party_emails', columnCount: 7 },
        { name: 'ad_server_type_case_study', columnCount: 6 },
        { name: 'ad_server_type_chapter', columnCount: 7 },
        { name: 'ad_server_type_device', columnCount: 5 },
        { name: 'ad_server_type_lab_medicine', columnCount: 9 },
        { name: 'ad_server_type_mini_mind', columnCount: 5 },
        { name: 'ad_server_type_newspaper', columnCount: 8 },
        { name: 'ad_server_types', columnCount: 4 },
        { name: 'ad_video_action_trackers', columnCount: 6 },
        { name: 'ad_video_trackers', columnCount: 5 },
        { name: 'ad_visible_logs', columnCount: 7 },
        { name: 'addresses', columnCount: 8 },
        { name: 'anonymous_accesses', columnCount: 4 },
        { name: 'anonymous_page_trackers', columnCount: 5 },
        { name: 'asks', columnCount: 4 },
        { name: 'audits', columnCount: 7 },
        { name: 'badges', columnCount: 3 },
        { name: 'blocked_campaigns', columnCount: 4 },
        { name: 'brands', columnCount: 5 },
        { name: 'campaign_mail_schedules', columnCount: 6 },
        { name: 'campaign_specialty', columnCount: 4 },
        { name: 'campaigns', columnCount: 10 },
        { name: 'cancellation_reasons', columnCount: 3 },
        { name: 'case_situation_choices', columnCount: 5 },
        { name: 'case_situations', columnCount: 5 },
        { name: 'case_studies', columnCount: 7 },
        { name: 'case_study_answers', columnCount: 6 },
        { name: 'chapter_captions', columnCount: 4 },
        { name: 'chapter_disease_state', columnCount: 5 },
        { name: 'chapter_drug_profile', columnCount: 6 }
      ]
    }
  };

  const tableContents = {
    'case_situations': [
      { id: 1, case_study_id: 1, requires_answer: 1, title: 'Case Situation 01', content: 'Doloremque vitae repellendus et dolores totam quia ullam. Et vero facere minima culpa velit eius.' },
      { id: 2, case_study_id: 1, requires_answer: 1, title: 'Case Situation 02', content: 'Cumque earum officia natus omnis facere delectus molestias. Nemo autem dolores dolorem est.' },
      { id: 3, case_study_id: 2, requires_answer: 1, title: 'Case Situation 01', content: 'Natus sed aut nam et quia. Dolorum maxime architecto voluptatem eaque.' },
      { id: 4, case_study_id: 2, requires_answer: 1, title: 'Case Situation 02', content: 'Libero autem quia eaque odio nostrum necessitatibus harum. Illum doloribus aut corrupti possimus.' },
      { id: 5, case_study_id: 3, requires_answer: 1, title: 'Case Situation 01', content: '<p>Ea beatae tempora asperiores veniam dolorum praesentium. Et ditis saepe harum laudantium assumenda.</p>' },
      { id: 6, case_study_id: 4, requires_answer: 1, title: 'Case Situation 01', content: 'Vero et nulla numquam consequatur veritatis. Deserunt at reiciendis veritatis eum.' },
      { id: 7, case_study_id: 4, requires_answer: 1, title: 'Case Situation 02', content: 'A maiores laboriosam odit dicta modi. Et possimus nulla consequatur illo earum.' },
      { id: 8, case_study_id: 5, requires_answer: 1, title: 'Case Situation 01', content: 'Soluta natus dolores nemo maiores dicta ut cumque aspernatur. Quam commodi ut esse magni.' },
      { id: 9, case_study_id: 5, requires_answer: 1, title: 'Case Situation 02', content: 'Et veniam necessitatibus sed totam. Provident et quia facere perferendis accusantium.' },
      { id: 10, case_study_id: 5, requires_answer: 1, title: 'Case Situation 03', content: 'Eos nulla et voluptas est placeat quidem aut. Quam a laborum aut digni' },
      { id: 11, case_study_id: 6, requires_answer: 1, title: 'Case Situation 01', content: 'Ratione veniam quos voluptate suscipit eligendi est commodi. Maiores quos et cupiditate voluptas.' },
      { id: 12, case_study_id: 7, requires_answer: 1, title: 'Case Situation 01', content: 'Voluptatibus eligendi qui et omnis non. Repudiandae est reiciendis veritatis.' },
      { id: 13, case_study_id: 8, requires_answer: 1, title: 'Case Situation 01', content: 'Ut est enim sit architecto. Illo nisi repudiandae qui et.' }
    ],
    'users': [
      { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2023-01-15', role: 'admin' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2023-02-20', role: 'user' },
      { id: 3, name: 'Alice Johnson', email: 'alice@example.com', created_at: '2023-03-10', role: 'user' },
      { id: 4, name: 'Bob Wilson', email: 'bob@example.com', created_at: '2023-04-05', role: 'editor' },
      { id: 5, name: 'Carol Martinez', email: 'carol@example.com', created_at: '2023-05-15', role: 'user' }
    ],
    'products': [
      { id: 1, name: 'Smartphone X', price: 999.99, stock: 50, category: 'Electronics' },
      { id: 2, name: 'Laptop Pro', price: 1499.99, stock: 30, category: 'Electronics' },
      { id: 3, name: 'Wireless Headphones', price: 199.99, stock: 100, category: 'Audio' },
      { id: 4, name: 'Smart Watch', price: 299.99, stock: 45, category: 'Wearables' },
      { id: 5, name: 'Coffee Maker', price: 79.99, stock: 60, category: 'Home Appliances' }
    ]
  };

  async function loadTables(connectionId) {
    isLoading.value = true;
    try {
      const connection = usedConnectionsStore().getConnection(connectionId);
      
      if (!connection) {
        console.error("Connection not found");
        tables.value = { tables: [] };
        return;
      }

      if (connection.type !== 'mysql') {
        if (mockDatabases[connectionId]) {
          tables.value = mockDatabases[connectionId];
        } else {
          tables.value = { tables: [] };
        }
        return;
      }

      const result = await window.api.listTables({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        database: connection.database
      });
      
      if (result.success && result.tables) {
        tables.value = { tables: result.tables };
      } else {
        console.error("Failed to load tables:", result.message);
        tables.value = { tables: [] };
      }
    } catch (error) {
      console.error("Error loading tables:", error);
      tables.value = { tables: [] };
    } finally {
      isLoading.value = false;
    }
  }

  async function getTableRecordCount(connectionId, tableName) {
    try {
      // Check if we already have the count cached
      const cacheKey = `${connectionId}:${tableName}`;
      if (tableRecords.value[cacheKey]?.count !== undefined) {
        return tableRecords.value[cacheKey].count;
      }

      const connection = usedConnectionsStore().getConnection(connectionId);
      
      if (!connection) {
        console.error("Connection not found");
        return 0;
      }

      if (connection.type !== 'mysql') {
        // Use mock data for non-MySQL databases
        if (tableContents[tableName]) {
          return tableContents[tableName].length;
        }
        return Math.floor(Math.random() * 100);
      }

      // For MySQL, get real record count
      const result = await window.api.getTableRecordCount({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        database: connection.database,
        tableName: tableName
      });
      
      if (result.success) {
        // Cache the result
        if (!tableRecords.value[cacheKey]) {
          tableRecords.value[cacheKey] = {};
        }
        tableRecords.value[cacheKey].count = result.count;
        return result.count;
      } else {
        console.error("Failed to get record count:", result.message);
        return 0;
      }
    } catch (error) {
      console.error(`Error getting record count for ${tableName}:`, error);
      return 0;
    }
  }

  async function loadTableData(connectionId, tableName) {
    try {
      const connection = usedConnectionsStore().getConnection(connectionId);
      
      if (!connection) {
        console.error("Connection not found");
        return [];
      }

      if (connection.type !== 'mysql') {
        // Use mock data for non-MySQL connections
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (tableContents[tableName]) {
          return tableContents[tableName];
        } else {
          return Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            column1: `Value ${i + 1}`,
            column2: Math.floor(Math.random() * 1000),
            column3: new Date().toISOString().split('T')[0]
          }));
        }
      }

      // For MySQL, get real data
      const result = await window.api.getTableData({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        database: connection.database,
        tableName: tableName,
        limit: 100
      });
      
      if (result.success) {
        // Cache the result
        const cacheKey = `${connectionId}:${tableName}`;
        if (!tableRecords.value[cacheKey]) {
          tableRecords.value[cacheKey] = {};
        }
        tableRecords.value[cacheKey].data = result.data;
        tableRecords.value[cacheKey].count = result.data.length;
        
        return result.data;
      } else {
        console.error("Failed to load table data:", result.message);
        return [];
      }
    } catch (error) {
      console.error(`Error loading data for ${tableName}:`, error);
      return [];
    }
  }

  // New functions for tab functionality
  async function getTableStructure(connectionId, tableName, force = false) {
    const cacheKey = `${connectionId}:${tableName}:structure`;
    if (!force && tableStructures.value[cacheKey]) {
      return tableStructures.value[cacheKey];
    }

    try {
      const connection = usedConnectionsStore().getConnection(connectionId);
      
      if (!connection) {
        console.error("Connection not found");
        return [];
      }

      if (connection.type !== 'mysql') {
        // Use mock data for non-MySQL databases
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
        
        // For a real application, this would make an API call to get the structure
        // For now we'll use mock data
        let structure = [];
        
        if (tableName === 'users') {
          structure = [
            {
              name: 'id',
              type: 'int(10) unsigned',
              nullable: false,
              default: null,
              primary_key: true,
              foreign_key: false,
              unique: false,
              extra: 'auto_increment'
            },
            {
              name: 'name',
              type: 'varchar(255)',
              nullable: false,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'email',
              type: 'varchar(255)',
              nullable: false,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: true,
              extra: ''
            },
            {
              name: 'password',
              type: 'varchar(255)',
              nullable: false,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'user_type_id',
              type: 'int(10) unsigned',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: true,
              unique: false,
              extra: 'foreign key (user_types)'
            },
            {
              name: 'avatar',
              type: 'varchar(255)',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'created_at',
              type: 'timestamp',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            }
          ];
        } else if (tableName === 'products') {
          structure = [
            {
              name: 'id',
              type: 'int(10) unsigned',
              nullable: false,
              default: null,
              primary_key: true,
              foreign_key: false,
              unique: false,
              extra: 'auto_increment'
            },
            {
              name: 'name',
              type: 'varchar(255)',
              nullable: false,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'description',
              type: 'text',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'price',
              type: 'decimal(8,2)',
              nullable: false,
              default: '0.00',
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'stock',
              type: 'int(11)',
              nullable: false,
              default: '0',
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'category',
              type: 'varchar(255)',
              nullable: false,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'created_at',
              type: 'timestamp',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            }
          ];
        } else {
          // Default structure for other tables
          structure = [
            {
              name: 'id',
              type: 'int(10) unsigned',
              nullable: false,
              default: null,
              primary_key: true,
              foreign_key: false,
              unique: false,
              extra: 'auto_increment'
            },
            {
              name: 'name',
              type: 'varchar(255)',
              nullable: false,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'created_at',
              type: 'timestamp',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              nullable: true,
              default: null,
              primary_key: false,
              foreign_key: false,
              unique: false,
              extra: ''
            }
          ];
        }
        
        tableStructures.value[cacheKey] = structure;
        return structure;
      }
      
      // Para MySQL, obter a estrutura real da tabela
      const result = await window.api.getTableStructure({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        database: connection.database,
        tableName: tableName
      });
      
      if (result.success) {
        tableStructures.value[cacheKey] = result.columns;
        return result.columns;
      } else {
        console.error("Failed to get table structure:", result.message);
        return [];
      }
      
    } catch (error) {
      console.error(`Error getting structure for ${tableName}:`, error);
      return [];
    }
  }

  async function getTableIndexes(connectionId, tableName, force = false) {
    const cacheKey = `${connectionId}:${tableName}:indexes`;
    if (!force && tableIndexes.value[cacheKey]) {
      return tableIndexes.value[cacheKey];
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
      
      // For a real application, this would make an API call to get the indexes
      // For now we'll use mock data
      let indexes = [];
      
      if (tableName === 'users') {
        indexes = [
          {
            name: 'PRIMARY',
            type: 'PRIMARY',
            columns: ['id'],
            algorithm: 'BTREE',
            cardinality: 1000,
            comment: ''
          },
          {
            name: 'users_email_unique',
            type: 'UNIQUE',
            columns: ['email'],
            algorithm: 'BTREE',
            cardinality: 1000,
            comment: ''
          },
          {
            name: 'users_user_type_id_foreign',
            type: 'INDEX',
            columns: ['user_type_id'],
            algorithm: 'BTREE',
            cardinality: 10,
            comment: 'Foreign key for user types'
          }
        ];
      } else if (tableName === 'products') {
        indexes = [
          {
            name: 'PRIMARY',
            type: 'PRIMARY',
            columns: ['id'],
            algorithm: 'BTREE',
            cardinality: 500,
            comment: ''
          },
          {
            name: 'products_category_index',
            type: 'INDEX',
            columns: ['category'],
            algorithm: 'BTREE',
            cardinality: 20,
            comment: ''
          }
        ];
      } else {
        // Default indexes for other tables
        indexes = [
          {
            name: 'PRIMARY',
            type: 'PRIMARY',
            columns: ['id'],
            algorithm: 'BTREE',
            cardinality: 0,
            comment: ''
          }
        ];
      }
      
      tableIndexes.value[cacheKey] = indexes;
      return indexes;
    } catch (error) {
      console.error(`Error getting indexes for ${tableName}:`, error);
      return [];
    }
  }

  async function getTableForeignKeys(connectionId, tableName, force = false) {
    const cacheKey = `${connectionId}:${tableName}:foreignKeys`;
    if (!force && tableForeignKeys.value[cacheKey]) {
      return tableForeignKeys.value[cacheKey];
    }

    try {
      const connection = usedConnectionsStore().getConnection(connectionId);
      
      if (!connection) {
        console.error("Connection not found");
        return [];
      }

      if (connection.type !== 'mysql') {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
        
        // For a real application, this would make an API call to get the foreign keys
        // For now we'll use mock data
        let foreignKeys = [];
        
        if (tableName === 'users') {
          foreignKeys = [
            {
              name: 'users_user_type_id_foreign',
              type: 'outgoing',
              column: 'user_type_id',
              referenced_table: 'user_types',
              referenced_column: 'id',
              on_update: 'CASCADE',
              on_delete: 'SET NULL'
            },
            {
              name: 'orders_user_id_foreign',
              type: 'incoming',
              table: 'orders',
              column: 'user_id',
              referenced_column: 'id',
              on_update: 'CASCADE',
              on_delete: 'RESTRICT'
            },
            {
              name: 'posts_author_id_foreign',
              type: 'incoming',
              table: 'posts',
              column: 'author_id',
              referenced_column: 'id',
              on_update: 'CASCADE',
              on_delete: 'CASCADE'
            }
          ];
        } else if (tableName === 'orders') {
          foreignKeys = [
            {
              name: 'orders_user_id_foreign',
              type: 'outgoing',
              column: 'user_id',
              referenced_table: 'users',
              referenced_column: 'id',
              on_update: 'CASCADE',
              on_delete: 'RESTRICT'
            },
            {
              name: 'order_items_order_id_foreign',
              type: 'incoming',
              table: 'order_items',
              column: 'order_id',
              referenced_column: 'id',
              on_update: 'CASCADE',
              on_delete: 'CASCADE'
            }
          ];
        } else if (tableName === 'order_items') {
          foreignKeys = [
            {
              name: 'order_items_order_id_foreign',
              type: 'outgoing',
              column: 'order_id',
              referenced_table: 'orders',
              referenced_column: 'id',
              on_update: 'CASCADE',
              on_delete: 'CASCADE'
            },
            {
              name: 'order_items_product_id_foreign',
              type: 'outgoing',
              column: 'product_id',
              referenced_table: 'products',
              referenced_column: 'id',
              on_update: 'CASCADE',
              on_delete: 'RESTRICT'
            }
          ];
        } else {
          // Default empty foreign keys for other tables
          foreignKeys = [];
        }
        
        tableForeignKeys.value[cacheKey] = foreignKeys;
        return foreignKeys;
      }
      
      // Para MySQL, obter as foreign keys reais
      const result = await window.api.getTableForeignKeys({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        database: connection.database,
        tableName: tableName
      });
      
      if (result.success) {
        tableForeignKeys.value[cacheKey] = result.foreignKeys;
        return result.foreignKeys;
      } else {
        console.error("Failed to get foreign keys:", result.message);
        return [];
      }
    } catch (error) {
      console.error(`Error getting foreign keys for ${tableName}:`, error);
      return [];
    }
  }

  async function getTableMigrations(connectionId, tableName, force = false) {
    const cacheKey = `${connectionId}:${tableName}:migrations`;
    if (!force && tableMigrations.value[cacheKey]) {
      return tableMigrations.value[cacheKey];
    }

    try {
      const connection = usedConnectionsStore().getConnection(connectionId);
      
      if (!connection) {
        console.error("Connection not found");
        return [];
      }
      
      // Verificar se esta conexão tem um caminho de projeto associado
      if (!connection.projectPath) {
        // Se não tiver caminho de projeto, retornamos um array vazio
        console.log("No project path associated with this connection");
        tableMigrations.value[cacheKey] = [];
        return [];
      }
      
      // Usar a nova API para buscar migrações
      const result = await window.api.findTableMigrations({
        projectPath: connection.projectPath,
        tableName: tableName
      });
      
      if (result.success) {
        tableMigrations.value[cacheKey] = result.migrations;
        return result.migrations;
      } else {
        console.error("Failed to get migrations:", result.message);
        return [];
      }
    } catch (error) {
      console.error(`Error getting migrations for ${tableName}:`, error);
      return [];
    }
  }

  // Limpar o cache de uma tabela específica
  function clearTableCache(cacheKey) {
    // Limpar dados da tabela
    if (tableRecords.value[cacheKey]) {
      delete tableRecords.value[cacheKey];
    }
    
    // Limpar estrutura
    if (tableStructures.value[`${cacheKey}:structure`]) {
      delete tableStructures.value[`${cacheKey}:structure`];
    }
    
    // Limpar índices
    if (tableIndexes.value[`${cacheKey}:indexes`]) {
      delete tableIndexes.value[`${cacheKey}:indexes`];
    }
    
    // Limpar chaves estrangeiras
    if (tableForeignKeys.value[`${cacheKey}:foreignKeys`]) {
      delete tableForeignKeys.value[`${cacheKey}:foreignKeys`];
    }
    
    // Limpar migrações
    if (tableMigrations.value[`${cacheKey}:migrations`]) {
      delete tableMigrations.value[`${cacheKey}:migrations`];
    }
  }

  const tablesList = computed(() => {
    return tables.value.tables || [];
  });

  return {
    tables,
    isLoading,
    loadTables,
    loadTableData,
    getTableRecordCount,
    getTableStructure,
    getTableIndexes,
    getTableForeignKeys,
    getTableMigrations,
    clearTableCache,
    tablesList
  };
}); 
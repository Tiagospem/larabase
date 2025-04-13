import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useConnectionsStore } from './connections';

export const useDatabaseStore = defineStore('database', () => {
  const tables = ref({});
  const isLoading = ref(false);
  const usedConnectionsStore = useConnectionsStore;

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

  async function loadTableData(connectionId, tableName) {
    try {
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
    } catch (error) {
      console.error(`${tableName}:`, error);
      return [];
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
    tablesList
  };
}); 
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Home from '@/views/Home.vue';
import DatabaseView from '@/views/DatabaseView.vue';
import SQLEditorView from '@/views/SQLEditorView.vue';

import './style.css';

const routes = [
  { path: '/', component: Home },
  { path: '/database/:id', component: DatabaseView },
  { path: '/sql-editor/:id', component: SQLEditorView },
  // { path: "/explain/:id", component: ExplainView }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const pinia = createPinia();

createApp(App)
  .use(router)
  .use(pinia)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*');
  });

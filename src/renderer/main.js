import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

import Home from './views/Home.vue';
import DatabaseView from './views/DatabaseView.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/database/:id', component: DatabaseView },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const pinia = createPinia();

const app = createApp(App);
app.use(router);
app.use(pinia);
app.mount('#app'); 
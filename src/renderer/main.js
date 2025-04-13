import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

// Importar rotas
import Home from './views/Home.vue';
import DatabaseView from './views/DatabaseView.vue';

// Configurar rotas
const routes = [
  { path: '/', component: Home },
  { path: '/database/:id', component: DatabaseView },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Criar instância do Pinia
const pinia = createPinia();

// Criar e montar a aplicação
const app = createApp(App);
app.use(router);
app.use(pinia);
app.mount('#app'); 
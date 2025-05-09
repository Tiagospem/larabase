import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";
import tooltip from "./directives/tooltip";

import Home from "./views/Home.vue";
import DatabaseView from "./views/DatabaseView.vue";
import SQLEditorView from "./views/SQLEditorView.vue";
import ExplainView from "./views/ExplainView.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/database/:id", component: DatabaseView },
  { path: "/sql-editor/:id", component: SQLEditorView },
  { path: "/explain/:id", component: ExplainView }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

const pinia = createPinia();

const app = createApp(App);
app.use(router);
app.use(pinia);
app.use(tooltip);
app.mount("#app");

<template>
  <div
    class="min-h-screen bg-app-bg text-white"
    data-theme="dark"
  >
    <router-view v-slot="{ Component }">
      <keep-alive include="DatabaseView">
        <component :is="Component" />
      </keep-alive>
    </router-view>
    <app-alert
      :type="alertType"
      :message="alertMessage"
      @close="clearAlert"
    />
    <update-notifier />
  </div>
</template>

<script setup>
import { ref, provide } from "vue";
import AppAlert from "./components/AppAlert.vue";
import UpdateNotifier from "./components/UpdateNotifier.vue";

const alertMessage = ref("");
const alertType = ref("info");

function showAlert(message, type = "info") {
  alertMessage.value = message;
  alertType.value = type;
}

function clearAlert() {
  alertMessage.value = "";
}

provide("showAlert", showAlert);
provide("clearAlert", clearAlert);
</script>

<style>
body,
html {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.5);
  border-radius: 4px;
  transition: background 0.2s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(200, 200, 200, 0.7);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

* {
  scrollbar-width: thin;
  scrollbar-color: rgba(150, 150, 150, 0.5) rgba(0, 0, 0, 0.1);
}
</style>

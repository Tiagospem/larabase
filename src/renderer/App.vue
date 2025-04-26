<template>
  <div class="min-h-screen">
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
import { ref, provide, onMounted } from "vue";
import AppAlert from "./components/AppAlert.vue";
import UpdateNotifier from "./components/UpdateNotifier.vue";
import { useSettingsStore } from "@/store/settings";

const alertMessage = ref("");
const alertType = ref("info");
const settingsStore = useSettingsStore();

function showAlert(message, type = "info") {
  alertMessage.value = message;
  alertType.value = type;
}

function clearAlert() {
  alertMessage.value = "";
}

provide("showAlert", showAlert);
provide("clearAlert", clearAlert);

onMounted(async () => {
  await settingsStore.loadSettings();

  if (settingsStore.settings.theme) {
    document.documentElement.setAttribute("data-theme", settingsStore.settings.theme);
  } else {
    document.documentElement.setAttribute("data-theme", "dim");
  }
});
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

.draggable {
  app-region: drag;
}

* {
  user-select: none;
  -webkit-user-select: none;
}

input,
textarea,
[contenteditable="true"],
.allow-select {
  user-select: text;
  -webkit-user-select: text;
}
</style>

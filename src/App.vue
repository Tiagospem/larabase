<script setup lang="ts">
  import { ref, provide, onMounted, defineAsyncComponent } from 'vue';
  import AppAlert from '@/components/Alert.vue';
  import { useSettingsStore } from '@/store/settings';

  //const UpdateNotifier = defineAsyncComponent(() => import("@/components/UpdaterNotifier.vue"));

  const alertMessage = ref('');
  const alertType = ref('info');
  const settingsStore = useSettingsStore();

  function showAlert(message: string, type = 'info') {
    alertMessage.value = message;
    alertType.value = type;
  }

  function clearAlert() {
    alertMessage.value = '';
  }

  provide('showAlert', showAlert);
  provide('clearAlert', clearAlert);

  onMounted(async () => {
    await settingsStore.loadSettings();

    if (settingsStore.settings.theme) {
      document.documentElement.setAttribute('data-theme', settingsStore.settings.theme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dim');
    }

    window.addEventListener('show-alert', ((event: CustomEvent) => {
      const { message, type } = event.detail;
      showAlert(message, type);
    }) as EventListener);
  });
</script>
<template>
  <div class="min-h-screen">
    <router-view v-slot="{ Component }">
      <keep-alive include="DatabaseView">
        <component :is="Component" />
      </keep-alive>
    </router-view>
    <app-alert :type="alertType" :message="alertMessage" @close="clearAlert" />
<!--    <update-notifier />-->
  </div>
</template>

<template>
  <div class="min-h-screen bg-app-bg text-white" data-theme="dark">
    <router-view></router-view>
    <app-alert 
      :type="alertType" 
      :message="alertMessage" 
      @close="clearAlert" />
  </div>
</template>

<script setup>
import { ref, provide } from 'vue';
import AppAlert from './components/AppAlert.vue';

const alertMessage = ref('');
const alertType = ref('info');

function showAlert(message, type = 'info') {
  alertMessage.value = message;
  alertType.value = type;
}

function clearAlert() {
  alertMessage.value = '';
}

provide('showAlert', showAlert);
provide('clearAlert', clearAlert);
</script>

<style>
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>

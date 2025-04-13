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
import { ref, onMounted, provide } from 'vue';
import { useRouter } from 'vue-router';
import AppAlert from './components/AppAlert.vue';

const router = useRouter();
const alertMessage = ref('');
const alertType = ref('info');

// Função para mostrar alertas
function showAlert(message, type = 'info') {
  alertMessage.value = message;
  alertType.value = type;
  
  // Log para depuração
  console.log(`[Alert] ${type}: ${message}`);
}

// Função para limpar alertas
function clearAlert() {
  alertMessage.value = '';
}

// Expor funções para componentes filhos
provide('showAlert', showAlert);
provide('clearAlert', clearAlert);

onMounted(() => {
  // Inicialização global da aplicação
  console.log('App inicializado');
  
  // Detectar erros de API no Electron
  if (window.api) {
    showAlert('Electron API disponível', 'success');
  } else {
    console.warn('Electron API não disponível');
    showAlert('Executando em modo de desenvolvimento sem Electron API', 'warning');
  }
});
</script>

<style>
/* Estilos globais adicionais podem ser colocados aqui */
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>

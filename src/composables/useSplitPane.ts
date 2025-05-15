import { ref, onMounted, onUnmounted } from 'vue';

export function useSplitPane(minWidth = 180, maxWidth = 480) {
  const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth') || '240'));
  const isDragging = ref(false);
  const sidebarRef = ref<HTMLElement | null>(null);

  function startResize(event: MouseEvent) {
    isDragging.value = true;
    event.preventDefault();
  }

  function stopResize() {
    if (isDragging.value) {
      isDragging.value = false;
      localStorage.setItem('sidebarWidth', sidebarWidth.value.toString());
    }
  }

  function resize(event: MouseEvent) {
    if (!isDragging.value) return;

    let newWidth = event.clientX;

    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;

    sidebarWidth.value = newWidth;
  }

  onMounted(() => {
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  });

  onUnmounted(() => {
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  });

  return {
    sidebarWidth,
    sidebarRef,
    startResize,
  };
}

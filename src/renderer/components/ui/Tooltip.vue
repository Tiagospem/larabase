<template>
  <div
    :id="tooltipId"
    class="tooltip-wrapper"
  >
    <slot />
    <div
      class="tooltip-content"
      :class="{ 'tooltip-visible': isVisible }"
      :data-position="position"
      :style="contentStyle"
    >
      <slot name="content">{{ text }}</slot>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, onMounted, onUnmounted, computed } from "vue";

const props = defineProps({
  text: {
    type: String,
    default: ""
  },
  position: {
    type: String,
    default: "top",
    validator: (value) => ["top", "bottom", "left", "right"].includes(value)
  },
  delay: {
    type: Number,
    default: 0
  }
});

const tooltipId = `tooltip-${Math.random().toString(36).substring(2, 11)}`;
const isVisible = ref(false);
const contentStyle = ref({});
let showTimeout = null;
let hideTimeout = null;

const showTooltip = () => {
  clearTimeout(hideTimeout);
  if (props.delay) {
    showTimeout = setTimeout(() => {
      positionTooltip();
      isVisible.value = true;
    }, props.delay);
  } else {
    positionTooltip();
    isVisible.value = true;
  }
};

const hideTooltip = () => {
  clearTimeout(showTimeout);
  hideTimeout = setTimeout(() => {
    isVisible.value = false;
  }, 100);
};

const positionTooltip = () => {
  contentStyle.value = {};

  setTimeout(() => {
    const wrapper = document.getElementById(tooltipId);
    if (!wrapper) return;

    const content = wrapper.querySelector(".tooltip-content");
    if (!content) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (props.position === "top" || props.position === "bottom") {
      if (contentRect.left < 0) {
        contentStyle.value.left = `${Math.abs(contentRect.left) + 10}px`;
        contentStyle.value.transform = "translateY(-100%)";
      } else if (contentRect.right > windowWidth) {
        const overflowRight = contentRect.right - windowWidth;
        contentStyle.value.left = `calc(50% - ${overflowRight + 10}px)`;
        contentStyle.value.transform = "translateX(-50%) translateY(-100%)";
      }
    } else if (props.position === "left" || props.position === "right") {
      if (contentRect.top < 0) {
        contentStyle.value.top = `${Math.abs(contentRect.top) + 10}px`;
        contentStyle.value.transform = "translateY(0)";
      } else if (contentRect.bottom > windowHeight) {
        const overflowBottom = contentRect.bottom - windowHeight;
        contentStyle.value.top = `calc(50% - ${overflowBottom + 10}px)`;
        contentStyle.value.transform = "translateY(-50%)";
      }
    }
  }, 0);
};

onMounted(() => {
  const wrapper = document.getElementById(tooltipId);
  if (wrapper) {
    wrapper.addEventListener("mouseenter", showTooltip);
    wrapper.addEventListener("mouseleave", hideTooltip);
    wrapper.addEventListener("focus", showTooltip);
    wrapper.addEventListener("blur-sm", hideTooltip);
  }

  window.addEventListener("resize", positionTooltip);
});

onUnmounted(() => {
  const wrapper = document.getElementById(tooltipId);
  if (wrapper) {
    wrapper.removeEventListener("mouseenter", showTooltip);
    wrapper.removeEventListener("mouseleave", hideTooltip);
    wrapper.removeEventListener("focus", showTooltip);
    wrapper.removeEventListener("blur-sm", hideTooltip);
  }
  clearTimeout(showTimeout);
  clearTimeout(hideTimeout);
  window.removeEventListener("resize", positionTooltip);
});
</script>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
  justify-content: center;
}

.tooltip-content {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s,
    visibility 0.2s;
  max-width: 200px;
  text-align: center;
  pointer-events: none;
  box-sizing: border-box;
}

.tooltip-visible {
  opacity: 1;
  visibility: visible;
}

.tooltip-wrapper .tooltip-content {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
}

.tooltip-wrapper .tooltip-content::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

.tooltip-wrapper .tooltip-content[data-position="bottom"] {
  top: 100%;
  bottom: auto;
  transform: translateX(-50%);
  margin-top: 8px;
  margin-bottom: 0;
}

.tooltip-wrapper .tooltip-content[data-position="bottom"]::after {
  top: -10px;
  bottom: auto;
  border-color: transparent transparent rgba(0, 0, 0, 0.8) transparent;
}

.tooltip-wrapper .tooltip-content[data-position="left"] {
  top: 50%;
  right: 100%;
  bottom: auto;
  left: auto;
  transform: translateY(-50%);
  margin-right: 8px;
  margin-bottom: 0;
}

.tooltip-wrapper .tooltip-content[data-position="left"]::after {
  top: 50%;
  left: 100%;
  margin-top: -5px;
  margin-left: 0;
  border-color: transparent transparent transparent rgba(0, 0, 0, 0.8);
}

.tooltip-wrapper .tooltip-content[data-position="right"] {
  top: 50%;
  right: auto;
  bottom: auto;
  left: 100%;
  transform: translateY(-50%);
  margin-left: 8px;
  margin-bottom: 0;
}

.tooltip-wrapper .tooltip-content[data-position="right"]::after {
  top: 50%;
  left: -10px;
  margin-top: -5px;
  border-color: transparent rgba(0, 0, 0, 0.8) transparent transparent;
}
</style>

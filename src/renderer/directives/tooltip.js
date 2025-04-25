/**
 *
 * how to use:
 * <button v-tooltip="'text'">btn</button>
 * <button v-tooltip.bottom="'text'">btn</button>
 * <button v-tooltip:bottom="'text'">btn</button>
 * <button v-tooltip="{ text: 'text', position: 'bottom' }">btn</button>
 */

let tooltipIdCounter = 0;

const generateUniqueId = () => `tooltip-${++tooltipIdCounter}`;

const createTooltipElement = (text, position) => {
  const tooltip = document.createElement("div");
  tooltip.className = "v-tooltip";
  tooltip.innerHTML = text;
  tooltip.setAttribute("data-position", position);
  return tooltip;
};

const positionTooltip = (tooltipEl, targetEl, position) => {
  const targetRect = targetEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();

  let top = targetRect.top - tooltipRect.height - 8;
  let left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;

  switch (position) {
    case "bottom":
      top = targetRect.bottom + 8;
      break;
    case "left":
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.left - tooltipRect.width - 8;
      break;
    case "right":
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.right + 8;
      break;
  }

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  if (left < 0) left = 5;
  if (left + tooltipRect.width > windowWidth) left = windowWidth - tooltipRect.width - 5;
  if (top < 0) top = 5;
  if (top + tooltipRect.height > windowHeight) top = windowHeight - tooltipRect.height - 5;

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
};

const showTooltip = (event, tooltipId, position) => {
  const tooltip = document.getElementById(tooltipId);
  if (!tooltip) return;

  tooltip.classList.add("v-tooltip-visible");
  positionTooltip(tooltip, event.currentTarget, position);
};

const hideTooltip = (tooltipId) => {
  const tooltip = document.getElementById(tooltipId);
  if (!tooltip) return;

  tooltip.classList.remove("v-tooltip-visible");
};

const injectStyles = () => {
  const styleId = "v-tooltip-styles";
  if (document.getElementById(styleId)) return;

  const styleEl = document.createElement("style");
  styleEl.id = styleId;
  styleEl.innerHTML = `
    .v-tooltip {
      position: fixed;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      max-width: 200px;
      text-align: center;
      pointer-events: none;
      box-sizing: border-box;
      white-space: nowrap;
    }
    
    .v-tooltip-visible {
      opacity: 1;
      visibility: visible;
    }
    
    .v-tooltip:after {
      content: '';
      position: absolute;
      border-width: 5px;
      border-style: solid;
    }
    
    .v-tooltip[data-position="top"]:after {
      top: 100%;
      left: 50%;
      margin-left: -5px;
      border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
    }
    
    .v-tooltip[data-position="bottom"]:after {
      bottom: 100%;
      left: 50%;
      margin-left: -5px;
      border-color: transparent transparent rgba(0, 0, 0, 0.8) transparent;
    }
    
    .v-tooltip[data-position="left"]:after {
      top: 50%;
      left: 100%;
      margin-top: -5px;
      border-color: transparent transparent transparent rgba(0, 0, 0, 0.8);
    }
    
    .v-tooltip[data-position="right"]:after {
      top: 50%;
      right: 100%;
      margin-top: -5px;
      border-color: transparent rgba(0, 0, 0, 0.8) transparent transparent;
    }
  `;

  document.head.appendChild(styleEl);
};

export default {
  install(app) {
    injectStyles();
    app.directive("tooltip", this.directive);
  },

  directive: {
    mounted(el, binding) {
      let text,
        position = "top";

      if (typeof binding.value === "string") {
        text = binding.value;
      } else if (typeof binding.value === "object") {
        text = binding.value.text || "";
        position = binding.value.position || "top";
      }

      if (binding.modifiers.bottom) position = "bottom";
      if (binding.modifiers.left) position = "left";
      if (binding.modifiers.right) position = "right";

      if (binding.arg) {
        position = binding.arg;
      }

      const tooltipId = generateUniqueId();
      el.setAttribute("data-tooltip-id", tooltipId);

      const tooltip = createTooltipElement(text, position);
      tooltip.id = tooltipId;
      document.body.appendChild(tooltip);

      el.addEventListener("mouseenter", (e) => showTooltip(e, tooltipId, position));
      el.addEventListener("mouseleave", () => hideTooltip(tooltipId));
      el.addEventListener("focus", (e) => showTooltip(e, tooltipId, position));
      el.addEventListener("blur-sm", () => hideTooltip(tooltipId));
    },

    updated(el, binding) {
      const tooltipId = el.getAttribute("data-tooltip-id");
      if (!tooltipId) return;

      const tooltip = document.getElementById(tooltipId);
      if (!tooltip) return;

      let text;
      if (typeof binding.value === "string") {
        text = binding.value;
      } else if (typeof binding.value === "object") {
        text = binding.value.text || "";
      }

      tooltip.innerHTML = text;

      let position = "top";
      if (typeof binding.value === "object") {
        position = binding.value.position || "top";
      }
      if (binding.modifiers.bottom) position = "bottom";
      if (binding.modifiers.left) position = "left";
      if (binding.modifiers.right) position = "right";
      if (binding.arg) position = binding.arg;

      tooltip.setAttribute("data-position", position);
    },

    unmounted(el) {
      const tooltipId = el.getAttribute("data-tooltip-id");
      if (!tooltipId) return;

      const tooltip = document.getElementById(tooltipId);
      if (tooltip) {
        document.body.removeChild(tooltip);
      }

      el.removeAttribute("data-tooltip-id");
    }
  }
};

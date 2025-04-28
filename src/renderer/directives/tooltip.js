const styleId = "vue-tooltip-styles";
const styleContent = `
.tooltip:before, .tooltip:after {
  z-index: 9999 !important;
}
.tooltip {
  position: relative !important;
}
`;

function addGlobalStyles() {
  if (typeof document !== "undefined" && !document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = styleContent;
    document.head.appendChild(styleEl);
  }
}

function parseBinding(binding) {
  const value = binding.value || {};
  let text = "",
    position = "top",
    color = null;

  if (typeof value === "string") {
    text = value;
  } else if (typeof value === "object") {
    text = value.text || "";
    position = value.position || position;
    color = value.color || null;
  }

  if (binding.modifiers.bottom) position = "bottom";
  if (binding.modifiers.left) position = "left";
  if (binding.modifiers.right) position = "right";
  if (binding.arg) position = binding.arg;

  return { text, position, color };
}

function createWrapper(el, binding) {
  const { text, position, color } = parseBinding(binding);
  const wrapper = document.createElement("div");

  wrapper.className = `tooltip tooltip-${position}`;
  if (color) wrapper.classList.add(`tooltip-${color}`);
  wrapper.setAttribute("data-tip", text);

  // store references for cleanup
  el._tooltipWrapper = wrapper;
  el._originalParent = el.parentNode;
  el._originalNextSibling = el.nextSibling;

  // wrap element
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
}

function updateWrapper(el, binding) {
  const wrapper = el._tooltipWrapper;
  if (!wrapper) return;

  const { text, position, color } = parseBinding(binding);
  wrapper.className = `tooltip tooltip-${position}`;
  if (color) wrapper.classList.add(`tooltip-${color}`);
  wrapper.setAttribute("data-tip", text);
}

function removeWrapper(el) {
  const wrapper = el._tooltipWrapper;
  if (wrapper && el._originalParent) {
    el._originalParent.insertBefore(el, el._originalNextSibling);
    wrapper.remove();

    delete el._tooltipWrapper;
    delete el._originalParent;
    delete el._originalNextSibling;
  }
}

export default {
  install(app) {
    addGlobalStyles();
    app.directive("tooltip", {
      mounted: createWrapper,
      updated: updateWrapper,
      unmounted: removeWrapper
    });
  }
};

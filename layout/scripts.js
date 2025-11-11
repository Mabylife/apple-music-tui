const lists = document.querySelector(".lists");
let idCounter = 0;
let activeLayer = null; // currently expanded/main layer
const MAX_LAYERS = 4; // because each closed layer is 20%

function createLayer() {
  const layer = document.createElement("div");
  layer.classList.add("layer");
  layer.dataset.id = String(idCounter++);
  // add an items container and populate with sample items
  const items = document.createElement("div");
  items.classList.add("items");
  layer.appendChild(items);
  populateItems(layer, 20);
  // track selected index per layer
  layer.dataset.selectedIndex = "0";
  return layer;
}

function updateLayout(newActive) {
  const layers = Array.from(lists.querySelectorAll(".layer"));
  if (layers.length === 0) return;

  // determine active layer: prefer provided newActive, else keep current active, else last
  if (newActive && layers.includes(newActive)) {
    activeLayer = newActive;
  } else if (!activeLayer || !layers.includes(activeLayer)) {
    activeLayer = layers[layers.length - 1];
  }

  const closedCount = layers.length - 1;
  const openWidth = Math.max(0, 100 - 20 * closedCount);

  layers.forEach((layer) => {
    if (layer === activeLayer) {
      layer.classList.remove("closed");
      layer.style.width = openWidth + "%";
      layer.style.minWidth = openWidth + "%";
    } else {
      layer.classList.add("closed");
      layer.style.width = "20%";
      layer.style.minWidth = "20%";
    }
  });
}

function spawnRight() {
  const count = lists.querySelectorAll(".layer").length;
  if (count >= MAX_LAYERS) return; // prevent more than 5 layers (would make open width 0)
  const layer = createLayer();
  lists.appendChild(layer);
  updateLayout(layer);
}

function spawnLeft() {
  const count = lists.querySelectorAll(".layer").length;
  if (count >= MAX_LAYERS) return;
  const layer = createLayer();
  lists.prepend(layer);
  updateLayout(layer);
}

function removeActiveLayer() {
  const layers = Array.from(lists.querySelectorAll(".layer"));
  if (layers.length <= 1) return; // keep at least one
  if (!activeLayer || !layers.includes(activeLayer)) {
    activeLayer = layers[layers.length - 1];
  }
  lists.removeChild(activeLayer);
  // after removal, make last element the active (or first if none)
  const remaining = Array.from(lists.querySelectorAll(".layer"));
  if (remaining.length > 0) {
    updateLayout(remaining[remaining.length - 1]);
  }
}

// populate a layer with N sample items
function populateItems(layer, n) {
  const itemsContainer = layer.querySelector(".items");
  itemsContainer.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const it = document.createElement("div");
    it.classList.add("item");
    it.dataset.index = String(i);
    it.tabIndex = -1;
    it.textContent = `Item ${i + 1}`;
    // (No mouse selection - TUI keyboard only). Keep click inert.
    itemsContainer.appendChild(it);
  }
  renderSelection(layer);
}

function renderSelection(layer) {
  const idx = parseInt(layer.dataset.selectedIndex || "0", 10);
  const items = Array.from(layer.querySelectorAll(".item"));
  items.forEach((it, i) => {
    if (i === idx) {
      it.classList.add("active");
      // ensure visible
      it.scrollIntoView({ block: "nearest" });
    } else {
      it.classList.remove("active");
    }
  });
}

function moveSelection(delta) {
  if (!activeLayer) return;
  const items = activeLayer.querySelectorAll(".item");
  if (!items || items.length === 0) return;
  let idx = parseInt(activeLayer.dataset.selectedIndex || "0", 10);
  idx = Math.max(0, Math.min(items.length - 1, idx + delta));
  activeLayer.dataset.selectedIndex = String(idx);
  renderSelection(activeLayer);
}

// initial layer
lists.innerHTML = ""; // clear any placeholder
const first = createLayer();
lists.appendChild(first);
updateLayout(first);

// keyboard handling
document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowRight") {
    // add a new layer on the right
    spawnRight();
  } else if (event.key === "ArrowLeft") {
    // go back: remove the currently active (right-most/last-focused) layer
    removeActiveLayer();
  } else if (event.key === "Backspace" || event.key === "Delete") {
    // remove currently active layer (like going back)
    removeActiveLayer();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1);
  }
});

const STORAGE_KEYS = {
  bansBySlot: "lol_roulette_bans_by_slot_v2",
  unowned: "lol_roulette_unowned_champions_v2"
};

const state = {
  version: null,
  results: {},
  rerollsLeft: {},
  sessionUsed: new Set(),
  bansBySlot: loadObject(STORAGE_KEYS.bansBySlot),
  unowned: new Set(loadArray(STORAGE_KEYS.unowned)),
  pendingBansBySlot: {},
  pendingUnowned: new Set(),
  selectedBanSlot: null
};

const blueSlots = document.getElementById("blueSlots");
const redSlots = document.getElementById("redSlots");
const versionLabel = document.getElementById("versionLabel");
const settingsDialog = document.getElementById("settingsDialog");
const championSettingsList = document.getElementById("championSettingsList");
const championSearch = document.getElementById("championSearch");
const banSlots = document.getElementById("banSlots");

init();

async function init() {
  buildSlots();
  buildBanSlots();
  bindGlobalEvents();
  await loadLatestDDragonVersion();
  renderAllSlots();
  resetPendingSettings();
  renderBanSlots();
  renderSettingsList();
}

function buildSlots() {
  for (const side of SIDES) {
    for (const lane of LANES) {
      const slotKey = getSlotKey(side.key, lane.key);
      state.results[slotKey] = null;
      state.rerollsLeft[slotKey] = 3;
      if (!(slotKey in state.bansBySlot)) state.bansBySlot[slotKey] = null;

      const slot = document.createElement("article");
      slot.className = "slot-card";
      slot.dataset.slotKey = slotKey;
      slot.dataset.side = side.key;
      slot.dataset.lane = lane.key;

      slot.innerHTML = `
        <div class="slot-topline">
          <span class="lane-pill">${lane.label}</span>
          <span class="reroll-count">再抽選 3 / 3</span>
        </div>
        <div class="champion-visual empty">
          <span>未抽選</span>
        </div>
        <div class="champion-info">
          <h3>---</h3>
          <p>候補から抽選してください</p>
        </div>
        <div class="slot-actions">
          <button class="roll-button">抽選</button>
          <button class="reroll-button" disabled>再抽選</button>
          <button class="clear-button ghost-small" disabled>解除</button>
        </div>
      `;

      slot.querySelector(".roll-button").addEventListener("click", () => rollSlot(side.key, lane.key, false));
      slot.querySelector(".reroll-button").addEventListener("click", () => rollSlot(side.key, lane.key, true));
      slot.querySelector(".clear-button").addEventListener("click", () => clearSlot(side.key, lane.key));

      if (side.key === "blue") blueSlots.appendChild(slot);
      if (side.key === "red") redSlots.appendChild(slot);
    }
  }
}

function buildBanSlots() {
  for (const side of SIDES) {
    for (const lane of LANES) {
      const slotKey = getSlotKey(side.key, lane.key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ban-slot-button";
      button.dataset.slotKey = slotKey;
      button.addEventListener("click", () => {
        state.selectedBanSlot = slotKey;
        renderBanSlots();
        renderSettingsList();
      });
      banSlots.appendChild(button);
    }
  }
}

function bindGlobalEvents() {
  document.getElementById("rollAllButton").addEventListener("click", rollAll);
  document.getElementById("resetButton").addEventListener("click", resetAll);
  document.getElementById("openSettingsButton").addEventListener("click", () => {
    resetPendingSettings();
    if (!state.selectedBanSlot) state.selectedBanSlot = getSlotKey("blue", "top");
    renderBanSlots();
    renderSettingsList();
    settingsDialog.showModal();
  });
  document.getElementById("clearSettingsButton").addEventListener("click", clearPendingSettings);
  document.getElementById("confirmSettingsButton").addEventListener("click", confirmSettings);
  championSearch.addEventListener("input", renderSettingsList);
}

async function loadLatestDDragonVersion() {
  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await res.json();
    state.version = versions[0];
    versionLabel.textContent = state.version;
  } catch (error) {
    state.version = "15.24.1";
    versionLabel.textContent = `${state.version} / fallback`;
  }
}

function rollAll() {
  for (const side of ["blue", "red"]) {
    for (const lane of LANES) {
      const slotKey = getSlotKey(side, lane.key);
      if (!state.results[slotKey]) rollSlot(side, lane.key, false);
    }
  }
}

function rollSlot(side, lane, isReroll) {
  const slotKey = getSlotKey(side, lane);
  if (isReroll && state.rerollsLeft[slotKey] <= 0) return;

  const pool = getAvailablePool(slotKey, lane);
  if (pool.length === 0) {
    alert("抽選候補がありません。BAN・未所持・既に出たチャンピオンを見直すか、リセットしてください。");
    return;
  }

  const nextChampion = weightedRandom(pool);
  if (isReroll) state.rerollsLeft[slotKey] -= 1;

  state.results[slotKey] = nextChampion;
  state.sessionUsed.add(nextChampion.id);
  renderSlot(slotKey);
}

function clearSlot(side, lane) {
  const slotKey = getSlotKey(side, lane);
  state.results[slotKey] = null;
  state.rerollsLeft[slotKey] = 3;
  renderSlot(slotKey);
}

function resetAll() {
  state.sessionUsed.clear();
  for (const side of SIDES) {
    for (const lane of LANES) clearSlot(side.key, lane.key);
  }
}

function getAvailablePool(slotKey, lane) {
  const slotBanId = state.bansBySlot[slotKey];
  return CHAMPION_POOLS[lane].filter((champion) => {
    if (state.sessionUsed.has(champion.id)) return false;
    if (slotBanId && champion.id === slotBanId) return false;
    if (state.unowned.has(champion.id)) return false;
    return true;
  });
}

function weightedRandom(pool) {
  const totalWeight = pool.reduce((sum, champion) => sum + champion.weight, 0);
  let random = Math.random() * totalWeight;

  for (const champion of pool) {
    random -= champion.weight;
    if (random <= 0) return champion;
  }

  return pool[pool.length - 1];
}

function renderAllSlots() {
  Object.keys(state.results).forEach(renderSlot);
}

function renderSlot(slotKey) {
  const slot = document.querySelector(`[data-slot-key="${slotKey}"]`);
  const champion = state.results[slotKey];
  const rerollsLeft = state.rerollsLeft[slotKey];
  const lane = slot.dataset.lane;

  slot.querySelector(".reroll-count").textContent = `再抽選 ${rerollsLeft} / 3`;

  const visual = slot.querySelector(".champion-visual");
  const infoTitle = slot.querySelector(".champion-info h3");
  const infoText = slot.querySelector(".champion-info p");
  const rollButton = slot.querySelector(".roll-button");
  const rerollButton = slot.querySelector(".reroll-button");
  const clearButton = slot.querySelector(".clear-button");

  if (!champion) {
    visual.className = "champion-visual empty";
    visual.innerHTML = "<span>未抽選</span>";
    infoTitle.textContent = "---";
    infoText.textContent = `${getLaneLabel(lane)} の候補から抽選`;
    rollButton.disabled = false;
    rerollButton.disabled = true;
    clearButton.disabled = true;
    return;
  }

  visual.className = "champion-visual";
  visual.innerHTML = `
    <img class="splash" src="${getSplashUrl(champion.id)}" alt="${champion.ja}" loading="lazy" />
    <img class="icon" src="${getIconUrl(champion.id)}" alt="${champion.ja} icon" loading="lazy" />
  `;
  infoTitle.textContent = champion.ja;
  infoText.textContent = `${getLaneLabel(lane)} の候補から選出`;
  rollButton.disabled = true;
  rerollButton.disabled = rerollsLeft <= 0;
  clearButton.disabled = false;
}

function renderBanSlots() {
  banSlots.querySelectorAll(".ban-slot-button").forEach((button) => {
    const slotKey = button.dataset.slotKey;
    const champion = getChampionById(state.pendingBansBySlot[slotKey]);
    button.classList.toggle("active", slotKey === state.selectedBanSlot);
    button.innerHTML = `
      <span>${getSlotLabel(slotKey)}</span>
      <strong>${champion ? champion.ja : "未設定"}</strong>
      
    `;
  });
}

function renderSettingsList() {
  const keyword = normalizeKeyword(championSearch.value);
  const champions = getUniqueChampions().filter((champion) => {
    const text = normalizeKeyword(`${champion.ja} ${champion.name} ${champion.id}`);
    return text.includes(keyword);
  });

  championSettingsList.innerHTML = champions.map((champion) => {
    const selectedForCurrentBan = state.selectedBanSlot && state.pendingBansBySlot[state.selectedBanSlot] === champion.id;
    return `
      <div class="setting-row">
        <div class="setting-champion">
          <img src="${getIconUrl(champion.id)}" alt="${champion.ja}" />
          <span>${champion.ja}</span>
          
        </div>
        <button type="button" class="ban-select-button ${selectedForCurrentBan ? "selected" : ""}" data-id="${champion.id}">
          ${selectedForCurrentBan ? "BAN選択中" : "選択中BAN枠へ設定"}
        </button>
        <label>
          <input type="checkbox" data-type="unowned" data-id="${champion.id}" ${state.pendingUnowned.has(champion.id) ? "checked" : ""}>
          未所持
        </label>
      </div>
    `;
  }).join("");

  championSettingsList.querySelectorAll(".ban-select-button").forEach((button) => {
    button.addEventListener("click", () => setPendingBan(button.dataset.id));
  });
  championSettingsList.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", handlePendingUnownedChange);
  });
}

function setPendingBan(championId) {
  if (!state.selectedBanSlot) return;
  if (state.pendingBansBySlot[state.selectedBanSlot] === championId) {
    state.pendingBansBySlot[state.selectedBanSlot] = null;
  } else {
    state.pendingBansBySlot[state.selectedBanSlot] = championId;
  }
  renderBanSlots();
  renderSettingsList();
}

function handlePendingUnownedChange(event) {
  const { id } = event.target.dataset;
  if (event.target.checked) state.pendingUnowned.add(id);
  else state.pendingUnowned.delete(id);
}

function confirmSettings() {
  state.bansBySlot = { ...state.pendingBansBySlot };
  state.unowned = new Set(state.pendingUnowned);
  saveObject(STORAGE_KEYS.bansBySlot, state.bansBySlot);
  saveArray(STORAGE_KEYS.unowned, [...state.unowned]);
  removeInvalidResults();
  renderAllSlots();
  settingsDialog.close();
}

function resetPendingSettings() {
  state.pendingBansBySlot = { ...state.bansBySlot };
  state.pendingUnowned = new Set(state.unowned);
}

function clearPendingSettings() {
  for (const side of SIDES) {
    for (const lane of LANES) {
      state.pendingBansBySlot[getSlotKey(side.key, lane.key)] = null;
    }
  }
  state.pendingUnowned.clear();
  renderBanSlots();
  renderSettingsList();
}

function removeInvalidResults() {
  for (const [slotKey, champion] of Object.entries(state.results)) {
    if (!champion) continue;
    const bannedForSlot = state.bansBySlot[slotKey] === champion.id;
    const unowned = state.unowned.has(champion.id);
    if (bannedForSlot || unowned) {
      state.results[slotKey] = null;
      state.rerollsLeft[slotKey] = 3;
    }
  }
}

function getUniqueChampions() {
  const map = new Map();
  Object.values(CHAMPION_POOLS).flat().forEach((champion) => {
    if (!map.has(champion.id)) map.set(champion.id, champion);
  });
  return [...map.values()].sort((a, b) => a.ja.localeCompare(b.ja, "ja"));
}

function getChampionById(championId) {
  if (!championId) return null;
  return getUniqueChampions().find((champion) => champion.id === championId) || CHAMPION_MASTER[championId] || null;
}

function getSlotKey(side, lane) {
  return `${side}-${lane}`;
}

function getSlotLabel(slotKey) {
  const [sideKey, laneKey] = slotKey.split("-");
  const side = SIDES.find((item) => item.key === sideKey)?.label || sideKey;
  const lane = getLaneLabel(laneKey);
  return `${side} / ${lane}`;
}

function getLaneLabel(laneKey) {
  return LANES.find((lane) => lane.key === laneKey)?.label || laneKey;
}

function getIconUrl(championId) {
  return `https://ddragon.leagueoflegends.com/cdn/${state.version}/img/champion/${championId}.png`;
}

function getSplashUrl(championId) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`;
}

function normalizeKeyword(value) {
  return toKatakana(
    String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\u3000・＝=\-'’']/g, "")
  );
}

function toKatakana(value) {
  return value.replace(/[ぁ-ん]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60)
  );
}

function loadArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadObject(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

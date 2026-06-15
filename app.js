const STORAGE_KEYS = {
  bansBySlot: "lol_roulette_bans_by_slot_v2",
  unowned: "lol_roulette_unowned_champions_v2"
};

const state = {
  version: null,
  results: {},
  rerollsLeft: {},
  sessionUsed: new Set(),
  completeResults: {},
  completeRerollsLeft: {},
  completeUsed: new Set(),
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
const completeRandomPanel = document.getElementById("completeRandomPanel");
const completeBlueSlots = document.getElementById("completeBlueSlots");
const completeRedSlots = document.getElementById("completeRedSlots");
const yuumiRuleSelect = document.getElementById("yuumiRuleSelect");
const enchanterRuleSelect = document.getElementById("enchanterRuleSelect");

init();

async function init() {
  buildSlots();
  buildCompleteRandomSlots();
  buildBanSlots();
  bindGlobalEvents();
  await loadLatestDDragonVersion();
  renderAllSlots();
  renderAllCompleteSlots();
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
          <div class="lane-title">
            ${getLaneIconSvg(lane.key)}
            <span class="lane-pill">${lane.label}</span>
          </div>
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


function buildCompleteRandomSlots() {
  for (const side of SIDES) {
    for (const lane of LANES) {
      const slotKey = getSlotKey(side.key, lane.key);
      state.completeResults[slotKey] = null;
      state.completeRerollsLeft[slotKey] = 3;

      const slot = document.createElement("article");
      slot.className = "slot-card complete-slot-card";
      slot.dataset.completeSlotKey = slotKey;
      slot.dataset.side = side.key;
      slot.dataset.lane = lane.key;

      slot.innerHTML = `
        <div class="slot-topline">
          <div class="lane-title">
            ${getLaneIconSvg(lane.key)}
            <span class="lane-pill">${lane.label}</span>
          </div>
          <span class="reroll-count">再抽選 3 / 3</span>
        </div>
        <div class="champion-visual empty">
          <span>未抽選</span>
        </div>
        <div class="champion-info">
          <h3>---</h3>
          <p>完全ランダム候補から抽選してください</p>
        </div>
        <div class="slot-actions">
          <button class="roll-button">抽選</button>
          <button class="reroll-button" disabled>再抽選</button>
          <button class="clear-button ghost-small" disabled>解除</button>
        </div>
      `;

      slot.querySelector(".roll-button").addEventListener("click", () => rollCompleteSlot(side.key, lane.key, false));
      slot.querySelector(".reroll-button").addEventListener("click", () => rollCompleteSlot(side.key, lane.key, true));
      slot.querySelector(".clear-button").addEventListener("click", () => clearCompleteSlot(side.key, lane.key));

      if (side.key === "blue") completeBlueSlots.appendChild(slot);
      if (side.key === "red") completeRedSlots.appendChild(slot);
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
  document.getElementById("openCompleteRandomButton").addEventListener("click", toggleCompleteRandomPanel);
  document.getElementById("rollCompleteRandomButton").addEventListener("click", rollAllCompleteRandom);
  document.getElementById("resetCompleteRandomButton").addEventListener("click", resetCompleteRandom);
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


function toggleCompleteRandomPanel() {
  completeRandomPanel.classList.toggle("hidden");
  if (!completeRandomPanel.classList.contains("hidden")) {
    completeRandomPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function rollAllCompleteRandom() {
  for (const side of ["blue", "red"]) {
    for (const lane of LANES) {
      const slotKey = getSlotKey(side, lane.key);
      if (!state.completeResults[slotKey]) rollCompleteSlot(side, lane.key, false);
    }
  }
}

function rollCompleteSlot(side, lane, isReroll) {
  const slotKey = getSlotKey(side, lane);
  if (isReroll && state.completeRerollsLeft[slotKey] <= 0) return;

  const pool = getCompleteRandomAvailablePool(slotKey, lane);
  if (pool.length === 0) {
    alert("完全ランダムの抽選候補がありません。BAN・未所持・既に出たチャンピオン・追加設定を見直すか、完全ランダムをリセットしてください。");
    return;
  }

  const nextChampion = weightedRandom(pool);
  if (isReroll) state.completeRerollsLeft[slotKey] -= 1;

  state.completeResults[slotKey] = nextChampion;
  state.completeUsed.add(nextChampion.id);
  renderCompleteSlot(slotKey);
}

function clearCompleteSlot(side, lane) {
  const slotKey = getSlotKey(side, lane);
  state.completeResults[slotKey] = null;
  state.completeRerollsLeft[slotKey] = 3;
  renderCompleteSlot(slotKey);
}

function resetCompleteRandom() {
  state.completeUsed.clear();
  for (const side of SIDES) {
    for (const lane of LANES) clearCompleteSlot(side.key, lane.key);
  }
}

function getCompleteRandomAvailablePool(slotKey, lane) {
  const slotBanId = state.bansBySlot[slotKey];
  return getUniqueChampions().filter((champion) => {
    if (state.completeUsed.has(champion.id)) return false;
    if (slotBanId && champion.id === slotBanId) return false;
    if (state.unowned.has(champion.id)) return false;
    if (!isAllowedByCompleteRandomRules(champion.id, lane)) return false;
    return true;
  }).map((champion) => ({ ...champion, weight: 1 }));
}

function isAllowedByCompleteRandomRules(championId, lane) {
  if (championId === "Yuumi") {
    const rule = yuumiRuleSelect.value;
    if (rule === "support_only") return lane === "support";
    if (rule === "non_jungle") return lane !== "jungle";
    return true;
  }

  if (ENCHANTER_IDS.includes(championId)) {
    const rule = enchanterRuleSelect.value;
    if (rule === "non_jungle") return lane !== "jungle";
    return true;
  }

  return true;
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


function renderAllCompleteSlots() {
  Object.keys(state.completeResults).forEach(renderCompleteSlot);
}

function renderCompleteSlot(slotKey) {
  const slot = document.querySelector(`[data-complete-slot-key="${slotKey}"]`);
  const champion = state.completeResults[slotKey];
  const rerollsLeft = state.completeRerollsLeft[slotKey];
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
    infoText.textContent = `${getLaneLabel(lane)} の完全ランダム候補から抽選`;
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
  infoText.textContent = `${getLaneLabel(lane)} / 完全ランダムから選出`;
  rollButton.disabled = true;
  rerollButton.disabled = rerollsLeft <= 0;
  clearButton.disabled = false;
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

  for (const [slotKey, champion] of Object.entries(state.completeResults)) {
    if (!champion) continue;
    const lane = slotKey.split("-")[1];
    const bannedForSlot = state.bansBySlot[slotKey] === champion.id;
    const unowned = state.unowned.has(champion.id);
    const notAllowed = !isAllowedByCompleteRandomRules(champion.id, lane);
    if (bannedForSlot || unowned || notAllowed) {
      state.completeResults[slotKey] = null;
      state.completeRerollsLeft[slotKey] = 3;
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


function getLaneIconSvg(laneKey) {
  const icons = {
    top: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v4h-4v10H5V5Zm4 4v6h2V9H9Z"/></svg>',
    jungle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 6.2L20 6.6l-2.6 5.8L21 17l-5.8-1.3L12 21l-3.2-5.3L3 17l3.6-4.6L4 6.6l5.8 2.6L12 3Z"/></svg>',
    mid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6l2 2L8 20H4v-4l2 2Zm-2-8V4h6L8 6H6v2l-2 2Zm10 10 2-2h2v-2l2-2v6h-6Z"/></svg>',
    adc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5V5Zm4 4v6h6V9H9Zm8-6 4 4-2 2-4-4 2-2ZM3 17l4 4 2-2-4-4-2 2Z"/></svg>',
    support: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 4.8L20 10l-4 3.9.9 5.6L12 16.8l-4.9 2.7.9-5.6L4 10l5.6-1.2L12 4Zm0 5.2-1 2-2.2.5 1.6 1.6-.4 2.2 2-1.1 2 1.1-.4-2.2 1.6-1.6-2.2-.5-1-2Z"/></svg>'
  };

  return `<span class="lane-icon lane-icon-${laneKey}">${icons[laneKey] || ""}</span>`;
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

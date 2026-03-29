/* ============================================================
   NEXUSREALMS — app.js
   Main game launcher logic
   ============================================================ */

// ======= STATE =======
const state = {
  view: 'home',
  gems: 120,
  streak: 3,
  selectedMode: 'survival',
  avatar: {
    skinColor: '#c8a87a',
    bodyColor: '#3b82f6',
    legColor: '#1e40af',
    headAccessory: null,
    bodyItem: null,
    extras: [],
  },
  dailyCompleted: [false, false, false, false, false],
  achievements: [],
};

// ======= DATA =======
const DAILY_QUESTS = [
  { id: 'd1', name: 'Mine 50 Blocks', icon: 'icon-sword', progress: 50, max: 50, gems: 5, done: true },
  { id: 'd2', name: 'Craft 3 Items', icon: 'icon-palette', progress: 2, max: 3, gems: 5, done: false },
  { id: 'd3', name: 'Explore a Cave', icon: 'icon-world', progress: 0, max: 1, gems: 5, done: false },
  { id: 'd4', name: 'Build 100 Blocks', icon: 'icon-home', progress: 72, max: 100, gems: 5, done: false },
  { id: 'd5', name: 'Kill 5 Mobs', icon: 'icon-fire', progress: 0, max: 5, gems: 5, done: false },
];

const ACHIEVEMENTS = [
  { id: 'a1', name: 'First Steps', desc: 'Place your first block', icon: '🧱', gems: 10, unlocked: true },
  { id: 'a2', name: 'Cave Explorer', desc: 'Venture 30 blocks underground', icon: '⛏', gems: 15, unlocked: true },
  { id: 'a3', name: 'Master Builder', desc: 'Place 10,000 blocks', icon: '🏰', gems: 50, unlocked: true },
  { id: 'a4', name: 'Diamond Hunter', desc: 'Find 10 diamonds', icon: '💎', gems: 30, unlocked: false },
  { id: 'a5', name: 'Dragon Slayer', desc: 'Defeat the Ender Dragon', icon: '🐉', gems: 100, unlocked: false },
];

const SKIN_COLORS = [
  '#fddbb4','#f5c497','#e8a87c','#c8a87a','#b07a57',
  '#8d5524','#5c3317','#ffe0bd','#ffcd94','#e8b88a',
  '#a0522d','#d2691e','#cd853f','#deb887',
];
const HAIR_COLORS = [
  '#1a1a1a','#3d2314','#5c3d2e','#8b4513','#a0522d',
  '#c8a87a','#f4d03f','#e74c3c','#9b59b6','#3498db',
  '#ffffff','#e8e8e8','#ff6b6b','#48dbfb',
];
const SHIRT_COLORS = [
  '#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#14b8a6','#64748b',
  '#1e293b','#ffffff','#ff7eb3','#7dd3fc',
];
const PANT_COLORS = [
  '#1e3a5f','#1e40af','#374151','#111827','#4b5563',
  '#7c3aed','#065f46','#78350f','#1c1917','#0f172a',
];

const HEAD_ITEMS = [
  { id: 'none', name: 'None', emoji: '🔘', cost: 0 },
  { id: 'cap', name: 'Cap', emoji: '🧢', cost: 0 },
  { id: 'crown', name: 'Crown', emoji: '👑', cost: 30 },
  { id: 'wizard', name: 'Wizard Hat', emoji: '🧙', cost: 20 },
  { id: 'horns', name: 'Horns', emoji: '😈', cost: 50 },
  { id: 'halo', name: 'Halo', emoji: '😇', cost: 40 },
  { id: 'helmet', name: 'Helmet', emoji: '⛑', cost: 25 },
  { id: 'beanie', name: 'Beanie', emoji: '🎿', cost: 0 },
];

const BODY_ITEMS = [
  { id: 'none', name: 'Plain', emoji: '👕', cost: 0 },
  { id: 'armor', name: 'Armor', emoji: '🛡', cost: 60 },
  { id: 'hoodie', name: 'Hoodie', emoji: '🥷', cost: 20 },
  { id: 'suit', name: 'Suit', emoji: '🤵', cost: 35 },
  { id: 'cape', name: 'Cape', emoji: '🦸', cost: 45 },
  { id: 'labcoat', name: 'Lab Coat', emoji: '🥼', cost: 30 },
];

const EXTRA_ITEMS = [
  { id: 'wings', name: 'Wings', emoji: '🪽', cost: 80 },
  { id: 'trail', name: 'Pixel Trail', emoji: '✨', cost: 55 },
  { id: 'aura', name: 'Neon Aura', emoji: '💫', cost: 70 },
  { id: 'pet_cat', name: 'Cat Pet', emoji: '🐱', cost: 40 },
  { id: 'pet_dog', name: 'Dog Pet', emoji: '🐶', cost: 40 },
  { id: 'pet_dragon', name: 'Mini Dragon', emoji: '🐲', cost: 120 },
];

const SETTINGS_GROUPS = [
  {
    title: 'Graphics',
    rows: [
      { label: 'Render Distance', desc: 'Chunks to render', type: 'select', options: ['Near', 'Medium', 'Far', 'Ultra'], value: 'Medium' },
      { label: 'V-Sync', desc: 'Sync to display refresh', type: 'toggle', value: true },
      { label: 'Particle Effects', desc: 'Block break particles', type: 'toggle', value: true },
      { label: 'Shadow Quality', desc: 'Real-time shadows', type: 'select', options: ['Off', 'Low', 'Medium', 'High'], value: 'Medium' },
    ]
  },
  {
    title: 'Audio',
    rows: [
      { label: 'Master Volume', type: 'slider', value: 80 },
      { label: 'Music Volume', type: 'slider', value: 60 },
      { label: 'SFX Volume', type: 'slider', value: 75 },
      { label: 'Mute When Unfocused', type: 'toggle', value: true },
    ]
  },
  {
    title: 'Gameplay',
    rows: [
      { label: 'Difficulty', type: 'select', options: ['Peaceful', 'Easy', 'Normal', 'Hard'], value: 'Normal' },
      { label: 'Show Coordinates', type: 'toggle', value: false },
      { label: 'Auto-Jump', type: 'toggle', value: true },
      { label: 'FOV', type: 'slider', value: 70 },
    ]
  },
  {
    title: 'Account',
    rows: [
      { label: 'Username', type: 'label', value: 'Steve' },
      { label: 'Daily Streak', type: 'label', value: '3 days 🔥' },
      { label: 'NexGems Earned Total', type: 'label', value: '480 💎' },
    ]
  },
];

// ======= HELPERS =======
function $(id) { return document.getElementById(id); }
function showToast(msg, duration = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
function updateGems(delta) {
  state.gems += delta;
  $('gemCount').textContent = state.gems;
  $('sidebarGems').textContent = state.gems;
}

// ======= BACKGROUND BLOCKS =======
function initBgBlocks() {
  const container = $('bgBlocks');
  const colors = ['#3b82f6','#7c3aed','#22c55e','#f59e0b','#ef4444','#06b6d4'];
  for (let i = 0; i < 25; i++) {
    const div = document.createElement('div');
    div.className = 'bg-block';
    const size = Math.random() * 30 + 10;
    div.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 30 + 20}s;
      animation-delay: -${Math.random() * 30}s;
    `;
    container.appendChild(div);
  }
}

// ======= PIXEL ART WORLD =======
function initPixelWorld() {
  const el = $('pixelWorld');
  const palette = [
    '#4ade80','#22c55e','#16a34a', // grass
    '#92400e','#78350f','#854d0e', // dirt
    '#94a3b8','#64748b', // stone
    '#3b82f6','#60a5fa', // water
    '#fbbf24','#f59e0b', // sand
    '#166534','#14532d', // tree
    '#7c3aed', // ore
  ];
  const map = [
    0,0,0,0,0,0,0,0,
    0,0,12,12,0,0,0,0,
    3,3,12,12,3,3,0,0,
    4,3,4,3,4,3,3,0,
    5,5,5,5,5,5,5,5,
    7,7,7,7,7,7,7,7,
    7,7,7,6,7,7,7,7,
    9,9,9,9,9,9,9,9,
  ];
  map.forEach(i => {
    const px = document.createElement('div');
    px.style.cssText = `background:${palette[i]};`;
    el.appendChild(px);
  });
}

// ======= NAVIGATION =======
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  $(`view-${view}`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');

  if (view === 'avatar') renderAvatarCustomize('skin');
  if (view === 'settings') renderSettings();
}

// ======= DAILY QUESTS =======
function renderDailyQuests() {
  const el = $('dailyQuests');
  el.innerHTML = '';
  const streakBonus = state.streak * 5;

  DAILY_QUESTS.forEach((q, idx) => {
    const pct = Math.round((q.progress / q.max) * 100);
    const isDone = q.done;

    const div = document.createElement('div');
    div.className = 'quest-item' + (isDone ? ' quest-done' : '');
    div.innerHTML = `
      <div class="quest-icon" style="color:${isDone ? 'var(--green)' : 'var(--accent)'}">
        <svg><use href="#${q.icon}"/></svg>
      </div>
      <div class="quest-info">
        <div class="quest-name">${q.name}</div>
        <div class="quest-bar-wrap">
          <div class="quest-bar" style="width:${pct}%"></div>
        </div>
        <div class="quest-progress-text">${q.progress} / ${q.max}</div>
      </div>
      ${isDone
        ? `<div class="quest-check"><svg><use href="#icon-check"/></svg></div>`
        : `<div class="quest-reward"><svg><use href="#icon-gem"/></svg>${q.gems}</div>`
      }
    `;

    if (!isDone) {
      div.style.cursor = 'pointer';
      div.addEventListener('click', () => claimQuest(idx));
    }

    el.appendChild(div);
  });

  // Streak info
  $('streakCount').textContent = state.streak;
}

function claimQuest(idx) {
  const q = DAILY_QUESTS[idx];
  if (q.done) return;
  if (q.progress < q.max) {
    showToast(`⚠️ Quest not complete yet! (${q.progress}/${q.max})`);
    return;
  }
  q.done = true;
  const earned = q.gems + (state.streak * 5);
  updateGems(earned);
  showToast(`✅ Quest done! +${earned} NexGems (streak bonus: +${state.streak * 5})`);
  renderDailyQuests();
}

// ======= ACHIEVEMENTS =======
function renderAchievements() {
  const el = $('achievementList');
  el.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const div = document.createElement('div');
    div.className = 'achievement-item' + (a.unlocked ? '' : ' locked');
    div.innerHTML = `
      <div class="ach-icon" style="background:${a.unlocked ? 'rgba(250,204,21,0.15)' : 'var(--bg-dark)'}">
        ${a.icon}
      </div>
      <div class="ach-info">
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
      ${a.unlocked
        ? `<div class="ach-gems"><svg><use href="#icon-gem"/></svg>${a.gems}</div>`
        : `<div class="ach-lock"><svg><use href="#icon-lock"/></svg></div>`
      }
    `;
    el.appendChild(div);
  });
}

// ======= AVATAR CUSTOMIZATION =======
function initAvatarDrag() {
  const stage = document.querySelector('.avatar-stage');
  const avatar = $('avatar3d');
  let dragging = false, lastX = 0, rotY = 20;

  stage.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    rotY += dx * 0.8;
    avatar.style.transform = `rotateY(${rotY}deg)`;
    lastX = e.clientX;
  });

  // Touch
  stage.addEventListener('touchstart', e => { dragging = true; lastX = e.touches[0].clientX; });
  window.addEventListener('touchend', () => { dragging = false; });
  window.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - lastX;
    rotY += dx * 0.8;
    avatar.style.transform = `rotateY(${rotY}deg)`;
    lastX = e.touches[0].clientX;
  });
}

function applyAvatarColors() {
  $('avHead').style.background = state.avatar.skinColor;
  $('avBody').style.background = state.avatar.bodyColor;
  $('avArmL').style.background = state.avatar.skinColor;
  $('avArmR').style.background = state.avatar.skinColor;
  $('avLegL').style.background = state.avatar.legColor;
  $('avLegR').style.background = state.avatar.legColor;
}

function renderAvatarCustomize(tab) {
  const content = $('customizeContent');
  content.innerHTML = '';

  if (tab === 'skin') {
    content.innerHTML = `
      <div class="color-section">
        <div class="color-label">Skin Tone</div>
        <div class="color-grid" id="skinGrid"></div>
      </div>
      <div class="color-section">
        <div class="color-label">Hair Color</div>
        <div class="color-grid" id="hairGrid"></div>
      </div>
    `;
    renderColorGrid('skinGrid', SKIN_COLORS, 'skinColor');
    renderColorGrid('hairGrid', HAIR_COLORS, 'hairColor');
  }
  else if (tab === 'body') {
    content.innerHTML = `
      <div class="color-section">
        <div class="color-label">Shirt Color</div>
        <div class="color-grid" id="bodyGrid"></div>
      </div>
    `;
    renderColorGrid('bodyGrid', SHIRT_COLORS, 'bodyColor');
  }
  else if (tab === 'legs') {
    content.innerHTML = `
      <div class="color-section">
        <div class="color-label">Pants Color</div>
        <div class="color-grid" id="legGrid"></div>
      </div>
    `;
    renderColorGrid('legGrid', PANT_COLORS, 'legColor');
  }
  else if (tab === 'head') {
    content.innerHTML = `
      <div class="color-label" style="margin-bottom:12px">Head Accessories</div>
      <div class="item-grid" id="headGrid"></div>
    `;
    renderItemGrid('headGrid', HEAD_ITEMS, 'headAccessory');
  }
  else if (tab === 'extras') {
    content.innerHTML = `
      <div class="color-label" style="margin-bottom:12px">Extras & Pets</div>
      <div class="item-grid" id="extrasGrid"></div>
    `;
    renderItemGrid('extrasGrid', EXTRA_ITEMS, 'extras');
  }
}

function renderColorGrid(gridId, colors, prop) {
  const grid = $(gridId);
  colors.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (state.avatar[prop] === c ? ' selected' : '');
    sw.style.background = c;
    sw.title = c;
    sw.addEventListener('click', () => {
      state.avatar[prop] = c;
      applyAvatarColors();
      grid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    grid.appendChild(sw);
  });
}

function renderItemGrid(gridId, items, prop) {
  const grid = $(gridId);
  items.forEach(item => {
    const card = document.createElement('div');
    const owned = item.cost === 0 || state.gems >= item.cost;
    const isArray = Array.isArray(state.avatar[prop]);
    const isSelected = isArray
      ? state.avatar[prop].includes(item.id)
      : state.avatar[prop] === item.id;

    card.className = 'item-card' + (isSelected ? ' selected' : '') + (item.cost > 0 && state.gems < item.cost ? ' locked' : '');
    card.innerHTML = `
      <span>${item.emoji}</span>
      <div class="item-name">${item.name}</div>
      ${item.cost > 0
        ? `<div class="item-gem-badge"><svg style="width:7px;height:7px;fill:none;stroke:currentColor;stroke-width:2"><use href="#icon-gem"/></svg>${item.cost}</div>`
        : ''}
      ${item.cost > 0 && state.gems < item.cost
        ? `<div class="item-lock-overlay"><svg><use href="#icon-lock"/></svg></div>`
        : ''}
    `;

    card.addEventListener('click', () => {
      if (item.cost > 0 && state.gems < item.cost) {
        showToast(`❌ Need ${item.cost} NexGems — earn more via achievements!`);
        return;
      }
      if (isArray) {
        if (state.avatar[prop].includes(item.id)) {
          state.avatar[prop] = state.avatar[prop].filter(x => x !== item.id);
          card.classList.remove('selected');
        } else {
          state.avatar[prop].push(item.id);
          card.classList.add('selected');
        }
      } else {
        state.avatar[prop] = item.id;
        grid.querySelectorAll('.item-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }

      if (item.cost > 0 && !isSelected) {
        updateGems(-item.cost);
        showToast(`✅ Equipped ${item.name}!`);
      } else {
        showToast(`✅ Equipped ${item.name}!`);
      }
    });

    grid.appendChild(card);
  });
}

function initCustomizeTabs() {
  document.addEventListener('click', e => {
    const tab = e.target.closest('.ctab');
    if (!tab) return;
    document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderAvatarCustomize(tab.dataset.tab);
  });
}

// ======= SETTINGS =======
function renderSettings() {
  const container = $('settingsGroups');
  container.innerHTML = '';

  SETTINGS_GROUPS.forEach(group => {
    const div = document.createElement('div');
    div.className = 'settings-group';
    div.innerHTML = `<div class="settings-group-title">${group.title}</div>`;

    group.rows.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'setting-row';

      let control = '';
      if (row.type === 'toggle') {
        control = `<div class="toggle ${row.value ? 'on' : ''}" data-key="${row.label}"></div>`;
      } else if (row.type === 'slider') {
        control = `<input type="range" class="setting-slider" min="0" max="100" value="${row.value}">`;
      } else if (row.type === 'select') {
        control = `<select class="setting-select">${row.options.map(o => `<option${o===row.value?' selected':''}>${o}</option>`).join('')}</select>`;
      } else if (row.type === 'label') {
        control = `<span style="font-weight:700;font-size:13px;color:var(--text-secondary)">${row.value}</span>`;
      }

      rowEl.innerHTML = `
        <div style="flex:1">
          <div class="setting-label">${row.label}</div>
          ${row.desc ? `<div class="setting-desc">${row.desc}</div>` : ''}
        </div>
        ${control}
      `;

      // Toggle click
      const toggle = rowEl.querySelector('.toggle');
      if (toggle) {
        toggle.addEventListener('click', () => {
          toggle.classList.toggle('on');
          showToast(`${row.label} ${toggle.classList.contains('on') ? 'enabled' : 'disabled'}`);
        });
      }

      div.appendChild(rowEl);
    });

    container.appendChild(div);
  });
}

// ======= PLAY MODAL =======
function initPlayModal() {
  $('playBtn').addEventListener('click', () => {
    $('playModal').classList.add('open');
  });
  $('closeModal').addEventListener('click', () => {
    $('playModal').classList.remove('open');
  });
  $('playModal').addEventListener('click', e => {
    if (e.target === $('playModal')) $('playModal').classList.remove('open');
  });

  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedMode = card.dataset.mode;
    });
  });
  // Pre-select survival
  document.querySelector('[data-mode="survival"]').classList.add('selected');

  $('launchBtn').addEventListener('click', () => {
    $('playModal').classList.remove('open');
    showToast(`🚀 Launching NexusRealms — ${state.selectedMode.charAt(0).toUpperCase() + state.selectedMode.slice(1)} Mode!`);
  });
}

// ======= STREAK DISPLAY =======
function renderStreak() {
  const daily = 5 + (state.streak * 5);
  $('streakBadge').innerHTML = `
    <svg style="width:12px;height:12px"><use href="#icon-fire"/></svg>
    <span>${state.streak}</span>&nbsp;day streak
  `;
}

// ======= INIT =======
function init() {
  initBgBlocks();
  initPixelWorld();
  initNav();
  initPlayModal();
  initCustomizeTabs();
  initAvatarDrag();

  renderDailyQuests();
  renderAchievements();
  renderStreak();
  applyAvatarColors();

  // Animate daily quest bars on load
  setTimeout(() => {
    document.querySelectorAll('.quest-bar').forEach(b => {
      const w = b.style.width;
      b.style.width = '0';
      setTimeout(() => { b.style.width = w; }, 50);
    });
  }, 200);

  // Floating avatar body animation
  setInterval(() => {
    const av = $('avatar3d');
    if (!av) return;
    const now = Date.now() / 1000;
    const bob = Math.sin(now * 1.5) * 3;
    av.style.marginTop = `${bob}px`;
  }, 16);

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if (e.key === '1') switchView('home');
    if (e.key === '2') switchView('avatar');
    if (e.key === '3') switchView('settings');
    if (e.key === 'Escape') $('playModal').classList.remove('open');
  });

  console.log('🎮 NexusRealms launcher initialized!');
  console.log('Shortcuts: 1=Home, 2=Avatar, 3=Settings, Esc=Close modal');
}

document.addEventListener('DOMContentLoaded', init);

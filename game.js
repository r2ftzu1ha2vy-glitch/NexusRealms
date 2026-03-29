/* ============================================================
   NEXUSREALMS — game.js
   Full 3D voxel game engine (Three.js)
   Features: terrain gen, mining, placing, inventory,
             survival, mobs, day/night, crafting
   ============================================================ */

const NexusGame = (() => {

// ── BLOCK IDs ─────────────────────────────────────────────
const B = {
  AIR:0, GRASS:1, DIRT:2, STONE:3, SAND:4, WOOD:5,
  LEAVES:6, WATER:7, COAL:8, IRON:9, GOLD:10,
  DIAMOND:11, BEDROCK:12, PLANKS:13, GLASS:14,
  CRAFTING:15, FURNACE:16, SNOW:17, GRAVEL:18,
};

const BLOCK_DATA = {
  [B.GRASS]:   { name:'Grass',    color:0x55aa33, top:0x77cc44, side:0x55aa33, hard:1, drop:B.DIRT },
  [B.DIRT]:    { name:'Dirt',     color:0x8B5E3C, hard:1 },
  [B.STONE]:   { name:'Stone',    color:0x888888, hard:3, drop:B.GRAVEL },
  [B.SAND]:    { name:'Sand',     color:0xE8D49B, hard:1 },
  [B.WOOD]:    { name:'Wood',     color:0x8B6914, hard:2, drop:B.PLANKS, dropAmt:4 },
  [B.LEAVES]:  { name:'Leaves',   color:0x228B22, hard:0.5, transparent:true },
  [B.WATER]:   { name:'Water',    color:0x2266CC, hard:0, transparent:true, liquid:true },
  [B.COAL]:    { name:'Coal Ore', color:0x444444, hard:4 },
  [B.IRON]:    { name:'Iron Ore', color:0xAA8866, hard:4 },
  [B.GOLD]:    { name:'Gold Ore', color:0xFFCC00, hard:5 },
  [B.DIAMOND]: { name:'Diamond',  color:0x44DDDD, hard:6 },
  [B.BEDROCK]: { name:'Bedrock',  color:0x222222, hard:999 },
  [B.PLANKS]:  { name:'Planks',   color:0xC8A96A, hard:1.5 },
  [B.GLASS]:   { name:'Glass',    color:0xAACCFF, hard:0.5, transparent:true },
  [B.CRAFTING]:{ name:'Crafting Table', color:0x8B4513, hard:2 },
  [B.FURNACE]: { name:'Furnace',  color:0x666666, hard:3 },
  [B.SNOW]:    { name:'Snow',     color:0xEEEEFF, hard:0.5 },
  [B.GRAVEL]:  { name:'Gravel',   color:0x999999, hard:0.8 },
};

// ── WORLD CONSTANTS ───────────────────────────────────────
const CHUNK_W = 16, CHUNK_H = 64, CHUNK_D = 16;
const RENDER_DIST = 3;
const SEA_LEVEL = 20;
const MAX_HEIGHT = 48;

// ── GAME STATE ────────────────────────────────────────────
let scene, camera, renderer, canvas, clock;
let world = {};           // key="cx,cz" => Uint8Array chunk
let chunkMeshes = {};
let playerPos, playerVel;
let yaw = 0, pitch = 0;
let onGround = false;
let keys = {};
let mouse = { locked: false };
let hp = 20, maxHp = 20;
let hunger = 20, maxHunger = 20;
let inventory = [];
let hotbar = Array(9).fill(null);
let hotbarSel = 0;
let gameMode = 'survival';
let dayTime = 0.25; // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
let daySpeed = 0.0002;
let mobs = [];
let particles = [];
let running = false;
let paused = false;

// UI refs
let uiEl, hpBarEl, hungerBarEl, hotbarEl, crosshairEl;
let coordsEl, dayEl, pauseEl, deathEl, craftingEl;
let breakProgress = 0, breakTarget = null, breakTimer = 0;
let placeDelay = 0;
let sunLight, ambientLight, skyMesh;
let lastMobSpawn = 0;

// ── NOISE (simple) ────────────────────────────────────────
function hash(x, z) {
  let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx*fx*(3-2*fx), uz = fz*fz*(3-2*fz);
  return (
    hash(ix,iz)*(1-ux)*(1-uz) +
    hash(ix+1,iz)*ux*(1-uz) +
    hash(ix,iz+1)*(1-ux)*uz +
    hash(ix+1,iz+1)*ux*uz
  );
}
function octaveNoise(x, z, octs=4) {
  let v=0, amp=1, freq=1, max=0;
  for(let i=0;i<octs;i++){
    v += smoothNoise(x*freq, z*freq)*amp;
    max += amp; amp*=0.5; freq*=2;
  }
  return v/max;
}

// ── CHUNK VOXEL HELPERS ───────────────────────────────────
function chunkKey(cx, cz) { return `${cx},${cz}`; }

function getChunk(cx, cz) {
  const k = chunkKey(cx, cz);
  if (!world[k]) world[k] = generateChunk(cx, cz);
  return world[k];
}

function getBlock(wx, wy, wz) {
  if (wy < 0 || wy >= CHUNK_H) return wy < 0 ? B.BEDROCK : B.AIR;
  const cx = Math.floor(wx / CHUNK_W);
  const cz = Math.floor(wz / CHUNK_D);
  const lx = ((wx % CHUNK_W) + CHUNK_W) % CHUNK_W;
  const lz = ((wz % CHUNK_D) + CHUNK_D) % CHUNK_D;
  const chunk = world[chunkKey(cx, cz)];
  if (!chunk) return B.AIR;
  return chunk[lx + lz*CHUNK_W + wy*CHUNK_W*CHUNK_D];
}

function setBlock(wx, wy, wz, id) {
  if (wy < 0 || wy >= CHUNK_H) return;
  const cx = Math.floor(wx / CHUNK_W);
  const cz = Math.floor(wz / CHUNK_D);
  const lx = ((wx % CHUNK_W) + CHUNK_W) % CHUNK_W;
  const lz = ((wz % CHUNK_D) + CHUNK_D) % CHUNK_D;
  const k = chunkKey(cx, cz);
  if (!world[k]) world[k] = generateChunk(cx, cz);
  world[k][lx + lz*CHUNK_W + wy*CHUNK_W*CHUNK_D] = id;
  rebuildChunk(cx, cz);
  // Rebuild neighbors if on edge
  if (lx === 0) rebuildChunk(cx-1, cz);
  if (lx === CHUNK_W-1) rebuildChunk(cx+1, cz);
  if (lz === 0) rebuildChunk(cx, cz-1);
  if (lz === CHUNK_D-1) rebuildChunk(cx, cz+1);
}

// ── WORLD GENERATION ──────────────────────────────────────
function generateChunk(cx, cz) {
  const data = new Uint8Array(CHUNK_W * CHUNK_H * CHUNK_D);
  for (let lx = 0; lx < CHUNK_W; lx++) {
    for (let lz = 0; lz < CHUNK_D; lz++) {
      const wx = cx * CHUNK_W + lx;
      const wz = cz * CHUNK_D + lz;
      const n = octaveNoise(wx * 0.03, wz * 0.03);
      const h = Math.floor(SEA_LEVEL + n * 20);
      for (let y = 0; y < CHUNK_H; y++) {
        const idx = lx + lz*CHUNK_W + y*CHUNK_W*CHUNK_D;
        if (y === 0) { data[idx] = B.BEDROCK; continue; }
        if (y > h) {
          data[idx] = (y <= SEA_LEVEL) ? B.WATER : B.AIR;
          continue;
        }
        if (y === h) {
          data[idx] = (h <= SEA_LEVEL+1) ? B.SAND : (h >= MAX_HEIGHT-4 ? B.SNOW : B.GRASS);
        } else if (y > h - 4) {
          data[idx] = (h <= SEA_LEVEL+1) ? B.SAND : B.DIRT;
        } else {
          // Ores
          const oreR = hash(wx*17+y*31, wz*13+y*7);
          if (y < 10 && oreR < 0.015) data[idx] = B.DIAMOND;
          else if (y < 20 && oreR < 0.04) data[idx] = B.GOLD;
          else if (y < 35 && oreR < 0.08) data[idx] = B.IRON;
          else if (oreR < 0.12) data[idx] = B.COAL;
          else data[idx] = B.STONE;
        }
      }
      // Trees
      if (h > SEA_LEVEL+2 && h < MAX_HEIGHT-5) {
        const treeR = hash(wx*73, wz*137);
        if (treeR < 0.025) {
          for (let ty = h+1; ty <= h+5; ty++) {
            const idx2 = lx + lz*CHUNK_W + ty*CHUNK_W*CHUNK_D;
            if (ty < CHUNK_H) data[idx2] = B.WOOD;
          }
          for (let ly2 = -2; ly2 <= 2; ly2++) {
            for (let lz2 = -2; lz2 <= 2; lz2++) {
              for (let ly3 = h+3; ly3 <= h+6; ly3++) {
                if (Math.abs(ly2)+Math.abs(lz2) > 3) continue;
                const nx = lx+ly2, nz = lz+lz2;
                if (nx>=0 && nx<CHUNK_W && nz>=0 && nz<CHUNK_D && ly3<CHUNK_H) {
                  const idx3 = nx + nz*CHUNK_W + ly3*CHUNK_W*CHUNK_D;
                  if (data[idx3] === B.AIR) data[idx3] = B.LEAVES;
                }
              }
            }
          }
        }
      }
    }
  }
  return data;
}

// ── MESH BUILDING ─────────────────────────────────────────
const FACES = [
  { dir:[0,1,0],  verts:[[0,1,0],[1,1,0],[1,1,1],[0,1,1]], uv:true },   // top
  { dir:[0,-1,0], verts:[[0,0,1],[1,0,1],[1,0,0],[0,0,0]], uv:true },   // bottom
  { dir:[0,0,1],  verts:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], uv:true },   // front
  { dir:[0,0,-1], verts:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], uv:true },   // back
  { dir:[1,0,0],  verts:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]], uv:true },   // right
  { dir:[-1,0,0], verts:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]], uv:true },   // left
];

function buildChunkMesh(cx, cz) {
  const positions = [], colors = [], indices = [];
  let vi = 0;

  for (let lx = 0; lx < CHUNK_W; lx++) {
    for (let ly = 0; ly < CHUNK_H; ly++) {
      for (let lz = 0; lz < CHUNK_D; lz++) {
        const wx = cx*CHUNK_W+lx, wy=ly, wz=cz*CHUNK_D+lz;
        const bid = getBlock(wx, wy, wz);
        if (bid === B.AIR || bid === B.WATER) continue;
        const bd = BLOCK_DATA[bid] || {};
        const baseCol = new THREE.Color(bd.color || 0xffffff);

        FACES.forEach(face => {
          const [dx,dy,dz] = face.dir;
          const nb = getBlock(wx+dx, wy+dy, wz+dz);
          const nbData = BLOCK_DATA[nb] || {};
          // Skip face if solid neighbor (unless neighbor is transparent)
          if (nb !== B.AIR && nb !== B.WATER && !nbData.transparent && !bd.transparent) return;
          if (bd.transparent && nb === bid) return; // same transparent block

          // Brightness by face direction
          const bright = dy===1 ? 1.0 : dy===-1 ? 0.5 : [0,0,1].includes(Math.abs(dx)+Math.abs(dz)) ? 0.75 : 0.6;

          face.verts.forEach(([vx,vy,vz]) => {
            positions.push(lx+vx, ly+vy, lz+vz);
            // top face grass color
            let fc = baseCol.clone();
            if (bid===B.GRASS && dy===1) fc.setHex(bd.top||bd.color);
            fc.multiplyScalar(bright);
            colors.push(fc.r, fc.g, fc.b);
          });

          indices.push(vi,vi+1,vi+2, vi,vi+2,vi+3);
          vi += 4;
        });
      }
    }
  }

  if (positions.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx*CHUNK_W, 0, cz*CHUNK_D);
  return mesh;
}

function rebuildChunk(cx, cz) {
  const k = chunkKey(cx, cz);
  if (chunkMeshes[k]) { scene.remove(chunkMeshes[k]); chunkMeshes[k].geometry.dispose(); }
  if (!world[k]) return;
  const mesh = buildChunkMesh(cx, cz);
  if (mesh) { scene.add(mesh); chunkMeshes[k] = mesh; }
}

// ── CHUNK MANAGEMENT ──────────────────────────────────────
let lastPlayerChunk = { cx: null, cz: null };

function updateChunks() {
  const pcx = Math.floor(playerPos.x / CHUNK_W);
  const pcz = Math.floor(playerPos.z / CHUNK_D);
  if (pcx === lastPlayerChunk.cx && pcz === lastPlayerChunk.cz) return;
  lastPlayerChunk = { cx: pcx, cz: pcz };

  // Load needed chunks
  for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      const cx = pcx+dx, cz = pcz+dz;
      const k = chunkKey(cx, cz);
      if (!world[k]) {
        world[k] = generateChunk(cx, cz);
        rebuildChunk(cx, cz);
      }
    }
  }

  // Unload far chunks
  Object.keys(chunkMeshes).forEach(k => {
    const [cx, cz] = k.split(',').map(Number);
    if (Math.abs(cx-pcx) > RENDER_DIST+1 || Math.abs(cz-pcz) > RENDER_DIST+1) {
      scene.remove(chunkMeshes[k]);
      chunkMeshes[k].geometry.dispose();
      delete chunkMeshes[k];
    }
  });
}

// ── SKY & LIGHTING ────────────────────────────────────────
function initSky() {
  // Sky sphere
  const skyGeo = new THREE.SphereGeometry(400, 16, 16);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
  // Add gradient colors to vertices
  const skyColors = [];
  const posArr = skyGeo.attributes.position.array;
  for (let i = 0; i < posArr.length; i += 3) {
    const y = posArr[i+1];
    const t = (y + 400) / 800;
    skyColors.push(t*0.5, t*0.7, 1.0);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  // Sun light
  sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  sunLight.position.set(100, 200, 100);
  scene.add(sunLight);

  ambientLight = new THREE.AmbientLight(0x88aacc, 0.5);
  scene.add(ambientLight);
}

function updateSky() {
  dayTime = (dayTime + daySpeed) % 1.0;
  const t = dayTime;

  // Sun position (arc)
  const angle = (t - 0.25) * Math.PI * 2;
  sunLight.position.set(Math.cos(angle)*200, Math.sin(angle)*200, 50);

  // Brightness
  let brightness = 0;
  if (t > 0.2 && t < 0.8) brightness = Math.sin((t-0.2)/(0.6)*Math.PI);
  sunLight.intensity = brightness * 1.2;
  ambientLight.intensity = 0.15 + brightness * 0.5;

  // Sky color
  let sky, fog;
  if (t < 0.2 || t > 0.85) {
    sky = new THREE.Color(0x050a1a); fog = new THREE.Color(0x0a0a1a);
  } else if (t < 0.28 || t > 0.75) {
    // Dawn/dusk
    sky = new THREE.Color(0xff6633).lerp(new THREE.Color(0x336699), brightness);
    fog = new THREE.Color(0xff4422).lerp(new THREE.Color(0x224466), brightness);
  } else {
    sky = new THREE.Color(0x4488ff); fog = new THREE.Color(0x6699cc);
  }
  renderer.setClearColor(sky);
  scene.fog = new THREE.Fog(fog, 40, 120);

  // Day display
  const hour = Math.floor(t * 24);
  const min = Math.floor((t*24 - hour)*60);
  if (dayEl) dayEl.textContent = `☀ ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

// ── PLAYER PHYSICS ────────────────────────────────────────
const GRAVITY = -28;
const JUMP_VEL = 9;
const SPEED = gameMode === 'creative' ? 12 : 5;
const PLAYER_H = 1.8;
const PLAYER_R = 0.3;

function isSolid(wx, wy, wz) {
  const b = getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz));
  return b !== B.AIR && b !== B.WATER && b !== B.LEAVES;
}

function playerAABB() {
  return {
    minX: playerPos.x - PLAYER_R, maxX: playerPos.x + PLAYER_R,
    minY: playerPos.y,            maxY: playerPos.y + PLAYER_H,
    minZ: playerPos.z - PLAYER_R, maxZ: playerPos.z + PLAYER_R,
  };
}

function checkCollision(nx, ny, nz) {
  const r = PLAYER_R;
  const checks = [
    [nx-r,ny,nz-r],[nx+r,ny,nz-r],[nx-r,ny,nz+r],[nx+r,ny,nz+r],
    [nx-r,ny+1,nz-r],[nx+r,ny+1,nz-r],[nx-r,ny+1,nz+r],[nx+r,ny+1,nz+r],
  ];
  return checks.some(([x,y,z]) => isSolid(x,y,z));
}

function updatePlayer(dt) {
  if (paused) return;
  const speed = gameMode === 'creative' ? 12 : (keys['ShiftLeft'] ? 8 : 5);

  // Movement direction
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys['KeyW']) move.add(fwd);
  if (keys['KeyS']) move.sub(fwd);
  if (keys['KeyA']) move.sub(right);
  if (keys['KeyD']) move.add(right);
  if (move.length() > 0) move.normalize().multiplyScalar(speed);

  playerVel.x = move.x;
  playerVel.z = move.z;

  if (gameMode === 'creative') {
    if (keys['Space']) playerVel.y = 8;
    else if (keys['ShiftLeft']) playerVel.y = -8;
    else playerVel.y = 0;
  } else {
    // Gravity
    playerVel.y += GRAVITY * dt;
    if (playerVel.y < -40) playerVel.y = -40;
  }

  // Move X
  let nx = playerPos.x + playerVel.x * dt;
  if (!checkCollision(nx, playerPos.y, playerPos.z)) playerPos.x = nx;
  else playerVel.x = 0;

  // Move Z
  let nz = playerPos.z + playerVel.z * dt;
  if (!checkCollision(playerPos.x, playerPos.y, nz)) playerPos.z = nz;
  else playerVel.z = 0;

  // Move Y
  let ny = playerPos.y + playerVel.y * dt;
  if (playerVel.y < 0) {
    if (checkCollision(playerPos.x, ny, playerPos.z)) {
      playerPos.y = Math.ceil(ny);
      playerVel.y = 0;
      onGround = true;
    } else { playerPos.y = ny; onGround = false; }
  } else {
    if (checkCollision(playerPos.x, ny + PLAYER_H, playerPos.z)) playerVel.y = 0;
    else { playerPos.y = ny; }
    onGround = false;
  }

  // Void death
  if (playerPos.y < -10) {
    hp = 0;
    checkDeath();
  }

  // Water slow
  const inWater = getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y), Math.floor(playerPos.z)) === B.WATER;
  if (inWater && playerVel.y < -3) playerVel.y = -3;

  // Camera
  camera.position.set(playerPos.x, playerPos.y + PLAYER_H - 0.1, playerPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Update coords
  if (coordsEl) {
    coordsEl.textContent = `X:${Math.floor(playerPos.x)} Y:${Math.floor(playerPos.y)} Z:${Math.floor(playerPos.z)}`;
  }
}

// ── RAYCASTING ────────────────────────────────────────────
function raycast() {
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

  const origin = camera.position.clone();
  let prev = null;
  const step = 0.05;
  for (let d = 0; d < 6; d += step) {
    const p = origin.clone().addScaledVector(dir, d);
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const b = getBlock(bx, by, bz);
    if (b !== B.AIR && b !== B.WATER) {
      return { hit: true, bx, by, bz, block: b, prev };
    }
    prev = { bx, by, bz };
  }
  return { hit: false };
}

// ── BREAKING / PLACING ────────────────────────────────────
function updateBreaking(dt) {
  if (paused || !mouse.locked) return;
  const rc = raycast();

  if (mouse.breaking && rc.hit) {
    if (breakTarget && (breakTarget.bx!==rc.bx || breakTarget.by!==rc.by || breakTarget.bz!==rc.bz)) {
      breakProgress = 0;
    }
    breakTarget = rc;
    const bd = BLOCK_DATA[rc.block] || {};
    if (bd.hard === 999) return; // bedrock
    const speed = gameMode === 'creative' ? 100 : 1;
    breakProgress += dt * speed / (bd.hard || 1);
    updateBreakOverlay(breakProgress / 1.0);
    if (breakProgress >= 1.0) {
      breakProgress = 0;
      const drop = bd.drop || rc.block;
      const amt = bd.dropAmt || 1;
      addToInventory(drop, amt);
      updateQuestProgress('mine');
      setBlock(rc.bx, rc.by, rc.bz, B.AIR);
      spawnBreakParticles(rc.bx+0.5, rc.by+0.5, rc.bz+0.5, bd.color||0xaaaaaa);
      breakTarget = null;
    }
  } else {
    breakProgress = 0;
    breakTarget = null;
    updateBreakOverlay(0);
  }

  if (placeDelay > 0) placeDelay -= dt;
}

let breakOverlay;
function updateBreakOverlay(pct) {
  if (!breakOverlay) return;
  breakOverlay.style.opacity = pct > 0 ? 0.5 + pct*0.5 : 0;
  breakOverlay.style.transform = `scaleX(${pct})`;
}

function placeBlock() {
  if (paused || placeDelay > 0 || !mouse.locked) return;
  const rc = raycast();
  if (!rc.hit || !rc.prev) return;
  const {bx, by, bz} = rc.prev;

  // Don't place inside player
  const ab = playerAABB();
  if (bx+1>ab.minX && bx<ab.maxX && by+1>ab.minY && by<ab.maxY && bz+1>ab.minZ && bz<ab.maxZ) return;

  const item = hotbar[hotbarSel];
  if (!item || item.count <= 0) return;
  setBlock(bx, by, bz, item.id);
  updateQuestProgress('build');
  item.count--;
  if (item.count <= 0) hotbar[hotbarSel] = null;
  renderHotbar();
  placeDelay = 0.25;
}

// ── INVENTORY ─────────────────────────────────────────────
function addToInventory(id, count=1) {
  // Try to stack
  const existing = inventory.find(i => i && i.id === id);
  if (existing) { existing.count += count; }
  else {
    const slot = inventory.findIndex(i => !i);
    if (slot !== -1) inventory[slot] = { id, count };
    else inventory.push({ id, count });
  }
  renderInventory();
}

function renderInventory() {
  const el = document.getElementById('inv-grid');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < 27; i++) {
    const item = inventory[i];
    const slot = document.createElement('div');
    slot.className = 'inv-slot' + (item ? ' has-item' : '');
    if (item) {
      const bd = BLOCK_DATA[item.id];
      const col = bd ? '#' + (bd.color).toString(16).padStart(6,'0') : '#888';
      slot.innerHTML = `<div class="inv-block" style="background:${col}"></div><span class="inv-count">${item.count}</span>`;
      slot.title = bd ? bd.name : '?';
      slot.addEventListener('click', () => moveToHotbar(i));
    }
    el.appendChild(slot);
  }
}

function moveToHotbar(invIdx) {
  const item = inventory[invIdx];
  if (!item) return;
  // Find empty hotbar slot
  const hs = hotbar.findIndex(h => !h);
  if (hs !== -1) {
    hotbar[hs] = { ...item };
    inventory[invIdx] = null;
    renderHotbar();
    renderInventory();
    showGameToast(`Moved ${BLOCK_DATA[item.id]?.name} to hotbar slot ${hs+1}`);
  }
}

function renderHotbar() {
  const slots = document.querySelectorAll('.hb-slot');
  slots.forEach((sl, i) => {
    sl.classList.toggle('selected', i === hotbarSel);
    const item = hotbar[i];
    const inner = sl.querySelector('.hb-inner');
    if (!inner) return;
    if (item) {
      const bd = BLOCK_DATA[item.id];
      const col = bd ? '#' + (bd.color).toString(16).padStart(6,'0') : '#888';
      inner.innerHTML = `<div class="hb-block" style="background:${col}"></div><span class="hb-count">${item.count}</span>`;
      sl.title = bd ? bd.name : '?';
    } else {
      inner.innerHTML = '';
      sl.title = '';
    }
  });
}

// ── MOBS ──────────────────────────────────────────────────
const MOB_TYPES = [
  { name:'Zombie',  color:0x336633, hp:20, speed:1.5, dmg:2, emoji:'🧟', hostile:true },
  { name:'Creeper', color:0x338833, hp:20, speed:1.8, dmg:5, emoji:'💚', hostile:true },
  { name:'Cow',     color:0xddbbaa, hp:10, speed:1.0, dmg:0, emoji:'🐄', hostile:false },
  { name:'Sheep',   color:0xeeeeee, hp:8,  speed:1.0, dmg:0, emoji:'🐑', hostile:false },
];

function spawnMob() {
  if (mobs.length >= 10) return;
  const angle = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * 20;
  const mx = playerPos.x + Math.cos(angle)*dist;
  const mz = playerPos.z + Math.sin(angle)*dist;
  // Find surface
  let my = MAX_HEIGHT;
  for (let y = MAX_HEIGHT; y > 0; y--) {
    if (getBlock(Math.floor(mx), y, Math.floor(mz)) !== B.AIR) { my = y+1; break; }
  }
  const type = MOB_TYPES[Math.floor(Math.random()*MOB_TYPES.length)];
  // At night only spawn hostile mobs unless daytime
  if (dayTime > 0.25 && dayTime < 0.75 && type.hostile && Math.random() > 0.15) return;

  const geo = new THREE.BoxGeometry(0.8, 1.6, 0.8);
  const mat = new THREE.MeshLambertMaterial({ color: type.color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(mx, my+0.8, mz);
  scene.add(mesh);

  mobs.push({
    type, mesh,
    pos: new THREE.Vector3(mx, my, mz),
    vel: new THREE.Vector3(),
    hp: type.hp, maxHp: type.hp,
    attackTimer: 0,
    label: null,
  });
}

function updateMobs(dt) {
  const now = performance.now();
  if (now - lastMobSpawn > 3000) { spawnMob(); lastMobSpawn = now; }

  mobs = mobs.filter(mob => {
    if (mob.hp <= 0) {
      scene.remove(mob.mesh);
      // Drop loot
      if (mob.type.name === 'Zombie') addToInventory(B.DIRT, 1);
      if (mob.type.name === 'Cow') addToInventory(B.PLANKS, 2);
      updateQuestProgress('kill');
      return false;
    }

    const dx = playerPos.x - mob.pos.x;
    const dz = playerPos.z - mob.pos.z;
    const dist = Math.sqrt(dx*dx+dz*dz);

    if (mob.type.hostile && dist < 20) {
      // Chase player
      const spd = mob.type.speed;
      mob.vel.x = (dx/dist)*spd;
      mob.vel.z = (dz/dist)*spd;
    } else {
      // Wander
      mob.vel.x += (Math.random()-0.5)*0.5;
      mob.vel.z += (Math.random()-0.5)*0.5;
      mob.vel.x *= 0.95; mob.vel.z *= 0.95;
    }

    // Simple gravity
    const my = Math.floor(mob.pos.y-0.1);
    if (getBlock(Math.floor(mob.pos.x), my, Math.floor(mob.pos.z)) === B.AIR) mob.vel.y -= 20*dt;
    else mob.vel.y = 0;

    mob.pos.x += mob.vel.x*dt;
    mob.pos.y += mob.vel.y*dt;
    mob.pos.z += mob.vel.z*dt;
    mob.pos.y = Math.max(mob.pos.y, 0);

    mob.mesh.position.set(mob.pos.x, mob.pos.y+0.8, mob.pos.z);
    mob.mesh.rotation.y = Math.atan2(dx, dz);

    // Attack player
    if (mob.type.hostile && dist < 1.5) {
      mob.attackTimer += dt;
      if (mob.attackTimer > 1.0) {
        mob.attackTimer = 0;
        if (gameMode === 'survival') {
          hp = Math.max(0, hp - mob.type.dmg);
          updateHUD();
          flashDamage();
          checkDeath();
        }
      }
    }
    return true;
  });
}

function hitMob() {
  // Raycast to find mob
  const dir = new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  const origin = camera.position.clone();
  for (const mob of mobs) {
    const toMob = mob.mesh.position.clone().sub(origin);
    const dot = toMob.dot(dir);
    if (dot < 0 || dot > 4) continue;
    const perp = toMob.clone().sub(dir.clone().multiplyScalar(dot));
    if (perp.length() < 1.0) {
      mob.hp -= 5;
      showGameToast(`Hit ${mob.type.emoji} ${mob.type.name}! HP: ${mob.hp}/${mob.maxHp}`);
      spawnBreakParticles(mob.mesh.position.x, mob.mesh.position.y, mob.mesh.position.z, 0xff0000);
      return;
    }
  }
}

// ── PARTICLES ─────────────────────────────────────────────
function spawnBreakParticles(x, y, z, color) {
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random()-0.5)*6, Math.random()*6+2, (Math.random()-0.5)*6),
      life: 0.8,
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter(p => {
    p.life -= dt;
    p.vel.y -= 20*dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += 5*dt;
    p.mesh.rotation.z += 3*dt;
    const s = Math.max(0.01, p.life);
    p.mesh.scale.setScalar(s);
    if (p.life <= 0) { scene.remove(p.mesh); return false; }
    return true;
  });
}

// ── HUD ───────────────────────────────────────────────────
function updateHUD() {
  // HP
  const hpPct = hp / maxHp;
  const hpBar = document.getElementById('hp-bar');
  if (hpBar) {
    hpBar.style.width = (hpPct*100)+'%';
    hpBar.style.background = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
  }
  // Hunger
  const hunPct = hunger / maxHunger;
  const hunBar = document.getElementById('hunger-bar');
  if (hunBar) hunBar.style.width = (hunPct*100)+'%';
}

let damageFlashEl;
function flashDamage() {
  if (!damageFlashEl) return;
  damageFlashEl.style.opacity = '0.4';
  setTimeout(() => { damageFlashEl.style.opacity = '0'; }, 200);
}

function checkDeath() {
  if (hp <= 0 && gameMode === 'survival') {
    paused = true;
    const de = document.getElementById('death-screen');
    if (de) de.style.display = 'flex';
  }
}

function respawn() {
  hp = maxHp; hunger = maxHunger;
  playerPos.set(8, MAX_HEIGHT+5, 8);
  playerVel.set(0,0,0);
  paused = false;
  const de = document.getElementById('death-screen');
  if (de) de.style.display = 'none';
  updateHUD();
}

// ── QUEST TRACKING ────────────────────────────────────────
function updateQuestProgress(type) {
  // Hook into launcher quests if available
  try {
    if (type === 'mine') {
      const q = window.NEXUS_QUESTS?.find(q => q.id === 'd1');
      if (q && !q.done) { q.progress = Math.min(q.max, q.progress+1); window.renderDailyQuests?.(); }
    }
    if (type === 'build') {
      const q = window.NEXUS_QUESTS?.find(q => q.id === 'd4');
      if (q && !q.done) { q.progress = Math.min(q.max, q.progress+1); window.renderDailyQuests?.(); }
    }
    if (type === 'kill') {
      const q = window.NEXUS_QUESTS?.find(q => q.id === 'd5');
      if (q && !q.done) { q.progress = Math.min(q.max, q.progress+1); window.renderDailyQuests?.(); }
    }
  } catch(e) {}
}

// ── GAME TOAST ────────────────────────────────────────────
let gameToastEl;
function showGameToast(msg) {
  if (!gameToastEl) return;
  gameToastEl.textContent = msg;
  gameToastEl.style.opacity = '1';
  clearTimeout(gameToastEl._timer);
  gameToastEl._timer = setTimeout(() => { gameToastEl.style.opacity = '0'; }, 2000);
}

// ── HUNGER TICK ───────────────────────────────────────────
let hungerTick = 0;
function updateHunger(dt) {
  if (gameMode !== 'survival') return;
  hungerTick += dt;
  if (hungerTick > 30) {
    hungerTick = 0;
    hunger = Math.max(0, hunger-1);
    if (hunger === 0) hp = Math.max(1, hp-1);
    updateHUD();
  }
}

// ── GAME LOOP ─────────────────────────────────────────────
function gameLoop() {
  if (!running) return;
  requestAnimationFrame(gameLoop);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (!paused) {
    updatePlayer(dt);
    updateChunks();
    updateSky();
    updateMobs(dt);
    updateParticles(dt);
    updateBreaking(dt);
    updateHunger(dt);
  }

  renderer.render(scene, camera);
}

// ── INPUT ─────────────────────────────────────────────────
function initInput() {
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (!mouse.locked) return;

    if (e.code === 'Escape') togglePause();
    if (e.code === 'KeyE') toggleInventory();
    if (e.code === 'Space' && onGround && gameMode !== 'creative') {
      playerVel.y = JUMP_VEL;
      onGround = false;
    }
    if (e.code === 'KeyF') {
      // Eat (if has food-like block in hand)
      if (hunger < maxHunger) {
        hunger = Math.min(maxHunger, hunger+3);
        updateHUD();
        showGameToast('🍖 Munched something. Hunger restored!');
      }
    }
    // Hotbar keys 1-9
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.replace('Digit','')) - 1;
      if (n >= 0 && n < 9) { hotbarSel = n; renderHotbar(); }
    }
  });

  document.addEventListener('keyup', e => { keys[e.code] = false; });

  canvas.addEventListener('mousedown', e => {
    if (!mouse.locked) { canvas.requestPointerLock(); return; }
    if (e.button === 0) { mouse.breaking = true; hitMob(); }
    if (e.button === 2) placeBlock();
  });
  canvas.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.breaking = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousemove', e => {
    if (!mouse.locked) return;
    const sens = 0.002;
    yaw -= e.movementX * sens;
    pitch -= e.movementY * sens;
    pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, pitch));
  });

  canvas.addEventListener('wheel', e => {
    hotbarSel = (hotbarSel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
    renderHotbar();
  });

  document.addEventListener('pointerlockchange', () => {
    mouse.locked = !!document.pointerLockElement;
    const hint = document.getElementById('click-hint');
    if (hint) hint.style.display = mouse.locked ? 'none' : 'flex';
  });
}

function togglePause() {
  if (document.getElementById('death-screen')?.style.display === 'flex') return;
  paused = !paused;
  const pm = document.getElementById('pause-menu');
  if (pm) pm.style.display = paused ? 'flex' : 'none';
  if (paused) document.exitPointerLock();
}

function toggleInventory() {
  const inv = document.getElementById('inventory-panel');
  if (!inv) return;
  const open = inv.style.display === 'flex';
  inv.style.display = open ? 'none' : 'flex';
  if (open) { canvas.requestPointerLock(); }
  else { document.exitPointerLock(); paused = true; }
  renderInventory();
}

// ── STARTER INVENTORY ─────────────────────────────────────
function giveStarterItems() {
  hotbar[0] = { id: B.PLANKS, count: 64 };
  hotbar[1] = { id: B.STONE, count: 32 };
  hotbar[2] = { id: B.GLASS, count: 16 };
  hotbar[3] = { id: B.SAND, count: 32 };
  hotbar[4] = { id: B.WOOD, count: 20 };
  hotbar[5] = { id: B.DIRT, count: 64 };
  hotbar[6] = { id: B.LEAVES, count: 32 };
  hotbar[7] = { id: B.CRAFTING, count: 1 };
  hotbar[8] = { id: B.COAL, count: 10 };
  renderHotbar();
}

// ── BUILD GAME UI ─────────────────────────────────────────
function buildGameUI(container) {
  container.innerHTML = `
  <div id="game-wrap" style="position:relative;width:100%;height:100%;">
    <canvas id="game-canvas" style="display:block;width:100%;height:100%;"></canvas>

    <!-- Click to start -->
    <div id="click-hint" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);color:#fff;gap:12px;font-family:'Nunito',sans-serif;z-index:20;">
      <div style="font-size:28px;font-weight:900;">Click to Play</div>
      <div style="font-size:13px;color:#94a3b8;">WASD move · Mouse look · Left click break · Right click place · E inventory · F eat · Esc pause</div>
    </div>

    <!-- Damage flash -->
    <div id="damage-flash" style="position:absolute;inset:0;background:red;opacity:0;pointer-events:none;transition:opacity 0.15s;z-index:5;"></div>

    <!-- Crosshair -->
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;">
      <div style="width:20px;height:20px;position:relative;">
        <div style="position:absolute;top:50%;left:0;right:0;height:2px;background:rgba(255,255,255,0.8);transform:translateY(-50%);"></div>
        <div style="position:absolute;left:50%;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.8);transform:translateX(-50%);"></div>
      </div>
    </div>

    <!-- Break bar -->
    <div style="position:absolute;bottom:120px;left:50%;transform:translateX(-50%);width:200px;height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;z-index:6;">
      <div id="break-bar" style="height:100%;background:#f59e0b;width:0;transform-origin:left;transition:none;border-radius:4px;"></div>
    </div>

    <!-- Top HUD -->
    <div style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;padding:12px 16px;z-index:6;pointer-events:none;">
      <div id="coords-display" style="font-family:'Press Start 2P',monospace;font-size:9px;color:#fff;text-shadow:1px 1px 0 #000;background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:6px;">X:0 Y:0 Z:0</div>
      <div id="day-display" style="font-family:'Press Start 2P',monospace;font-size:9px;color:#fff;text-shadow:1px 1px 0 #000;background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:6px;">☀ 06:00</div>
    </div>

    <!-- Hotbar -->
    <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:6;">
      ${Array(9).fill(0).map((_, i) => `
        <div class="hb-slot" data-slot="${i}" style="width:52px;height:52px;background:rgba(0,0,0,0.6);border:2px solid rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;transition:border-color 0.1s;">
          <div class="hb-inner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;"></div>
        </div>
      `).join('')}
    </div>

    <!-- Health & Hunger bars -->
    <div style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:4px;width:468px;z-index:6;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;">❤</span>
        <div style="flex:1;height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;">
          <div id="hp-bar" style="height:100%;width:100%;background:#22c55e;border-radius:4px;transition:width 0.3s,background 0.3s;"></div>
        </div>
        <span style="font-size:14px;">🍖</span>
        <div style="width:140px;height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;">
          <div id="hunger-bar" style="height:100%;width:100%;background:#f59e0b;border-radius:4px;transition:width 0.3s;"></div>
        </div>
      </div>
    </div>

    <!-- Game toast -->
    <div id="game-toast" style="position:absolute;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;padding:6px 16px;border-radius:20px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:8;white-space:nowrap;"></div>

    <!-- Pause Menu -->
    <div id="pause-menu" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.7);z-index:30;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
      <div style="font-family:'Press Start 2P',monospace;font-size:18px;color:#fff;margin-bottom:16px;">PAUSED</div>
      <button onclick="NexusGame.resume()" style="padding:12px 40px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;">▶ Resume</button>
      <button onclick="NexusGame.exitGame()" style="padding:12px 40px;background:#374151;color:#fff;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;">🏠 Back to Menu</button>
    </div>

    <!-- Death Screen -->
    <div id="death-screen" style="display:none;position:absolute;inset:0;background:rgba(80,0,0,0.85);z-index:30;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
      <div style="font-family:'Press Start 2P',monospace;font-size:24px;color:#ef4444;text-shadow:0 0 20px #ef4444;margin-bottom:8px;">YOU DIED</div>
      <div style="color:#fca5a5;font-family:'Nunito',sans-serif;font-size:14px;margin-bottom:16px;">Score: ${Math.floor(Math.random()*500)} blocks mined</div>
      <button onclick="NexusGame.respawn()" style="padding:12px 40px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;">Respawn</button>
      <button onclick="NexusGame.exitGame()" style="padding:12px 40px;background:#374151;color:#fff;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;">🏠 Main Menu</button>
    </div>

    <!-- Inventory Panel -->
    <div id="inventory-panel" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.7);z-index:25;align-items:center;justify-content:center;">
      <div style="background:#1e2535;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;min-width:360px;">
        <div style="font-family:'Press Start 2P',monospace;font-size:11px;color:#4f9eff;margin-bottom:16px;">INVENTORY — click item → hotbar</div>
        <div id="inv-grid" style="display:grid;grid-template-columns:repeat(9,1fr);gap:4px;"></div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end;">
          <button onclick="document.getElementById('inventory-panel').style.display='none';document.getElementById('game-canvas').requestPointerLock();" style="padding:8px 20px;background:#374151;color:#fff;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-weight:700;cursor:pointer;">Close (E)</button>
        </div>
      </div>
    </div>
  </div>

  <style>
    .hb-slot.selected { border-color: #fff !important; box-shadow: 0 0 12px rgba(255,255,255,0.3); }
    .hb-block { width:32px;height:32px;border-radius:4px;border:1px solid rgba(0,0,0,0.4); }
    .hb-count { position:absolute;bottom:2px;right:4px;font-size:10px;font-weight:800;color:#fff;text-shadow:1px 1px 0 #000; }
    .inv-slot { width:100%;aspect-ratio:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;transition:border-color 0.15s; }
    .inv-slot:hover { border-color:rgba(79,158,255,0.5); }
    .inv-block { width:28px;height:28px;border-radius:4px; }
    .inv-count { position:absolute;bottom:2px;right:3px;font-size:9px;font-weight:800;color:#fff;text-shadow:1px 1px 0 #000; }
  </style>
  `;
}

// ── MAIN INIT ─────────────────────────────────────────────
function init(container, mode) {
  gameMode = mode || 'survival';
  buildGameUI(container);

  canvas = document.getElementById('game-canvas');
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;

  // Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, canvas.width/canvas.height, 0.1, 500);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  clock = new THREE.Clock();

  // Player
  playerPos = new THREE.Vector3(8, MAX_HEIGHT+5, 8);
  playerVel = new THREE.Vector3(0, 0, 0);

  // Preload spawn chunks
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
    world[chunkKey(cx,cz)] = generateChunk(cx,cz);
    rebuildChunk(cx,cz);
  }

  initSky();
  giveStarterItems();
  initInput();

  // Cache UI refs
  coordsEl = document.getElementById('coords-display');
  dayEl = document.getElementById('day-display');
  damageFlashEl = document.getElementById('damage-flash');
  gameToastEl = document.getElementById('game-toast');
  breakOverlay = document.getElementById('break-bar');

  // Hotbar click
  document.querySelectorAll('.hb-slot').forEach(sl => {
    sl.addEventListener('click', () => {
      hotbarSel = parseInt(sl.dataset.slot);
      renderHotbar();
    });
  });

  // Resize
  window.addEventListener('resize', () => {
    if (!canvas) return;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    renderer.setSize(canvas.width, canvas.height);
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
  });

  running = true;
  paused = false;
  updateHUD();
  gameLoop();
  showGameToast('🎮 NexusRealms — Click to start!');
}

function resume() {
  paused = false;
  const pm = document.getElementById('pause-menu');
  if (pm) pm.style.display = 'none';
  canvas?.requestPointerLock();
}

function exitGame() {
  running = false;
  document.exitPointerLock();
  mobs.forEach(m => scene?.remove(m.mesh));
  mobs = []; particles = []; world = {}; chunkMeshes = {};
  renderer?.dispose();
  // Return to launcher
  if (window.NEXUS_EXIT_GAME) window.NEXUS_EXIT_GAME();
}

// Public API
return { init, resume, respawn, exitGame };

})(); // end IIFE

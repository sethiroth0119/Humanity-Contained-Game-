/* ============================================================
   HUD + panels (inventory, loot, crafting) + message log
   ============================================================ */

const UI = (() => {

const el = (s, root = document) => root.querySelector(s);
const els = (s, root = document) => [...root.querySelectorAll(s)];

let logEl, promptEl, tooltipEl;
let invPanel, lootPanel, craftPanel;
let onAction = () => {};

function init(handlers) {
  onAction = handlers.onAction;

  logEl = el('#log');
  promptEl = el('#prompt');
  tooltipEl = el('#tooltip');
  invPanel = el('#inventory');
  lootPanel = el('#loot');
  craftPanel = el('#crafting');

  // Close buttons
  els('.panel .close').forEach(c => {
    c.addEventListener('click', () => {
      c.closest('.panel').classList.remove('show');
      onAction({ type: 'panel_closed' });
    });
  });
}

/* ----- Stat bars ----- */
function updateStats(p) {
  setBar('hp',   p.hp,   p.maxHp);
  setBar('stam', p.stam, p.maxStam);

  // Hunger / thirst / mana: show when relevant
  toggleBar('hung', p.hunger < 70);
  toggleBar('thir', p.thirst < 70);
  toggleBar('mana', p.mana < p.maxMana - 0.5 || (p.weapon && itemDef(p.weapon.item).ammo === 'mana'));

  setBar('hung', p.hunger, p.maxHunger);
  setBar('thir', p.thirst, p.maxThirst);
  setBar('mana', p.mana,   p.maxMana);
}

function setBar(name, v, max) {
  const bar = el(`.stat-bar.${name}`);
  if (!bar) return;
  const fill = el('.fill', bar);
  const val = el('.val', bar);
  const pct = Math.max(0, Math.min(1, v / max));
  fill.style.width = (pct * 100) + '%';
  val.textContent = `${Math.round(v)}/${max}`;
}
function toggleBar(name, show) {
  const bar = el(`.stat-bar.${name}`);
  if (!bar) return;
  bar.classList.toggle('hidden', !show);
}

/* ----- Clock + phase ----- */
function updateClock(time) {
  const total = time.minutes; // minutes since dawn day 1
  const day = Math.floor(total / (24 * 60)) + 1;
  const minOfDay = total % (24 * 60);
  const h = Math.floor(minOfDay / 60);
  const m = Math.floor(minOfDay % 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  el('.hud-corner-tr .time').textContent = `${hh}:${mm}`;
  el('.hud-corner-tr .day').textContent = `DAY ${day}`;
  let phase;
  if (h < 5) phase = 'DEAD OF NIGHT';
  else if (h < 7) phase = 'DAWN';
  else if (h < 17) phase = 'DAY';
  else if (h < 19) phase = 'DUSK';
  else if (h < 22) phase = 'NIGHT';
  else phase = 'WITCHING HOUR';
  el('.hud-corner-tr .phase').textContent = phase;
}

/* ----- Hotbar ----- */
function updateHotbar(player) {
  const slots = els('#hotbar .slot');
  INVENTORY.state.hotbar.forEach((slotIdx, i) => {
    const slotEl = slots[i];
    let data = null;
    let isEquippedWeapon = false;
    if (slotIdx === -1) {
      // sentinel: shows currently equipped weapon
      data = INVENTORY.state.equipment.weapon;
      isEquippedWeapon = true;
    } else if (slotIdx !== null) {
      data = INVENTORY.state.slots[slotIdx];
    }
    slotEl.classList.toggle('empty', !data);
    slotEl.classList.toggle('active', isEquippedWeapon && !!player.weapon);
    const itemSpan = el('.item', slotEl);
    const qtySpan = el('.qty', slotEl);
    if (data) {
      itemSpan.textContent = shortName(itemDef(data.item).name);
      qtySpan.textContent = data.qty > 1 ? data.qty : '';
    } else {
      itemSpan.textContent = '—';
      qtySpan.textContent = '';
    }
  });
}

function shortName(n) {
  // Wrap to 2 words max
  const parts = n.split(' ');
  if (parts.length === 1) return n;
  return parts[0] + '\n' + parts.slice(1).join(' ');
}

/* ----- Inventory panel ----- */
function openInventory(player) {
  invPanel.classList.add('show');
  renderInventory(player);
}
function closePanels() {
  invPanel.classList.remove('show');
  lootPanel.classList.remove('show');
  craftPanel.classList.remove('show');
}
function isAnyPanelOpen() {
  return invPanel.classList.contains('show')
      || lootPanel.classList.contains('show')
      || craftPanel.classList.contains('show');
}

function renderInventory(player) {
  // Equipment
  const eq = INVENTORY.state.equipment;
  el('#eq-weapon').className = 'equip-slot' + (eq.weapon ? ' filled' : '');
  el('#eq-weapon .info').innerHTML = eq.weapon
    ? `${itemDef(eq.weapon.item).name}<small>${formatWeaponMeta(itemDef(eq.weapon.item))}</small>`
    : `<em style="opacity:0.4">Bare hands</em><small>Weak. Loud.</small>`;
  el('#eq-armor').className = 'equip-slot' + (eq.armor ? ' filled' : '');
  el('#eq-armor .info').innerHTML = eq.armor
    ? `${itemDef(eq.armor.item).name}<small>+${itemDef(eq.armor.item).defense} def</small>`
    : `<em style="opacity:0.4">No armor</em><small>Vulnerable</small>`;
  el('#eq-shield').className = 'equip-slot' + (eq.shield ? ' filled' : '');
  el('#eq-shield .info').innerHTML = eq.shield
    ? `${itemDef(eq.shield.item).name}<small>+${itemDef(eq.shield.item).defense} def · block</small>`
    : `<em style="opacity:0.4">No shield</em><small>Hold MOUSE2 to block</small>`;
  el('#eq-acc').className = 'equip-slot' + (eq.accessory ? ' filled' : '');
  el('#eq-acc').className = 'equip-slot' + (eq.accessory ? ' filled' : '');
  el('#eq-acc .info').innerHTML = eq.accessory
    ? `${itemDef(eq.accessory.item).name}<small>${itemDef(eq.accessory.item).manaRegen ? '+ mana regen' : 'effect'}</small>`
    : `<em style="opacity:0.4">No talisman</em><small>—</small>`;

  // Grid
  const grid = el('.inv-grid');
  grid.innerHTML = '';
  for (let i = 0; i < INVENTORY.MAX_SLOTS; i++) {
    const s = INVENTORY.state.slots[i];
    const cell = document.createElement('div');
    cell.className = 'inv-cell' + (s ? '' : ' empty');
    cell.dataset.slot = i;
    if (s) {
      const def = itemDef(s.item);
      cell.innerHTML = `<span>${def.name}</span>` + (s.qty > 1 ? `<span class="qty">${s.qty}</span>` : '');
      cell.addEventListener('mouseenter', e => showTooltip(e, def));
      cell.addEventListener('mouseleave', hideTooltip);
      cell.addEventListener('click', () => onAction({ type: 'use_slot', slot: i }));
      cell.addEventListener('contextmenu', e => { e.preventDefault(); onAction({ type: 'drop_slot', slot: i }); });
    }
    grid.appendChild(cell);
  }

  // Equipment click → unequip
  ['weapon','armor','shield','accessory'].forEach(k => {
    el('#eq-' + (k === 'accessory' ? 'acc' : k)).onclick = () => onAction({ type: 'unequip', slot: k });
  });
}

function formatWeaponMeta(def) {
  const parts = [];
  parts.push(`${def.dmg} dmg`);
  if (def.range) parts.push(`${def.range.toFixed(1)}m`);
  if (def.ranged) parts.push('ranged');
  if (def.ammo && def.ammo !== 'mana') parts.push(itemDef(def.ammo).name.toLowerCase());
  if (def.ammo === 'mana') parts.push(`${def.manaCost} mana`);
  return parts.join(' · ');
}

/* ----- Tooltip ----- */
function showTooltip(e, def) {
  tooltipEl.style.display = 'block';
  tooltipEl.style.left = (e.clientX + 14) + 'px';
  tooltipEl.style.top  = (e.clientY + 14) + 'px';
  let meta = def.kind.toUpperCase();
  if (def.kind === 'weapon') meta = formatWeaponMeta(def);
  if (def.kind === 'armor') meta = `+${def.defense} defense`;
  if (def.kind === 'consumable') {
    const eff = [];
    if (def.heal) eff.push(`+${def.heal} HP`);
    if (def.hunger) eff.push(`+${def.hunger} hunger`);
    if (def.thirst) eff.push(`+${def.thirst} thirst`);
    if (def.mana) eff.push(`+${def.mana} mana`);
    if (def.special) eff.push(def.special);
    meta = eff.join(' · ');
  }
  tooltipEl.innerHTML = `
    <div class="name">${def.name}</div>
    <div class="meta">${meta}</div>
    ${def.desc ? `<div class="desc">${def.desc}</div>` : ''}
  `;
}
function hideTooltip() { tooltipEl.style.display = 'none'; }

/* ----- Loot panel ----- */
function openLoot(container) {
  lootPanel.classList.add('show');
  lootPanel._target = container;
  renderLoot(container);
}
function renderLoot(c) {
  const body = el('.loot-body');
  body.innerHTML = '';
  el('#loot .panel-header .title').textContent = labelForContainer(c);
  if (!c.loot || c.loot.length === 0) {
    body.innerHTML = '<div class="loot-empty">Empty.</div>';
    return;
  }
  c.loot.forEach((l, i) => {
    const def = itemDef(l.item);
    const row = document.createElement('div');
    row.className = 'loot-row';
    row.innerHTML = `<span>${def.name}</span><span class="qty">×${l.qty}</span>`;
    row.addEventListener('click', () => onAction({ type: 'take_loot', container: c, idx: i }));
    row.addEventListener('mouseenter', e => showTooltip(e, def));
    row.addEventListener('mouseleave', hideTooltip);
    body.appendChild(row);
  });
  const takeAll = document.createElement('div');
  takeAll.className = 'loot-row';
  takeAll.style.justifyContent = 'center';
  takeAll.style.fontStyle = 'italic';
  takeAll.style.borderColor = 'rgba(255,215,150,0.25)';
  takeAll.innerHTML = `<span>Take all</span>`;
  takeAll.addEventListener('click', () => onAction({ type: 'take_all', container: c }));
  body.appendChild(takeAll);
}
function labelForContainer(c) {
  return { car: 'Abandoned Car', barrel: 'Old Barrel', crate: 'Wooden Crate', chest: 'Reliquary Chest' }[c.type] || 'Container';
}

/* ----- Crafting ----- */
function openCrafting() {
  craftPanel.classList.add('show');
  renderCrafting();
}
function renderCrafting() {
  const body = el('.craft-body');
  body.innerHTML = '';
  RECIPES.forEach(r => {
    const ok = canCraft(r);
    const row = document.createElement('div');
    row.className = 'recipe' + (ok ? '' : ' locked');
    const out = itemDef(r.output.item);
    const reqs = r.inputs.map(i => {
      const have = INVENTORY.countItem(i.item);
      return `<span style="color:${have >= i.qty ? '' : 'oklch(0.55 0.18 25)'}">${itemDef(i.item).name} ×${i.qty} (${have})</span>`;
    }).join(' · ');
    row.innerHTML = `
      <div>
        <div class="name">${out.name}${r.output.qty > 1 ? ` ×${r.output.qty}` : ''}</div>
        <div class="reqs">${reqs}</div>
      </div>
      <div></div>
      <div class="action">${ok ? 'Craft ▸' : 'Locked'}</div>
    `;
    if (ok) row.addEventListener('click', () => onAction({ type: 'craft', recipe: r }));
    body.appendChild(row);
  });
}

/* ----- Prompts ----- */
function setPrompt(text) {
  if (!text) { promptEl.classList.remove('show'); return; }
  promptEl.innerHTML = text;
  promptEl.classList.add('show');
}

/* ----- Log ----- */
function log(text, cls = '') {
  const line = document.createElement('div');
  line.className = 'line ' + cls;
  line.textContent = text;
  logEl.prepend(line);
  // remove old
  setTimeout(() => line.remove(), 6800);
}

/* ----- Floating damage numbers ----- */
function showFloat(text, screenX, screenY, cls = '') {
  const d = document.createElement('div');
  d.className = 'dmg ' + cls;
  d.style.left = screenX + 'px';
  d.style.top = screenY + 'px';
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 850);
}

/* ----- Hurt flash ----- */
function hurtFlash() {
  const f = el('#hurt-flash');
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}

/* ----- Cursor ----- */
function moveCursor(x, y) {
  const c = el('#cursor');
  c.style.left = x + 'px';
  c.style.top = y + 'px';
}

/* ----- Minimap ----- */
let mmCtx;
function initMinimap() {
  const c = el('#minimap canvas');
  c.width = 160 * 2;
  c.height = 160 * 2;
  mmCtx = c.getContext('2d');
  mmCtx.scale(2, 2);
}
function drawMinimap(world, player, enemies) {
  if (!mmCtx) return;
  const sz = 160;
  const sc = sz / ISO.WORLD_SIZE;
  mmCtx.clearRect(0, 0, sz, sz);
  mmCtx.fillStyle = 'oklch(0.22 0.03 130)';
  mmCtx.fillRect(0, 0, sz, sz);

  // tiles (downsampled by major colour)
  for (let y = 0; y < ISO.WORLD_SIZE; y++) {
    for (let x = 0; x < ISO.WORLD_SIZE; x++) {
      const t = world.tiles[y][x];
      if (t === ISO.T.ROAD || t === ISO.T.ROAD_EDGE) {
        mmCtx.fillStyle = 'oklch(0.55 0.005 250)';
        mmCtx.fillRect(x*sc, y*sc, sc, sc);
      } else if (t === ISO.T.WATER) {
        mmCtx.fillStyle = 'oklch(0.45 0.10 220)';
        mmCtx.fillRect(x*sc, y*sc, sc, sc);
      } else if (t === ISO.T.DIRT || t === ISO.T.GRAVE) {
        mmCtx.fillStyle = 'oklch(0.38 0.04 70)';
        mmCtx.fillRect(x*sc, y*sc, sc, sc);
      } else if (t === ISO.T.FLOOR_WOOD || t === ISO.T.FLOOR_TILE) {
        mmCtx.fillStyle = 'oklch(0.62 0.06 60)';
        mmCtx.fillRect(x*sc, y*sc, sc, sc);
      }
    }
  }
  // structures outline
  mmCtx.strokeStyle = 'oklch(0.65 0.02 60)';
  mmCtx.lineWidth = 0.8;
  for (const s of world.structures) {
    mmCtx.strokeRect(s.x * sc, s.y * sc, s.w * sc, s.h * sc);
  }
  // enemies
  for (const e of enemies) {
    if (e.dying) continue;
    mmCtx.fillStyle = e.alert ? 'oklch(0.65 0.18 25)' : 'oklch(0.45 0.10 25)';
    mmCtx.fillRect(e.wx * sc - 1.5, e.wy * sc - 1.5, 3, 3);
  }
  // player
  mmCtx.fillStyle = 'oklch(0.95 0.01 90)';
  mmCtx.beginPath();
  mmCtx.arc(player.wx * sc, player.wy * sc, 2.4, 0, Math.PI * 2);
  mmCtx.fill();
  // facing
  mmCtx.strokeStyle = 'oklch(0.95 0.01 90)';
  mmCtx.lineWidth = 1;
  mmCtx.beginPath();
  mmCtx.moveTo(player.wx * sc, player.wy * sc);
  mmCtx.lineTo(player.wx * sc + Math.cos(player.facing) * 6, player.wy * sc + Math.sin(player.facing) * 6);
  mmCtx.stroke();
}

return {
  init, initMinimap, drawMinimap,
  updateStats, updateClock, updateHotbar,
  openInventory, openLoot, openCrafting, closePanels, isAnyPanelOpen,
  renderInventory, renderLoot, renderCrafting,
  setPrompt, log, showFloat, hurtFlash, moveCursor
};
})();

window.UI = UI;

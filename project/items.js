/* ============================================================
   Items, inventory, equipment, crafting
   ============================================================ */

const ITEMS = {
  // Weapons
  rusted_sword: {
    name: 'Rusted Sword',
    kind: 'weapon', shape: 'sword',
    dmg: 18, range: 1.4, arc: 1.3, cooldown: 500, stamCost: 8,
    desc: 'Pitted iron. It remembers blood.'
  },
  silver_dagger: {
    name: 'Silver Dagger',
    kind: 'weapon', shape: 'dagger',
    dmg: 12, range: 0.9, arc: 0.9, cooldown: 280, stamCost: 4,
    bonusVs: 'wraith', bonusMult: 2.0,
    desc: 'Light. Silver sears the unliving.'
  },
  hunting_axe: {
    name: 'Hunting Axe',
    kind: 'weapon', shape: 'axe',
    dmg: 32, range: 1.2, arc: 1.1, cooldown: 800, stamCost: 14,
    desc: 'Heavy. Splits wood and skull alike.'
  },
  iron_spear: {
    name: 'Iron Spear',
    kind: 'weapon', shape: 'spear',
    dmg: 22, range: 2.0, arc: 0.6, cooldown: 600, stamCost: 10,
    desc: 'Reach beyond the grasping dead.'
  },
  hunting_knife: {
    name: 'Hunting Knife',
    kind: 'weapon', shape: 'dagger',
    dmg: 10, range: 0.8, arc: 0.8, cooldown: 240, stamCost: 3,
    desc: 'Better than fists. Barely.'
  },
  longbow: {
    name: 'Yew Longbow',
    kind: 'weapon', shape: 'bow', ranged: true, ammo: 'arrow',
    dmg: 28, range: 8, cooldown: 750, stamCost: 6,
    desc: 'Quiet death from afar.'
  },
  oak_staff: {
    name: 'Oak Staff',
    kind: 'weapon', shape: 'staff', ranged: true, ammo: 'mana', manaCost: 15,
    dmg: 26, range: 7, cooldown: 700,
    desc: 'Channels the wound between worlds.'
  },
  service_pistol: {
    name: 'Service Pistol',
    kind: 'weapon', shape: 'gun', ranged: true, ammo: 'pistol_round',
    dmg: 22, range: 9, cooldown: 350,
    desc: 'Modern steel. Limited shells.'
  },
  pump_shotgun: {
    name: 'Pump Shotgun',
    kind: 'weapon', shape: 'shotgun', ranged: true, ammo: 'shotgun_shell',
    dmg: 50, range: 4, cooldown: 1000, spread: 0.5,
    desc: 'Close and loud.'
  },

  // Armor / accessory
  leather_vest: { name: 'Leather Vest', kind: 'armor', defense: 4, desc: 'Cracked, but cuts the cold.' },
  chainmail:   { name: 'Chain Hauberk', kind: 'armor', defense: 9, desc: 'Heavy rings, scraped raw.' },
  iron_shield: { name: 'Iron Shield', kind: 'shield', defense: 6, block: 0.5, desc: 'Raise it and the blow glances.' },
  warding_amulet: { name: 'Warding Amulet', kind: 'accessory', manaRegen: 0.5, desc: 'Hums faintly when wraiths are near.' },

  // Ammo
  arrow:          { name: 'Arrow', kind: 'ammo', stack: 30 },
  pistol_round:   { name: 'Pistol Round', kind: 'ammo', stack: 60 },
  shotgun_shell:  { name: 'Shotgun Shell', kind: 'ammo', stack: 30 },

  // Consumables
  med_bandage:    { name: 'Bandage', kind: 'consumable', heal: 25, desc: 'Stops the bleeding.' },
  canned_food:    { name: 'Canned Food', kind: 'consumable', hunger: 40, desc: 'Pre-Veil. Still edible.' },
  water_bottle:   { name: 'Water Bottle', kind: 'consumable', thirst: 50, desc: 'Sealed. Clean.' },
  mana_potion:    { name: 'Mana Phial', kind: 'consumable', mana: 50, desc: 'Cold violet glow.' },
  spell_scroll:   { name: 'Scroll of Light', kind: 'consumable', special: 'illume', desc: 'Burns night to a circle of day.' },

  // Materials
  rag:          { name: 'Rag', kind: 'material', stack: 30 },
  cloth:        { name: 'Cloth', kind: 'material', stack: 30 },
  wood_plank:   { name: 'Wood Plank', kind: 'material', stack: 20 },
  gold_coin:    { name: 'Gold Coin', kind: 'material', stack: 99 },
  bone_shard:   { name: 'Bone Shard', kind: 'material', stack: 30 },
  wraith_ash:   { name: 'Wraith Ash', kind: 'material', stack: 30 }
};

function itemDef(id) { return ITEMS[id]; }
function isStackable(id) {
  const d = ITEMS[id];
  return d && (d.kind === 'ammo' || d.kind === 'material' || d.kind === 'consumable');
}

/* ============================================================
   Inventory model
   ============================================================ */

const INVENTORY = (() => {

const MAX_SLOTS = 32;

const state = {
  slots: new Array(MAX_SLOTS).fill(null), // each slot: { item, qty } or null
  equipment: {
    weapon: null,
    armor: null,
    shield: null,
    accessory: null
  },
  hotbar: new Array(5).fill(null) // refs to slot indices, or null
};

function addItem(itemId, qty = 1) {
  const def = itemDef(itemId);
  if (!def) return false;

  // Try to stack first
  if (isStackable(itemId)) {
    for (let i = 0; i < state.slots.length; i++) {
      const s = state.slots[i];
      if (s && s.item === itemId) {
        s.qty += qty;
        return true;
      }
    }
  }
  // Find empty
  for (let i = 0; i < state.slots.length; i++) {
    if (!state.slots[i]) {
      state.slots[i] = { item: itemId, qty };
      return true;
    }
  }
  return false; // full
}

function removeItem(slotIndex, qty = 1) {
  const s = state.slots[slotIndex];
  if (!s) return null;
  s.qty -= qty;
  const removed = { item: s.item, qty };
  if (s.qty <= 0) state.slots[slotIndex] = null;
  return removed;
}

function countItem(itemId) {
  let n = 0;
  for (const s of state.slots) if (s && s.item === itemId) n += s.qty;
  return n;
}

function consumeItem(itemId, qty = 1) {
  let need = qty;
  for (let i = 0; i < state.slots.length && need > 0; i++) {
    const s = state.slots[i];
    if (s && s.item === itemId) {
      const take = Math.min(s.qty, need);
      s.qty -= take;
      need -= take;
      if (s.qty <= 0) state.slots[i] = null;
    }
  }
  return need === 0;
}

function equip(slotIndex) {
  const s = state.slots[slotIndex];
  if (!s) return false;
  const def = itemDef(s.item);
  const slot = def.kind === 'weapon' ? 'weapon'
             : def.kind === 'armor' ? 'armor'
             : def.kind === 'shield' ? 'shield'
             : def.kind === 'accessory' ? 'accessory'
             : null;
  if (!slot) return false;
  // swap with currently equipped
  const cur = state.equipment[slot];
  state.equipment[slot] = { item: s.item, qty: 1 };
  state.slots[slotIndex] = cur; // could be null
  return true;
}

function unequip(slot) {
  const cur = state.equipment[slot];
  if (!cur) return false;
  // find empty slot
  for (let i = 0; i < state.slots.length; i++) {
    if (!state.slots[i]) {
      state.slots[i] = cur;
      state.equipment[slot] = null;
      return true;
    }
  }
  return false;
}

function setHotbar(idx, slotIndex) {
  state.hotbar[idx] = slotIndex;
}

return { state, MAX_SLOTS, addItem, removeItem, countItem, consumeItem, equip, unequip, setHotbar };
})();

/* ============================================================
   Crafting recipes
   ============================================================ */

const RECIPES = [
  {
    id: 'r_bandage',
    output: { item: 'med_bandage', qty: 1 },
    inputs: [{ item: 'rag', qty: 3 }],
    desc: 'Rough bandage.'
  },
  {
    id: 'r_hunting_knife',
    output: { item: 'hunting_knife', qty: 1 },
    inputs: [{ item: 'wood_plank', qty: 1 }, { item: 'bone_shard', qty: 2 }],
    desc: 'Bone-edged knife.'
  },
  {
    id: 'r_arrow',
    output: { item: 'arrow', qty: 4 },
    inputs: [{ item: 'wood_plank', qty: 1 }, { item: 'bone_shard', qty: 1 }],
    desc: 'Four crude arrows.'
  },
  {
    id: 'r_mana_potion',
    output: { item: 'mana_potion', qty: 1 },
    inputs: [{ item: 'wraith_ash', qty: 2 }, { item: 'water_bottle', qty: 1 }],
    desc: 'A phial of dim violet.'
  },
  {
    id: 'r_spear',
    output: { item: 'iron_spear', qty: 1 },
    inputs: [{ item: 'wood_plank', qty: 3 }, { item: 'bone_shard', qty: 3 }],
    desc: 'A workable spear.'
  }
];

function canCraft(recipe) {
  return recipe.inputs.every(req => INVENTORY.countItem(req.item) >= req.qty);
}

function craft(recipe) {
  if (!canCraft(recipe)) return false;
  for (const req of recipe.inputs) INVENTORY.consumeItem(req.item, req.qty);
  INVENTORY.addItem(recipe.output.item, recipe.output.qty);
  return true;
}

window.ITEMS = ITEMS;
window.itemDef = itemDef;
window.INVENTORY = INVENTORY;
window.RECIPES = RECIPES;
window.canCraft = canCraft;
window.craft = craft;

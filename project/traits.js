/* ============================================================
   Traits — good + bad character traits applied at character creation.
   Modeled on Project Zomboid's point-buy system, but with our own
   fantasy / cursed-earth twist.
   ============================================================ */

const TRAITS = (() => {

// Each trait has a cost (positive = good, costs points; negative = bad, GIVES points)
// and a function `apply(player)` that modifies the player state at game start.
// `descriptor` is the short flavor blurb.

const DEFS = {
  // ----------- GOOD TRAITS -----------
  athletic: {
    name: 'Athletic',
    cost: 6,
    type: 'good',
    desc: 'Years on your feet. Higher max stamina, slower drain.',
    apply: (p) => { p.maxStam += 30; p.stam = p.maxStam; p._stamDrainMult *= 0.75; }
  },
  strong: {
    name: 'Strong',
    cost: 6,
    type: 'good',
    desc: 'Heavy hands. Melee strikes hit harder.',
    apply: (p) => { p._meleeDmgMult *= 1.20; }
  },
  marksman: {
    name: 'Marksman',
    cost: 5,
    type: 'good',
    desc: 'Steady eye. Ranged weapons deal more damage.',
    apply: (p) => { p._rangedDmgMult *= 1.25; }
  },
  tough: {
    name: 'Tough',
    cost: 6,
    type: 'good',
    desc: 'You can take a beating. +25 max HP.',
    apply: (p) => { p.maxHp += 25; p.hp = p.maxHp; }
  },
  iron_stomach: {
    name: 'Iron Stomach',
    cost: 3,
    type: 'good',
    desc: 'Slower to starve. Hunger drains less.',
    apply: (p) => { p._hungerDrainMult *= 0.6; }
  },
  desert_born: {
    name: 'Desert-Born',
    cost: 3,
    type: 'good',
    desc: 'Slower to thirst. Long roads ahead.',
    apply: (p) => { p._thirstDrainMult *= 0.6; }
  },
  attuned: {
    name: 'Attuned',
    cost: 5,
    type: 'good',
    desc: 'The veil whispers to you. Mana regenerates faster, +30 max mana.',
    apply: (p) => { p.maxMana += 30; p.mana = p.maxMana; p._manaRegenMult *= 1.8; }
  },
  fleet_footed: {
    name: 'Fleet-Footed',
    cost: 5,
    type: 'good',
    desc: 'Faster movement. The dead are slow.',
    apply: (p) => { p.speed *= 1.15; }
  },
  scavenger: {
    name: 'Scavenger',
    cost: 4,
    type: 'good',
    desc: 'Sharp eyes for what others leave behind. Loot rolls extra item.',
    apply: (p) => { p._scavenger = true; }
  },
  cold_blooded: {
    name: 'Cold-Blooded',
    cost: 4,
    type: 'good',
    desc: 'Wraiths and worse no longer rattle you. Mana drain reduced under pressure.',
    apply: (p) => { p._coldBlooded = true; p._manaDrainMult = 0.85; }
  },
  silver_tongue: {
    name: 'Silver Tongue',
    cost: 3,
    type: 'good',
    desc: 'Silver weapons cut even deeper in your hands.',
    apply: (p) => { p._silverBonus = 0.5; }
  },
  // ----------- BAD TRAITS (give points) -----------
  weak: {
    name: 'Weak',
    cost: -5,
    type: 'bad',
    desc: 'Soft hands. Melee strikes do less damage.',
    apply: (p) => { p._meleeDmgMult *= 0.80; }
  },
  asthmatic: {
    name: 'Asthmatic',
    cost: -4,
    type: 'bad',
    desc: 'Lungs of glass. Lower max stamina, drains faster.',
    apply: (p) => { p.maxStam -= 25; p.stam = p.maxStam; p._stamDrainMult *= 1.5; }
  },
  thin_skinned: {
    name: 'Thin-Skinned',
    cost: -5,
    type: 'bad',
    desc: 'Every wound bites deeper. +25% damage taken.',
    apply: (p) => { p._dmgTakenMult *= 1.25; }
  },
  slow_healer: {
    name: 'Slow Healer',
    cost: -4,
    type: 'bad',
    desc: 'Bandages do less for you.',
    apply: (p) => { p._healMult = 0.6; }
  },
  hemophobic: {
    name: 'Hemophobic',
    cost: -3,
    type: 'bad',
    desc: 'You panic at the sight of your own blood. Stamina drops faster when wounded.',
    apply: (p) => { p._hemophobic = true; }
  },
  glass_jaw: {
    name: 'Glass Jaw',
    cost: -4,
    type: 'bad',
    desc: 'A solid hit knocks you flat. Shorter i-frames, longer stun.',
    apply: (p) => { p._iframeMult = 0.6; }
  },
  haunted: {
    name: 'Haunted',
    cost: -5,
    type: 'bad',
    desc: 'You see things at the edges. Stamina drains in the dark, even still.',
    apply: (p) => { p._haunted = true; }
  },
  cursed: {
    name: 'Cursed',
    cost: -6,
    type: 'bad',
    desc: 'Something old followed you home. Mana regen reduced; wraiths see you farther.',
    apply: (p) => { p._manaRegenMult *= 0.4; p._cursed = true; }
  },
  light_sleeper: {
    name: 'Light Sleeper',
    cost: -2,
    type: 'bad',
    desc: 'You wake at every noise. Fatigue accumulates faster.',
    apply: (p) => { p._fatigueMult = 1.4; }
  },
  hard_of_hearing: {
    name: 'Hard of Hearing',
    cost: -3,
    type: 'bad',
    desc: 'Enemies can sneak up. They get an extra alert turn before you notice.',
    apply: (p) => { p._hardHearing = true; }
  },
  unsteady_hands: {
    name: 'Unsteady Hands',
    cost: -3,
    type: 'bad',
    desc: 'Ranged weapons spread more. Pistol and bow shots aren\u2019t as clean.',
    apply: (p) => { p._rangedSpread = 0.4; }
  },
  brittle_bones: {
    name: 'Brittle Bones',
    cost: -4,
    type: 'bad',
    desc: 'Falls and falls hurt more. Lower max HP.',
    apply: (p) => { p.maxHp -= 20; p.hp = p.maxHp; }
  }
};

// Apply selected traits onto a fresh player object.
// Also initializes the multiplier fields the traits read from.
function applyTraits(player, selectedIds) {
  // Defaults: multipliers start at 1.
  player._meleeDmgMult = 1.0;
  player._rangedDmgMult = 1.0;
  player._stamDrainMult = 1.0;
  player._hungerDrainMult = 1.0;
  player._thirstDrainMult = 1.0;
  player._manaRegenMult = 1.0;
  player._manaDrainMult = 1.0;
  player._dmgTakenMult = 1.0;
  player._healMult = 1.0;
  player._iframeMult = 1.0;
  player._fatigueMult = 1.0;
  player._rangedSpread = 0.0;
  player._scavenger = false;
  player._coldBlooded = false;
  player._silverBonus = 0.0;
  player._hemophobic = false;
  player._haunted = false;
  player._cursed = false;
  player._hardHearing = false;
  player.selectedTraits = selectedIds.slice();

  for (const id of selectedIds) {
    const t = DEFS[id];
    if (t && t.apply) t.apply(player);
  }
}

// localStorage persistence
const KEY = 'humanity_contained.traits';
function save(selectedIds) {
  try { localStorage.setItem(KEY, JSON.stringify(selectedIds)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Compute total cost of a selection
function totalCost(selectedIds) {
  let n = 0;
  for (const id of selectedIds) if (DEFS[id]) n += DEFS[id].cost;
  return n;
}

return { DEFS, applyTraits, save, load, totalCost };
})();

window.TRAITS = TRAITS;

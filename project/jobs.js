/* ============================================================
   Past Life — Occupations from before the flood.
   Each job grants starting items + stat modifiers + perks + drawbacks.
   Pick one (or none).
   ============================================================ */

const JOBS = (() => {

// Each job is an object:
//   id, name, tagline, era, starter: [{item, qty}], apply(player), perks: [strings], drawbacks: [strings]

const DEFS = {
  none: {
    id: 'none',
    name: 'Drifter',
    tagline: 'No name worth printing on a badge.',
    era: 'Before the flood, you were no one in particular.',
    starter: [
      { item: 'rusted_sword', qty: 1 },
      { item: 'rag', qty: 3 }
    ],
    perks: ['Balanced start, nothing special.'],
    drawbacks: ['No edge over anyone.'],
    apply: () => {}
  },

  cop: {
    id: 'cop',
    name: 'Police Officer',
    tagline: 'Twelve years on the force. The badge is gone now.',
    era: 'Modern day — pre-flood.',
    starter: [
      { item: 'service_pistol', qty: 1 },
      { item: 'pistol_round', qty: 18 },
      { item: 'med_bandage', qty: 2 },
      { item: 'leather_vest', qty: 1 }
    ],
    perks: ['+15% ranged damage', 'Knows how to search a car (better loot)'],
    drawbacks: ['-10 max stamina (desk job legs)'],
    apply: (p) => {
      p._rangedDmgMult *= 1.15;
      p._scavenger = true;
      p.maxStam -= 10;
      p.stam = p.maxStam;
    }
  },

  soldier: {
    id: 'soldier',
    name: 'Veteran',
    tagline: 'You\u2019ve been deployed before. Different war.',
    era: 'Modern military.',
    starter: [
      { item: 'pump_shotgun', qty: 1 },
      { item: 'shotgun_shell', qty: 8 },
      { item: 'chainmail', qty: 1 },
      { item: 'canned_food', qty: 2 }
    ],
    perks: ['+25 max HP', '+10% all damage', 'Carries an extra slot of ammo without thinking'],
    drawbacks: ['Haunted — stamina drains in the dark'],
    apply: (p) => {
      p.maxHp += 25; p.hp = p.maxHp;
      p._meleeDmgMult *= 1.10;
      p._rangedDmgMult *= 1.10;
      p._haunted = true;
    }
  },

  mechanic: {
    id: 'mechanic',
    name: 'Mechanic',
    tagline: 'Hands stained. You can hear a bad engine three blocks away.',
    era: 'Modern day.',
    starter: [
      { item: 'hunting_axe', qty: 1 },
      { item: 'wood_plank', qty: 4 },
      { item: 'rag', qty: 6 },
      { item: 'water_bottle', qty: 1 }
    ],
    perks: ['Cars yield more loot', '+15% melee damage to props (chopping, breaking)', '+15 max stamina'],
    drawbacks: ['Mana regen halved — you don\u2019t believe in any of this'],
    apply: (p) => {
      p._scavenger = true;
      p._meleeDmgMult *= 1.05;
      p._propDmgMult = 1.15;
      p.maxStam += 15; p.stam = p.maxStam;
      p._manaRegenMult *= 0.5;
    }
  },

  priest: {
    id: 'priest',
    name: 'Priest',
    tagline: 'You buried more in the last week than the last decade.',
    era: 'Of the old faith.',
    starter: [
      { item: 'silver_dagger', qty: 1 },
      { item: 'mana_potion', qty: 2 },
      { item: 'warding_amulet', qty: 1 },
      { item: 'canned_food', qty: 1 }
    ],
    perks: ['+30 max mana', 'Silver weapons cut deeper (+50% dmg)', 'Wraiths flinch the first time you swing'],
    drawbacks: ['-10% melee damage (you never trained to kill)'],
    apply: (p) => {
      p.maxMana += 30; p.mana = p.maxMana;
      p._silverBonus = 0.5;
      p._meleeDmgMult *= 0.90;
      p._priestFlinch = true;
    }
  },

  doctor: {
    id: 'doctor',
    name: 'Field Doctor',
    tagline: 'You know exactly which veins to slow.',
    era: 'Modern medicine.',
    starter: [
      { item: 'hunting_knife', qty: 1 },
      { item: 'med_bandage', qty: 6 },
      { item: 'canned_food', qty: 1 },
      { item: 'water_bottle', qty: 1 }
    ],
    perks: ['Bandages heal +50%', 'Slower bleed when wounded', 'Knows what\u2019s safe to drink'],
    drawbacks: ['-15% melee damage (you save lives, not take them)'],
    apply: (p) => {
      p._healMult *= 1.5;
      p._meleeDmgMult *= 0.85;
      p._thirstDrainMult *= 0.7;
    }
  },

  hunter: {
    id: 'hunter',
    name: 'Hunter',
    tagline: 'A week\u2019s tracking in the back country, and you\u2019re still tracking.',
    era: 'Backwoods.',
    starter: [
      { item: 'longbow', qty: 1 },
      { item: 'arrow', qty: 16 },
      { item: 'hunting_knife', qty: 1 },
      { item: 'canned_food', qty: 1 }
    ],
    perks: ['+25% ranged damage', '+15 max stamina', 'Iron stomach — eats anything'],
    drawbacks: ['-10 max HP (lean build)'],
    apply: (p) => {
      p._rangedDmgMult *= 1.25;
      p.maxStam += 15; p.stam = p.maxStam;
      p._hungerDrainMult *= 0.6;
      p.maxHp -= 10; p.hp = p.maxHp;
    }
  },

  farmer: {
    id: 'farmer',
    name: 'Farmer',
    tagline: 'You buried family before any of this.',
    era: 'Generational land.',
    starter: [
      { item: 'hunting_axe', qty: 1 },
      { item: 'canned_food', qty: 3 },
      { item: 'water_bottle', qty: 2 },
      { item: 'rag', qty: 4 }
    ],
    perks: ['+20 max stamina', 'Hunger and thirst drain 40% slower', '+10% melee damage with axes'],
    drawbacks: ['No use for magic — mana cap halved'],
    apply: (p) => {
      p.maxStam += 20; p.stam = p.maxStam;
      p._hungerDrainMult *= 0.6;
      p._thirstDrainMult *= 0.6;
      p._axeBonus = 0.10;
      p.maxMana = Math.max(10, Math.floor(p.maxMana * 0.5));
      p.mana = Math.min(p.mana, p.maxMana);
    }
  },

  scholar: {
    id: 'scholar',
    name: 'Scholar of the Veil',
    tagline: 'You read about this in a forbidden room. You did not believe.',
    era: 'University library, after hours.',
    starter: [
      { item: 'oak_staff', qty: 1 },
      { item: 'mana_potion', qty: 3 },
      { item: 'spell_scroll', qty: 2 },
      { item: 'warding_amulet', qty: 1 }
    ],
    perks: ['+40 max mana', 'Mana regenerates twice as fast', 'Scrolls last longer'],
    drawbacks: ['-15 max HP (you never fought)', 'Weak — melee deals -20% damage'],
    apply: (p) => {
      p.maxMana += 40; p.mana = p.maxMana;
      p._manaRegenMult *= 2.0;
      p._scrollDurationMult = 2.0;
      p.maxHp -= 15; p.hp = p.maxHp;
      p._meleeDmgMult *= 0.80;
    }
  },

  thief: {
    id: 'thief',
    name: 'Thief',
    tagline: 'You knew every back alley before the lamps went out.',
    era: 'Recent past.',
    starter: [
      { item: 'silver_dagger', qty: 1 },
      { item: 'hunting_knife', qty: 1 },
      { item: 'gold_coin', qty: 12 },
      { item: 'rag', qty: 3 }
    ],
    perks: ['+15% movement speed', 'Scavenger — find extra loot in containers', '+10% dagger damage'],
    drawbacks: ['-10 max HP (cracked ribs from a job gone wrong)', 'Light Sleeper'],
    apply: (p) => {
      p.speed *= 1.15;
      p._scavenger = true;
      p._daggerBonus = 0.10;
      p.maxHp -= 10; p.hp = p.maxHp;
      p._fatigueMult = 1.4;
    }
  },

  ironworker: {
    id: 'ironworker',
    name: 'Ironworker',
    tagline: 'Your back remembers every floor it framed.',
    era: 'Construction.',
    starter: [
      { item: 'hunting_axe', qty: 1 },
      { item: 'chainmail', qty: 1 },
      { item: 'wood_plank', qty: 6 },
      { item: 'canned_food', qty: 1 }
    ],
    perks: ['+30 max HP', '+20% melee damage', 'Heavy weapons feel lighter (no speed penalty)'],
    drawbacks: ['-15 max stamina (bad knees)', 'Asthmatic — winded faster'],
    apply: (p) => {
      p.maxHp += 30; p.hp = p.maxHp;
      p._meleeDmgMult *= 1.20;
      p._ignoreHeavyPenalty = true;
      p.maxStam -= 15; p.stam = p.maxStam;
      p._stamDrainMult *= 1.3;
    }
  },

  vagrant: {
    id: 'vagrant',
    name: 'The Vagrant',
    tagline: 'You were already lost. The flood just caught up.',
    era: 'Nowhere in particular.',
    starter: [
      { item: 'hunting_knife', qty: 1 },
      { item: 'rag', qty: 8 },
      { item: 'water_bottle', qty: 1 },
      { item: 'canned_food', qty: 1 }
    ],
    perks: ['Hunger drains 60% slower (used to nothing)', 'Cold doesn\u2019t bother you', '+10 max stamina'],
    drawbacks: ['-15% damage taken resistance is gone (Thin-Skinned)', '-10% melee damage'],
    apply: (p) => {
      p._hungerDrainMult *= 0.4;
      p._thirstDrainMult *= 0.8;
      p.maxStam += 10; p.stam = p.maxStam;
      p._dmgTakenMult *= 1.15;
      p._meleeDmgMult *= 0.90;
    }
  }
};

const ORDER = ['none', 'cop', 'soldier', 'mechanic', 'priest', 'doctor', 'hunter', 'farmer', 'scholar', 'thief', 'ironworker', 'vagrant'];

// Apply a job's effects to a player AFTER traits have been applied.
function applyJob(player, jobId) {
  const job = DEFS[jobId] || DEFS.none;
  player.pastLife = jobId;
  if (job.apply) job.apply(player);
  return job;
}

// Add a job's starter items to inventory (called once, after world build).
function applyStarterInventory(jobId) {
  const job = DEFS[jobId] || DEFS.none;
  for (const it of job.starter) {
    INVENTORY.addItem(it.item, it.qty);
  }
}

const KEY = 'humanity_contained.job';
function save(jobId) {
  try { localStorage.setItem(KEY, jobId); } catch (e) {}
}
function load() {
  try { return localStorage.getItem(KEY) || 'none'; } catch (e) { return 'none'; }
}

return { DEFS, ORDER, applyJob, applyStarterInventory, save, load };
})();

window.JOBS = JOBS;

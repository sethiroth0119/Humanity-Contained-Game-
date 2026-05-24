/* ============================================================
   Entities: player + enemies + AI
   ============================================================ */

(function () {
const dist = ISO.dist;
const WORLD_SIZE = ISO.WORLD_SIZE;
const isWalkable = ISO.isWalkable;
const propAt = ISO.propAt;

/* ----- Player ----- */
function makePlayer() {
  return {
    wx: 30, wy: 35,            // start near intersection
    vx: 0, vy: 0,
    speed: 3.5,                // tiles per second
    facing: -Math.PI / 2,      // up
    targetAng: -Math.PI / 2,
    hp: 100, maxHp: 100,
    stam: 100, maxStam: 100,
    mana: 60, maxMana: 60,
    hunger: 90, maxHunger: 100,
    thirst: 85, maxThirst: 100,
    fatigue: 100,              // not displayed
    weapon: null,              // set from inventory equip
    armor: null,
    shield: null,
    accessory: null,
    swing: null,               // { startAng, endAng, t, dur, range, arc, weaponId, hit:Set }
    shot: null,                // { from, to, time, kind }
    lastHitT: 0,
    iframe: 0,
    busyUntil: 0,              // can't attack while > now
    blocking: false,
    dead: false
  };
}

function updatePlayer(player, dt, world) {
  if (player.dead) return;

  // Movement
  const speed = (player.blocking ? 1.2 : (player.weapon && itemDef(player.weapon.item).kind === 'weapon' && itemDef(player.weapon.item).cooldown > 700 ? 3.0 : player.speed));
  let dx = player.vx, dy = player.vy;
  const mag = Math.hypot(dx, dy);
  if (mag > 0) { dx /= mag; dy /= mag; }
  const moveX = dx * speed * dt;
  const moveY = dy * speed * dt;

  // Try X
  const nx = player.wx + moveX;
  if (isWalkable(world, nx, player.wy) && !blockingProp(world, nx, player.wy)) player.wx = nx;
  const ny = player.wy + moveY;
  if (isWalkable(world, player.wx, ny) && !blockingProp(world, player.wx, ny)) player.wy = ny;

  // Clamp
  player.wx = Math.max(0.4, Math.min(WORLD_SIZE - 0.4, player.wx));
  player.wy = Math.max(0.4, Math.min(WORLD_SIZE - 0.4, player.wy));

  // Stamina drain when running; regen when idle
  if (mag > 0) {
    player.stam = Math.max(0, player.stam - 5 * dt * (player._stamDrainMult || 1));
  } else {
    player.stam = Math.min(player.maxStam, player.stam + 8 * dt);
  }
  // Hemophobic: stamina drains while wounded
  if (player._hemophobic && player.hp < player.maxHp * 0.5) {
    player.stam = Math.max(0, player.stam - 2 * dt);
  }
  // Haunted: stamina trickle in darkness
  if (player._haunted && performance.now() % 4000 < 16) {
    player.stam = Math.max(0, player.stam - 0.5);
  }

  // Hunger/thirst slow decay
  player.hunger = Math.max(0, player.hunger - 0.30 * dt * (player._hungerDrainMult || 1));
  player.thirst = Math.max(0, player.thirst - 0.45 * dt * (player._thirstDrainMult || 1));

  // HP decay if starving/dehydrated
  if (player.hunger <= 0) player.hp = Math.max(0, player.hp - 0.5 * dt);
  if (player.thirst <= 0) player.hp = Math.max(0, player.hp - 0.8 * dt);

  // Mana regen
  const manaRegen = player.accessory && itemDef(player.accessory.item).manaRegen
    ? itemDef(player.accessory.item).manaRegen
    : 0.2;
  player.mana = Math.min(player.maxMana, player.mana + manaRegen * dt * 3 * (player._manaRegenMult || 1));

  // Update swing
  if (player.swing) {
    player.swing.t += dt * 1000;
    if (player.swing.t >= player.swing.dur) player.swing = null;
  }

  // Busy timer
  player.busyUntil = Math.max(0, player.busyUntil - dt * 1000);
  player.iframe = Math.max(0, player.iframe - dt * 1000);

  if (player.hp <= 0) {
    player.dead = true;
    player.hp = 0;
  }
}

function blockingProp(world, wx, wy) {
  for (const p of world.props) {
    if (!p.blocks || p.dead) continue;
    if (dist(p.wx, p.wy, wx, wy) < 0.5) return true;
  }
  return false;
}

/* Attempt a melee or ranged attack in player.facing direction */
function playerAttack(player, world, enemies, log, civilians = []) {
  if (player.dead) return;
  if (performance.now() < player.busyUntil) return;
  if (!player.weapon) {
    return doMelee(player, world, enemies, {
      name: 'Bare Hands', shape: 'fist',
      dmg: 4, range: 0.7, arc: 0.9, cooldown: 350, stamCost: 2
    }, log, civilians);
  }
  const def = itemDef(player.weapon.item);

  if (def.ranged) {
    return doRanged(player, world, enemies, def, log, civilians);
  }
  return doMelee(player, world, enemies, def, log, civilians);
}

function doMelee(player, world, enemies, def, log, civilians) {
  civilians = civilians || [];
  if (player.stam < def.stamCost) {
    log('You are too winded to swing.', 'dim');
    return;
  }
  player.stam -= def.stamCost;
  // Melee makes a smaller noise
  emitNoise(world, player.wx, player.wy, 5, 1200);
  const ang = player.facing;
  const arc = def.arc;
  const range = def.range;

  // Start swing animation
  player.swing = {
    startAng: ang - arc/2,
    endAng:   ang + arc/2,
    t: 0,
    dur: def.cooldown * 0.6,
    range, arc,
    weaponId: player.weapon ? player.weapon.item : null,
    hit: new Set()
  };
  player.busyUntil = performance.now() + def.cooldown;

  // Resolve damage immediately (single tick)
  let hits = 0;
  // Build combined target list (enemies + civilians)
  const targets = enemies.concat(civilians);
  for (const e of targets) {
    if (e.dying || e.dead) continue;
    const d = dist(e.wx, e.wy, player.wx, player.wy);
    if (d > range + 0.4) continue;
    const ea = Math.atan2(e.wy - player.wy, e.wx - player.wx);
    let da = ((ea - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(da) > arc/2 + 0.15) continue;
    // hit
    let dmg = def.dmg * (player._meleeDmgMult || 1);
    if (def.bonusVs === e.kind) dmg *= def.bonusMult;
    // Silver Tongue bonus when wielding the silver dagger
    if (player.weapon && player.weapon.item === 'silver_dagger' && player._silverBonus) {
      dmg *= 1 + player._silverBonus;
    }
    if (e.faction === 'civilian') {
      damageCivilian(e, dmg, player, log);
    } else {
      applyEnemyDamage(e, dmg, player);
    }
    hits++;
  }
  // Hit prop?
  for (const p of world.props) {
    if (!p.hp || p.dead) continue;
    const d = dist(p.wx, p.wy, player.wx, player.wy);
    if (d > range + 0.4) continue;
    const ea = Math.atan2(p.wy - player.wy, p.wx - player.wx);
    let da = ((ea - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(da) > arc/2 + 0.15) continue;
    p.hp -= def.dmg * 0.5;
    if (p.hp <= 0) breakProp(p, world, log);
  }

  return hits;
}

function doRanged(player, world, enemies, def, log, civilians) {
  civilians = civilians || [];
  // Check ammo / mana
  if (def.ammo === 'mana') {
    if (player.mana < def.manaCost) {
      log('Your mana wells are dry.', 'dim');
      return;
    }
    player.mana -= def.manaCost;
  } else if (def.ammo) {
    if (INVENTORY.countItem(def.ammo) <= 0) {
      log(`Out of ${itemDef(def.ammo).name.toLowerCase()}s.`, 'warn');
      return;
    }
    INVENTORY.consumeItem(def.ammo, 1);
  }
  player.busyUntil = performance.now() + def.cooldown;

  // Cast ray from player along facing
  const ang = player.facing;
  const maxR = def.range;
  let hitEnemy = null, hitDist = Infinity;
  const cosA = Math.cos(ang), sinA = Math.sin(ang);
  const candidates = enemies.concat(civilians);
  for (const e of candidates) {
    if (e.dying || e.dead) continue;
    const dx = e.wx - player.wx, dy = e.wy - player.wy;
    const proj = dx * cosA + dy * sinA;
    if (proj < 0 || proj > maxR) continue;
    const perp = Math.abs(-dx * sinA + dy * cosA);
    if (perp > 0.5) continue;
    if (proj < hitDist) { hitDist = proj; hitEnemy = e; }
  }
  // Also check props occluding
  let hitProp = null, hitPropDist = Infinity;
  for (const p of world.props) {
    if (!p.blocks || p.dead) continue;
    const dx = p.wx - player.wx, dy = p.wy - player.wy;
    const proj = dx * cosA + dy * sinA;
    if (proj < 0 || proj > maxR) continue;
    const perp = Math.abs(-dx * sinA + dy * cosA);
    if (perp > 0.5) continue;
    if (proj < hitPropDist) { hitPropDist = proj; hitProp = p; }
  }
  let endX, endY;
  if (hitEnemy && hitDist <= hitPropDist) {
    endX = hitEnemy.wx;
    endY = hitEnemy.wy;
    let dmg = def.dmg * (player._rangedDmgMult || 1);
    let spread = def.spread || 0;
    if (player._rangedSpread) spread = Math.max(spread, player._rangedSpread);
    if (spread > 0) dmg *= (1 - spread*0.5 + Math.random() * spread);
    if (hitEnemy.faction === 'civilian') {
      damageCivilian(hitEnemy, dmg, player, log);
    } else {
      applyEnemyDamage(hitEnemy, dmg, player);
    }
  } else if (hitProp) {
    endX = hitProp.wx;
    endY = hitProp.wy;
    if (hitProp.hp) {
      hitProp.hp -= def.dmg * 0.4;
      if (hitProp.hp <= 0) breakProp(hitProp, world, log);
    }
  } else {
    endX = player.wx + cosA * maxR;
    endY = player.wy + sinA * maxR;
  }

  player.shot = {
    from: { wx: player.wx, wy: player.wy },
    to: { wx: endX, wy: endY },
    time: performance.now(),
    kind: def.ammo === 'mana' ? 'staff' : (def.shape === 'bow' ? 'bow' : 'gun')
  };

  if (def.ammo === 'shotgun_shell' || def.ammo === 'pistol_round') {
    emitNoise(world, player.wx, player.wy, 22, 2200);
    for (const e of enemies) {
      if (dist(e.wx, e.wy, player.wx, player.wy) < 14) e.alert = true;
    }
  } else if (def.shape === 'bow') {
    emitNoise(world, player.wx, player.wy, 8, 1500);
  } else if (def.ammo === 'mana') {
    emitNoise(world, player.wx, player.wy, 8, 1500);
  }
}

function applyEnemyDamage(e, dmg, player) {
  e.hp -= dmg;
  e.alert = true;
  e.flashT = 200;
  // knockback
  const ang = Math.atan2(e.wy - player.wy, e.wx - player.wx);
  e.kb = { vx: Math.cos(ang) * 0.25, vy: Math.sin(ang) * 0.25, t: 120 };
  if (e.hp <= 0) {
    e.dying = 1; // ms
  }
}

function breakProp(p, world, log) {
  p.dead = true;
  p.blocks = false;
  if (p.type === 'tree') {
    log('The tree splinters and falls.', 'dim');
    INVENTORY.addItem('wood_plank', 2 + Math.floor(Math.random()*2));
  } else if (p.type === 'deadtree') {
    log('Brittle wood gives way.', 'dim');
    INVENTORY.addItem('wood_plank', 1);
  } else if (p.type === 'fence') {
    log('The fence shatters.', 'dim');
    INVENTORY.addItem('wood_plank', 1);
  } else if (p.type === 'barrel' || p.type === 'crate') {
    log(`${p.type === 'barrel' ? 'The barrel' : 'The crate'} bursts open.`, 'dim');
    // dump loot as drops
    if (p.loot) {
      for (const it of p.loot) {
        world.drops = world.drops || [];
        world.drops.push({ wx: p.wx + (Math.random()-.5)*0.4, wy: p.wy + (Math.random()-.5)*0.4, item: it.item, qty: it.qty });
      }
    }
  }
}

/* ============================================================
   Enemies
   ============================================================ */

const ENEMY_KINDS = {
  skeleton: {
    name: 'Skeleton', faction: 'monster',
    maxHp: 35, speed: 1.8, dmg: 8, atkRange: 0.9, atkCd: 1100,
    sightRange: 10, drops: [{ item: 'bone_shard', chance: 0.9, qty: [1,3] }]
  },
  wraith: {
    name: 'Wraith', faction: 'monster',
    maxHp: 22, speed: 2.5, dmg: 12, atkRange: 1.0, atkCd: 900,
    sightRange: 14, ghost: true,
    drops: [{ item: 'wraith_ash', chance: 1.0, qty: [1,2] }]
  },
  ghoul: {
    name: 'Ghoul', faction: 'monster',
    maxHp: 65, speed: 1.5, dmg: 14, atkRange: 1.0, atkCd: 1400,
    sightRange: 9,
    drops: [{ item: 'rag', chance: 0.6, qty: [1,2] }, { item: 'bone_shard', chance: 0.4, qty: [1,2] }]
  },
  cultist: {
    name: 'Cultist', faction: 'monster',
    maxHp: 28, speed: 1.6, dmg: 6, atkRange: 0.9, atkCd: 1000,
    sightRange: 13,
    magic: true, magicDmg: 16, magicRange: 7, magicCd: 1800, magicChargeMs: 500,
    drops: [
      { item: 'wraith_ash', chance: 0.85, qty: [1,2] },
      { item: 'rag', chance: 0.6, qty: [1,2] },
      { item: 'mana_potion', chance: 0.15, qty: [1,1] }
    ]
  },
  bandit: {
    name: 'Bandit', faction: 'human_hostile',
    maxHp: 55, speed: 2.0, dmg: 10, atkRange: 1.0, atkCd: 900,
    sightRange: 13,
    ranged: true, rangedDmg: 18, rangedRange: 8, rangedCd: 720, spread: 0.25,
    startAmmo: 8, fleeWhenOutOfAmmoChance: 0.55, hasMelee: true,
    keepDistanceTiles: 4.5,
    drops: [
      { item: 'pistol_round', chance: 0.6, qty: [2,6] },
      { item: 'rag', chance: 0.8, qty: [1,3] },
      { item: 'hunting_knife', chance: 0.15, qty: [1,1] }
    ]
  },
  guard: {
    name: 'Cursed Guard', faction: 'human_hostile',
    maxHp: 95, speed: 1.5, dmg: 16, atkRange: 1.0, atkCd: 1200,
    sightRange: 12,
    ranged: true, rangedDmg: 30, rangedRange: 6, rangedCd: 1000, spread: 0.5,
    startAmmo: 6, fleeWhenOutOfAmmoChance: 0, hasMelee: true,
    keepDistanceTiles: 3.0,
    drops: [
      { item: 'shotgun_shell', chance: 0.7, qty: [1,3] },
      { item: 'chainmail', chance: 0.12, qty: [1,1] },
      { item: 'med_bandage', chance: 0.3, qty: [1,1] }
    ]
  }
};

// Hostility matrix — which factions a given faction will attack
const HOSTILE_TO = {
  monster:        ['player', 'human_hostile', 'civilian'],
  human_hostile:  ['player', 'monster', 'civilian'],
  civilian:       [],
  player:         []   // player picks targets manually
};
function isHostileTo(myFaction, theirFaction) {
  const list = HOSTILE_TO[myFaction] || [];
  return list.includes(theirFaction);
}

function makeEnemy(kind, wx, wy) {
  const d = ENEMY_KINDS[kind];
  const enemy = {
    kind, wx, wy,
    faction: d.faction,
    hp: d.maxHp, maxHp: d.maxHp,
    speed: d.speed,
    state: 'idle',  // idle, chasing, attacking, engaging_ranged, engaging_melee, fleeing
    alert: false,
    cd: 0,
    rangedCd: 0,
    magicCd: 0,
    chargeMs: 0,
    ammo: d.ranged ? d.startAmmo : 0,
    fleeing: false,
    targetX: wx, targetY: wy,
    flashT: 0,
    dying: 0,
    kb: null,
    shot: null,
    target: null  // current combat target
  };
  return enemy;
}

/* ----- Civilian NPCs ----- */
const CIVILIAN_NAMES = [
  'Marya', 'Tom', 'Sister Elin', 'Old Joren', 'Ada', 'Pell', 'The Widow Hask',
  'Rin', 'Boran', 'Mother Ives'
];

const CIVILIAN_DIALOGUES = [
  {
    name_role: 'baker',
    lines: [
      "I keep my door barred. So should you.",
      "There were lights last night, in the chapel. Lights, and singing.",
      "Don't go after dark. Don't go alone."
    ]
  },
  {
    name_role: 'caretaker',
    lines: [
      "Half the graves are open. I stopped counting.",
      "The names on them — I knew most of those names.",
      "If you must pass through, do it before the wind turns."
    ]
  },
  {
    name_role: 'fisher',
    lines: [
      "Water's gone wrong. Wouldn't drink from the pond.",
      "Pulled something up in my net I won't speak of.",
      "There are bandits on the south road. Be careful."
    ]
  },
  {
    name_role: 'farmhand',
    lines: [
      "Three nights now, the dogs won't go out.",
      "Something's been taking the lambs. Not a wolf.",
      "If you find Joren's boy, tell him his mother's still waiting."
    ]
  },
  {
    name_role: 'shopkeep',
    lines: [
      "Shelves are empty. They've been empty a week.",
      "The guards say they're here to protect us. The guards are why I keep my back to the wall.",
      "I'd trade — but I have nothing left to trade."
    ]
  },
  {
    name_role: 'priest, unfrocked',
    lines: [
      "I lit the chapel candles. They blew out without wind.",
      "Whatever wears the cassock now is not who he was.",
      "Walk in light. While there still is light."
    ]
  }
];

function makeCivilian(wx, wy) {
  const nameIdx = Math.floor(Math.random() * CIVILIAN_NAMES.length);
  const dialIdx = Math.floor(Math.random() * CIVILIAN_DIALOGUES.length);
  return {
    kind: 'civilian',
    faction: 'civilian',
    wx, wy,
    homeX: wx, homeY: wy,
    hp: 28, maxHp: 28,
    speed: 1.4,
    facing: -Math.PI / 2,
    name: CIVILIAN_NAMES[nameIdx],
    role: CIVILIAN_DIALOGUES[dialIdx].name_role,
    dialogue: CIVILIAN_DIALOGUES[dialIdx].lines,
    appearance: Math.floor(Math.random() * 3),  // 0-2 silhouette variant
    fleeing: false,
    wanderTarget: null,
    wanderCd: 0,
    talkedTo: false,
    dying: 0,
    dead: false
  };
}

function updateCivilian(c, dt, world, player, enemies, log) {
  if (c.dead) return;
  if (c.dying) {
    c.dying += dt * 1000;
    if (c.dying > 800) c.dead = true;
    return;
  }
  // Detect hostiles nearby (player is neutral to civilians unless attacked)
  let threat = null, threatD = 7;
  for (const e of enemies) {
    if (e.dying) continue;
    const f = ENEMY_KINDS[e.kind].faction;
    if (f === 'monster' || f === 'human_hostile') {
      const d = dist(c.wx, c.wy, e.wx, e.wy);
      if (d < threatD) { threatD = d; threat = e; }
    }
  }
  // Player attacking me?
  if (c._aggrievedAt && performance.now() - c._aggrievedAt < 6000) {
    const dp = dist(c.wx, c.wy, player.wx, player.wy);
    if (dp < 8) threat = { wx: player.wx, wy: player.wy };
  }
  if (threat) {
    c.fleeing = true;
    const ang = Math.atan2(c.wy - threat.wy, c.wx - threat.wx);
    c.facing = ang;
    const tx = c.wx + Math.cos(ang) * 4;
    const ty = c.wy + Math.sin(ang) * 4;
    moveToward(c, tx, ty, c.speed * 1.3 * dt, world);
    return;
  }
  c.fleeing = false;
  // Wander toward home / random
  c.wanderCd -= dt;
  if (c.wanderCd <= 0 || !c.wanderTarget) {
    c.wanderTarget = {
      x: c.homeX + (Math.random() - 0.5) * 5,
      y: c.homeY + (Math.random() - 0.5) * 5
    };
    c.wanderCd = 2 + Math.random() * 3;
  }
  const wt = c.wanderTarget;
  const d = dist(c.wx, c.wy, wt.x, wt.y);
  if (d < 0.2) {
    // idle
  } else {
    const ang = Math.atan2(wt.y - c.wy, wt.x - c.wx);
    c.facing = ang;
    moveToward(c, wt.x, wt.y, c.speed * 0.5 * dt, world);
  }
}

function moveToward(c, tx, ty, step, world) {
  const dx = tx - c.wx, dy = ty - c.wy;
  const m = Math.hypot(dx, dy);
  if (m < 0.05) return;
  const nx = c.wx + (dx / m) * step;
  const ny = c.wy + (dy / m) * step;
  if (isWalkable(world, nx, c.wy)) c.wx = nx;
  if (isWalkable(world, c.wx, ny)) c.wy = ny;
}

function damageCivilian(c, dmg, attacker, log) {
  c.hp -= dmg;
  c.flashT = 200;
  if (attacker && attacker === window._player_ref) {
    c._aggrievedAt = performance.now();
  }
  if (c.hp <= 0) {
    c.dying = 1;
    if (log) log(`${c.name}, the ${c.role}, falls.`, 'warn');
  }
}

function findTarget(self, world, player, enemies, civilians) {
  const myFaction = self.faction;
  if (!HOSTILE_TO[myFaction] || HOSTILE_TO[myFaction].length === 0) return null;
  const sight = ENEMY_KINDS[self.kind].sightRange;
  let best = null, bestD = sight + 1.5;
  function consider(t) {
    if (!t) return;
    const d = dist(self.wx, self.wy, t.wx, t.wy);
    if (d >= bestD) return;
    if (!ISO.hasLineOfSight(world, self.wx, self.wy, t.wx, t.wy)) return;
    bestD = d; best = t;
  }
  if (isHostileTo(myFaction, 'player') && !player.dead) consider(player);
  if (isHostileTo(myFaction, 'civilian') && civilians) {
    for (const c of civilians) {
      if (c.dead || c.dying) continue;
      consider(c);
    }
  }
  for (const o of enemies) {
    if (o === self || o.dying) continue;
    const oFaction = ENEMY_KINDS[o.kind].faction;
    if (isHostileTo(myFaction, oFaction)) consider(o);
  }
  return best;
}

// Find a recent noise the enemy can hear (no LOS required)
function findNoise(self, world) {
  if (!world.noises || world.noises.length === 0) return null;
  const now = performance.now();
  let best = null, bestD = Infinity;
  for (const n of world.noises) {
    if (now - n.time > n.duration) continue;
    const d = dist(self.wx, self.wy, n.wx, n.wy);
    if (d > n.radius) continue;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

function emitNoise(world, wx, wy, radius, duration) {
  world.noises = world.noises || [];
  world.noises.push({ wx, wy, radius, time: performance.now(), duration: duration || 2500 });
  const now = performance.now();
  world.noises = world.noises.filter(n => now - n.time < n.duration);
}

// Apply damage to any target (player, enemy, civilian) uniformly.
// Returns true if target died/dying this hit.
function damageTarget(target, dmg, attacker, log) {
  if (!target) return false;
  // Player
  if (target.maxHp !== undefined && target.faction === undefined && target.maxStam !== undefined) {
    // It's the player (heuristic: has stamina)
    if (target.iframe > 0 || target.dead) return false;
    target.hp -= dmg;
    target.lastHitT = performance.now();
    target.iframe = 250 * (target._iframeMult || 1);
    if (log && attacker) {
      const name = attacker.kind ? (ENEMY_KINDS[attacker.kind] ? ENEMY_KINDS[attacker.kind].name : attacker.kind) : 'Something';
      log(`${name} hits you for ${Math.round(dmg)}.`, 'warn');
    }
    return target.hp <= 0;
  }
  // Civilian
  if (target.faction === 'civilian') {
    target.hp -= dmg;
    target.flashT = 200;
    if (target.hp <= 0 && !target.dying) {
      target.dying = 1;
      if (log) log(`${target.name}, the ${target.role}, falls.`, 'warn');
      return true;
    }
    return false;
  }
  // Other enemy
  if (target.kind && target.maxHp !== undefined) {
    if (target.dying) return false;
    target.hp -= dmg;
    target.flashT = 200;
    target.alert = true;
    if (target.hp <= 0) {
      target.dying = 1;
      return true;
    }
    return false;
  }
  return false;
}

function updateEnemy(e, dt, world, player, enemies, log, civilians = []) {
  if (e.dying) {
    e.dying += dt * 1000;
    if (e.dying > 600) e.dead = true;
    return;
  }
  const def = ENEMY_KINDS[e.kind];
  e.cd = Math.max(0, e.cd - dt * 1000);
  e.rangedCd = Math.max(0, e.rangedCd - dt * 1000);
  e.magicCd = Math.max(0, e.magicCd - dt * 1000);
  e.flashT = Math.max(0, e.flashT - dt * 1000);

  // Knockback movement
  if (e.kb) {
    e.wx += e.kb.vx;
    e.wy += e.kb.vy;
    e.kb.t -= dt * 1000;
    if (e.kb.t <= 0) e.kb = null;
  }

  // ----- Find a target based on faction -----
  const target = findTarget(e, world, player, enemies, civilians);
  if (target) {
    e.target = target;
    const sight = ENEMY_KINDS[e.kind].sightRange;
    const effSight = sight * (player._hardHearing && target === player ? 1.2 : 1.0);
    const td = dist(e.wx, e.wy, target.wx, target.wy);
    if (td < effSight) e.alert = true;
  } else {
    // No visible target — investigate noises
    const noise = findNoise(e, world);
    if (noise) {
      e.alert = true;
      e.targetX = noise.wx + (Math.random() - 0.5);
      e.targetY = noise.wy + (Math.random() - 0.5);
      moveTowards(e, e.targetX, e.targetY, ENEMY_KINDS[e.kind].speed * 0.7 * dt, world, ENEMY_KINDS[e.kind].ghost);
      return;
    }
  }
  if (!e.alert || !target) {
    if (Math.random() < dt * 0.4) {
      e.targetX = e.wx + (Math.random() - 0.5) * 3;
      e.targetY = e.wy + (Math.random() - 0.5) * 3;
    }
    moveTowards(e, e.targetX, e.targetY, def.speed * 0.4 * dt, world, def.ghost);
    return;
  }

  const d = dist(e.wx, e.wy, target.wx, target.wy);

  // ----- Fleeing behavior -----
  if (e.fleeing) {
    const ang = Math.atan2(e.wy - target.wy, e.wx - target.wx);
    const tx = e.wx + Math.cos(ang) * 5;
    const ty = e.wy + Math.sin(ang) * 5;
    moveTowards(e, tx, ty, def.speed * 1.1 * dt, world, def.ghost);
    return;
  }

  // ----- Magic-caster behavior (cultist) -----
  if (def.magic) {
    if (d > def.magicRange) {
      moveTowards(e, target.wx, target.wy, def.speed * dt, world, def.ghost);
    } else if (d < def.magicRange * 0.5) {
      const ang = Math.atan2(e.wy - target.wy, e.wx - target.wx);
      moveTowards(e, e.wx + Math.cos(ang) * 1, e.wy + Math.sin(ang) * 1, def.speed * 0.7 * dt, world, def.ghost);
    }
    if (e.magicCd <= 0 && d < def.magicRange + 0.5 && !(target.dead || target.dying)) {
      if (!ISO.hasLineOfSight(world, e.wx, e.wy, target.wx, target.wy)) {
        return;
      }
      e.magicCd = def.magicCd;
      e.shot = {
        from: { wx: e.wx, wy: e.wy - 0.3 },
        to:   { wx: target.wx, wy: target.wy - 0.3 },
        time: performance.now(),
        kind: 'magic'
      };
      let dmg = def.magicDmg;
      if (target === player) {
        dmg *= (player._dmgTakenMult || 1);
        const armor = player.armor ? itemDef(player.armor.item).defense : 0;
        dmg = Math.max(1, dmg - armor * 0.5);
        if (player.iframe <= 0) {
          damageTarget(target, dmg, e, log);
          if (target === player) log(`A bolt of cold flame burns you for ${Math.round(dmg)}.`, 'warn');
        }
      } else {
        damageTarget(target, dmg, e, log);
      }
    }
    return;
  }

  // ----- Ranged human enemies (bandit, guard) -----
  if (def.ranged) {
    if (e.ammo <= 0 && !e._ammoDecisionMade) {
      e._ammoDecisionMade = true;
      const flee = Math.random() < (def.fleeWhenOutOfAmmoChance || 0);
      if (flee || !def.hasMelee) {
        e.fleeing = true;
        if (log) log(`${def.name} is out — and running.`, 'dim');
        return;
      } else {
        if (log) log(`${def.name} draws a blade.`, 'dim');
      }
    }
    if (e.ammo > 0) {
      const keep = def.keepDistanceTiles || 4;
      if (d > keep + 1.5) {
        moveTowards(e, target.wx, target.wy, def.speed * dt, world, def.ghost);
      } else if (d < keep - 1) {
        const ang = Math.atan2(e.wy - target.wy, e.wx - target.wx);
        moveTowards(e, e.wx + Math.cos(ang)*2, e.wy + Math.sin(ang)*2, def.speed * 0.7 * dt, world, def.ghost);
      }
      if (e.rangedCd <= 0 && d < def.rangedRange + 1 && !(target.dead || target.dying)) {
        // Line of sight required for ranged
        if (!ISO.hasLineOfSight(world, e.wx, e.wy, target.wx, target.wy)) {
          return;
        }
        e.rangedCd = def.rangedCd;
        e.ammo--;
        // Gunshot makes loud noise — pulls in monsters
        emitNoise(world, e.wx, e.wy, 18, 2200);
        const spread = def.spread || 0;
        const miss = Math.random() < spread * 0.7;
        e.shot = {
          from: { wx: e.wx, wy: e.wy - 0.3 },
          to:   { wx: miss ? target.wx + (Math.random()-0.5)*2 : target.wx,
                  wy: miss ? target.wy + (Math.random()-0.5)*2 : target.wy - 0.3 },
          time: performance.now(),
          kind: 'bullet'
        };
        if (!miss) {
          let dmg = def.rangedDmg;
          if (target === player) {
            dmg *= (player._dmgTakenMult || 1);
            const armor = player.armor ? itemDef(player.armor.item).defense : 0;
            const shieldDef = player.shield && player.blocking ? itemDef(player.shield.item).defense : 0;
            dmg = Math.max(1, dmg - armor - shieldDef);
            if (player.iframe <= 0) {
              damageTarget(target, dmg, e, log);
            }
          } else {
            damageTarget(target, dmg, e, log);
          }
        }
      }
      return;
    }
  }

  // ----- Melee (default & fallback) -----
  if (d > def.atkRange) {
    e.state = 'chasing';
    moveTowards(e, target.wx, target.wy, def.speed * dt, world, def.ghost);
  } else {
    e.state = 'attacking';
    if (e.cd <= 0 && !(target.dead || target.dying)) {
      e.cd = def.atkCd;
      let dmg = def.dmg;
      if (target === player) {
        const armor = player.armor ? itemDef(player.armor.item).defense : 0;
        const shieldDef = player.shield ? itemDef(player.shield.item).defense : 0;
        let block = 0;
        if (player.blocking && player.shield) {
          block = itemDef(player.shield.item).block || 0;
        }
        dmg = Math.max(1, dmg - armor - shieldDef - dmg * block);
        dmg *= (player._dmgTakenMult || 1);
        if (player.iframe <= 0) damageTarget(target, dmg, e, log);
      } else {
        damageTarget(target, dmg, e, log);
      }
    }
  }
}

function moveTowards(e, tx, ty, step, world, ghost) {
  const dx = tx - e.wx, dy = ty - e.wy;
  const m = Math.hypot(dx, dy);
  if (m < 0.05) return;
  const nx = e.wx + (dx / m) * step;
  const ny = e.wy + (dy / m) * step;
  if (ghost) {
    e.wx = nx; e.wy = ny;
    return;
  }
  // Try to move; if blocked by a closed door, interact with it
  const blockedX = !isWalkable(world, nx, e.wy);
  const blockedY = !isWalkable(world, e.wx, ny);
  if (blockedX || blockedY) {
    const def = ENEMY_KINDS[e.kind];
    const myFaction = def.faction;
    const doorHit = ISO.nearestDoor(world, e.wx + (dx/m)*0.5, e.wy + (dy/m)*0.5, 1.1);
    if (doorHit && doorHit.distance < 1.0) {
      const s = doorHit.structure;
      const door = doorHit.isInterior ? s.interiorDoor : s.door;
      if (door && !door.open) {
        if (myFaction === 'human_hostile' || myFaction === 'civilian') {
          door.open = true;
        } else if (myFaction === 'monster') {
          // Beat down the door
          e.doorCd = (e.doorCd || 0) - 16; // approx ms decrement; use real dt-aware version when possible
          if (!e._lastBashT || performance.now() - e._lastBashT > 700) {
            e._lastBashT = performance.now();
            door.hp = (door.hp || 30) - (def.dmg || 8);
            if (door.hp <= 0) {
              door.open = true;
            }
          }
        }
      }
    }
  }
  if (!blockedX) e.wx = nx;
  if (!blockedY) e.wy = ny;
}

function spawnDrops(e, world) {
  const def = ENEMY_KINDS[e.kind];
  if (!def.drops) return;
  world.drops = world.drops || [];
  for (const d of def.drops) {
    if (Math.random() < d.chance) {
      const q = d.qty[0] + Math.floor(Math.random() * (d.qty[1] - d.qty[0] + 1));
      world.drops.push({ wx: e.wx + (Math.random()-.5)*0.3, wy: e.wy + (Math.random()-.5)*0.3, item: d.item, qty: q });
    }
  }
}

window.ENTITIES = {
  makePlayer, updatePlayer, playerAttack,
  makeEnemy, updateEnemy, ENEMY_KINDS, spawnDrops,
  makeCivilian, updateCivilian, damageCivilian,
  HOSTILE_TO, isHostileTo, findTarget, damageTarget
};
})();

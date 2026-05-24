/* ============================================================
   Main game loop, input, state, time
   ============================================================ */

(function () {
  const canvas = document.getElementById('world');
  RENDER.init(canvas);
  UI.initMinimap();

  // Characters are 3D models (handled in Godot); the prototype draws
  // silhouette placeholders. No sprite sheet loaded here.

  // World + entities
  const world = ISO.genWorld();
  world.drops = [];
  const player = ENTITIES.makePlayer();
  // Re-apply traits / Past Life
  const savedTraits = TRAITS.load() || [];
  TRAITS.applyTraits(player, savedTraits);
  const savedJob = JOBS.load() || 'none';
  const jobDef = JOBS.applyJob(player, savedJob);
  const enemies = [];
  const civilians = [];

  // Spawn enemies
  function spawnEnemies() {
    // Cemetery: skeletons + a cultist
    for (let i = 0; i < 5; i++) {
      const x = 7 + Math.random() * 10;
      const y = 7 + Math.random() * 8;
      enemies.push(ENTITIES.makeEnemy('skeleton', x, y));
    }
    enemies.push(ENTITIES.makeEnemy('cultist', 12, 10));

    // Wraiths near chapel + a cultist
    for (let i = 0; i < 3; i++) {
      const x = 40 + Math.random() * 9;
      const y = 42 + Math.random() * 10;
      enemies.push(ENTITIES.makeEnemy('wraith', x, y));
    }
    enemies.push(ENTITIES.makeEnemy('cultist', 45, 50));

    // Ghouls scattered far field
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * 60;
      const y = Math.random() * 60;
      if (ISO.dist(x, y, player.wx, player.wy) < 12) { i--; continue; }
      if (!ISO.isWalkable(world, x, y)) { i--; continue; }
      enemies.push(ENTITIES.makeEnemy('ghoul', x, y));
    }
    // Bandits camped near house 2 (SW)
    enemies.push(ENTITIES.makeEnemy('bandit', 10, 38));
    enemies.push(ENTITIES.makeEnemy('bandit', 14, 51));
    // Bandits along road
    enemies.push(ENTITIES.makeEnemy('bandit', 28, 18));
    // Guards near the convenience store
    enemies.push(ENTITIES.makeEnemy('guard', 22, 28));
    enemies.push(ENTITIES.makeEnemy('guard', 38, 30));
    // A few skeletons wandering
    for (let i = 0; i < 4; i++) {
      const x = Math.random() * 60;
      const y = Math.random() * 60;
      if (ISO.dist(x, y, player.wx, player.wy) < 10) { i--; continue; }
      if (!ISO.isWalkable(world, x, y)) { i--; continue; }
      enemies.push(ENTITIES.makeEnemy('skeleton', x, y));
    }
  }
  spawnEnemies();

  // Spawn civilians — humans trying to survive
  function spawnCivilians() {
    const spots = [
      { wx: 26, wy: 26 },   // by convenience store
      { wx: 33, wy: 36 },   // by player spawn
      { wx: 44, wy: 22 },   // by house 1
      { wx: 12, wy: 44 },   // by house 2
      { wx: 30, wy: 38 },   // road
      { wx: 18, wy: 30 }    // near store
    ];
    for (const sp of spots) {
      if (ISO.isWalkable(world, sp.wx, sp.wy)) {
        civilians.push(ENTITIES.makeCivilian(sp.wx, sp.wy));
      }
    }
  }
  spawnCivilians();

  // Starting inventory — determined by Past Life
  JOBS.applyStarterInventory(savedJob);
  // Common baseline items everyone gets
  INVENTORY.addItem('med_bandage', 1);
  INVENTORY.addItem('water_bottle', 1);
  // Equip rusted sword + leather vest into starting slots
  INVENTORY.equip(0); // first weapon-kind item
  // Find leather vest index and equip
  for (let i = 0; i < INVENTORY.state.slots.length; i++) {
    if (INVENTORY.state.slots[i] && itemDef(INVENTORY.state.slots[i].item).kind === 'armor') {
      INVENTORY.equip(i);
      break;
    }
  }
  // Equip a shield if the starter pack has one
  for (let i = 0; i < INVENTORY.state.slots.length; i++) {
    if (INVENTORY.state.slots[i] && itemDef(INVENTORY.state.slots[i].item).kind === 'accessory') {
      INVENTORY.equip(i);
      break;
    }
  }
  // Sync player.weapon / armor
  function syncEquipment() {
    player.weapon = INVENTORY.state.equipment.weapon;
    player.armor = INVENTORY.state.equipment.armor;
    player.shield = INVENTORY.state.equipment.shield;
    player.accessory = INVENTORY.state.equipment.accessory;
  }
  syncEquipment();
  // Set hotbar
  for (let i = 0; i < INVENTORY.state.slots.length; i++) {
    const s = INVENTORY.state.slots[i];
    if (!s) continue;
    const def = itemDef(s.item);
    if (def.kind === 'weapon') {
      const idx = INVENTORY.state.hotbar.indexOf(null);
      if (idx !== -1) INVENTORY.setHotbar(idx, i);
    }
  }
  // Put equipped weapon as hotbar slot 1 (special: -1 means "equipped")
  INVENTORY.state.hotbar[0] = -1; // sentinel for equipped weapon

  // ----- Dialogue system -----
  const dialogue = (() => {
    let open = false;
    let currentLines = [];
    let lineIdx = 0;
    let speaker = null;

    function isOpen() { return open; }

    function openWith(npc) {
      open = true;
      speaker = npc;
      currentLines = npc.dialogue;
      lineIdx = 0;
      npc.talkedTo = true;
      GameState.paused = true; // optional pause; we don't have a GameState but conceptually
      _render();
    }

    function advance() {
      if (!open) return;
      lineIdx++;
      if (lineIdx >= currentLines.length) {
        close();
      } else {
        _render();
      }
    }

    function close() {
      open = false;
      speaker = null;
      const el = document.getElementById('dialogue');
      el.classList.remove('show');
    }

    function _render() {
      const el = document.getElementById('dialogue');
      el.classList.add('show');
      el.querySelector('.speaker').textContent = `${speaker.name}, the ${speaker.role}`;
      el.querySelector('.line').textContent = currentLines[lineIdx];
      el.querySelector('.progress').textContent = `${lineIdx + 1} / ${currentLines.length}`;
      const hint = el.querySelector('.advance-hint');
      hint.textContent = lineIdx === currentLines.length - 1 ? 'press SPACE / click to leave' : 'press SPACE / click to continue';
    }

    // Click anywhere on the dialogue box advances
    document.getElementById('dialogue').addEventListener('click', () => advance());

    return { openWith, advance, close, isOpen };
  })();

  // GameState stub — used by dialogue to "pause"
  const GameState = { paused: false };

  // SPACE key for dialogue advance + general
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && dialogue.isOpen()) {
      e.preventDefault();
      dialogue.advance();
    }
  });
  const keys = {};
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let mouseDown = false, rmbDown = false;

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    handleKeyDown(e);
  });
  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Mouse2' || e.code === 'KeyB') player.blocking = false;
  });
  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    UI.moveCursor(mouseX, mouseY);
  });
  canvas.addEventListener('mousedown', e => {
    if (UI.isAnyPanelOpen()) return;
    if (e.button === 0) { mouseDown = true; tryAttack(); }
    if (e.button === 2) { rmbDown = true; player.blocking = !!player.shield; }
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2) { rmbDown = false; player.blocking = false; }
  });
  window.addEventListener('contextmenu', e => e.preventDefault());

  function handleKeyDown(e) {
    if (e.code === 'Tab' || e.code === 'KeyI') {
      e.preventDefault();
      if (UI.isAnyPanelOpen()) UI.closePanels();
      else UI.openInventory(player);
    } else if (e.code === 'KeyC') {
      if (UI.isAnyPanelOpen()) UI.closePanels();
      else UI.openCrafting();
    } else if (e.code === 'KeyE') {
      tryInteract();
    } else if (e.code === 'KeyF') {
      tryInteract();
    } else if (e.code === 'Escape') {
      UI.closePanels();
    } else if (e.code === 'KeyR') {
      tryReloadFromInventory();
    } else if (e.code === 'KeyK') {
      if (root_creator_open()) CREATOR.close();
      else CREATOR.open('traits');
    } else if (/^Digit[1-5]$/.test(e.code)) {
      const i = parseInt(e.code.slice(5)) - 1;
      selectHotbar(i);
    } else if (e.code === 'Space') {
      tryAttack(); // alternative attack
    }
  }

  function selectHotbar(i) {
    const slotIdx = INVENTORY.state.hotbar[i];
    if (slotIdx === null) return;
    if (slotIdx === -1) return; // already equipped weapon
    const data = INVENTORY.state.slots[slotIdx];
    if (!data) return;
    const def = itemDef(data.item);
    if (def.kind === 'weapon') {
      INVENTORY.equip(slotIdx);
      // Move sentinel to slot 0
      INVENTORY.state.hotbar[i] = -1;
      // Old sentinel slot becomes a normal pointer if exists
      INVENTORY.state.hotbar[0] = -1;
      syncEquipment();
      UI.log(`Equipped ${def.name}.`, 'good');
    } else if (def.kind === 'consumable') {
      useConsumable(slotIdx);
    }
  }

  function tryAttack() {
    if (UI.isAnyPanelOpen()) return;
    if (dialogue.isOpen()) return;
    ENTITIES.playerAttack(player, world, enemies, UI.log, civilians);
  }

  function tryInteract() {
    // Speak to civilian within 1.4 tiles
    for (const c of civilians) {
      if (c.dead || c.dying) continue;
      if (ISO.dist(c.wx, c.wy, player.wx, player.wy) < 1.5) {
        dialogue.openWith(c);
        return;
      }
    }
    // Light switch
    for (const p of world.props) {
      if (p.type === 'light_switch' && !p.dead) {
        if (ISO.dist(p.wx, p.wy, player.wx, player.wy) < 1.3) {
          p.structure.lit = !p.structure.lit;
          UI.log(p.structure.lit ? 'The light flickers on.' : 'You snuff the light.', 'dim');
          return;
        }
      }
    }
    // Door toggle — interior or exterior
    const doorHit = ISO.nearestDoor(world, player.wx, player.wy, 1.4);
    if (doorHit && doorHit.distance < 1.3) {
      const s = doorHit.structure;
      const d = doorHit.isInterior ? s.interiorDoor : s.door;
      d.open = !d.open;
      UI.log(d.open ? 'The door creaks open.' : 'You push the door closed.', 'dim');
      return;
    }
    // Container
    for (const p of world.props) {
      if (p.dead && !p.container) continue;
      if (ISO.dist(p.wx, p.wy, player.wx, player.wy) < 1.4) {
        if (p.container) {
          if (p.loot && p.loot.length > 0) {
            p.opened = true;
            UI.openLoot(p);
            return;
          } else {
            UI.log('Nothing left.', 'dim');
            return;
          }
        }
      }
    }
    // Drops pickup
    for (let i = 0; i < world.drops.length; i++) {
      const d = world.drops[i];
      if (ISO.dist(d.wx, d.wy, player.wx, player.wy) < 1.0) {
        if (INVENTORY.addItem(d.item, d.qty)) {
          UI.log(`Picked up ${itemDef(d.item).name}${d.qty>1 ? ' ×' + d.qty : ''}.`, 'good');
          world.drops.splice(i, 1);
          return;
        } else {
          UI.log('Pockets full.', 'warn');
          return;
        }
      }
    }
  }

  function useConsumable(slotIdx) {
    const s = INVENTORY.state.slots[slotIdx];
    if (!s) return;
    const def = itemDef(s.item);
    if (def.kind !== 'consumable') return;
    let used = false;
    if (def.heal && player.hp < player.maxHp) {
      const heal = Math.round(def.heal * (player._healMult || 1));
      player.hp = Math.min(player.maxHp, player.hp + heal);
      UI.log(`You bind the wound. +${heal} HP.`, 'good');
      used = true;
    }
    if (def.hunger && player.hunger < player.maxHunger) {
      player.hunger = Math.min(player.maxHunger, player.hunger + def.hunger);
      UI.log('A meal. You feel steadier.', 'good');
      used = true;
    }
    if (def.thirst && player.thirst < player.maxThirst) {
      player.thirst = Math.min(player.maxThirst, player.thirst + def.thirst);
      UI.log('Cool water.', 'good');
      used = true;
    }
    if (def.mana && player.mana < player.maxMana) {
      player.mana = Math.min(player.maxMana, player.mana + def.mana);
      UI.log('Power floods back.', 'good');
      used = true;
    }
    if (def.special === 'illume') {
      illuminate = performance.now() + 30000;
      UI.log('The scroll catches alight. Night recedes.', 'good');
      used = true;
    }
    if (used) {
      INVENTORY.removeItem(slotIdx, 1);
      if (UI.isAnyPanelOpen()) UI.renderInventory(player);
    } else {
      UI.log('No effect.', 'dim');
    }
  }

  function tryReloadFromInventory() {
    if (!player.weapon) return;
    const def = itemDef(player.weapon.item);
    if (!def.ranged || def.ammo === 'mana') return;
    const have = INVENTORY.countItem(def.ammo);
    if (have > 0) UI.log(`${itemDef(def.ammo).name}s ready: ${have}.`, 'dim');
    else UI.log(`No ${itemDef(def.ammo).name.toLowerCase()}s.`, 'warn');
  }

  /* ----- UI action handler ----- */
  UI.init({
    onAction(act) {
      if (act.type === 'use_slot') {
        const s = INVENTORY.state.slots[act.slot];
        if (!s) return;
        const def = itemDef(s.item);
        if (def.kind === 'weapon' || def.kind === 'armor' || def.kind === 'shield' || def.kind === 'accessory') {
          INVENTORY.equip(act.slot);
          syncEquipment();
          UI.log(`Equipped ${def.name}.`, 'good');
        } else if (def.kind === 'consumable') {
          useConsumable(act.slot);
        }
        UI.renderInventory(player);
        UI.updateHotbar(player);
      } else if (act.type === 'drop_slot') {
        const s = INVENTORY.state.slots[act.slot];
        if (!s) return;
        world.drops.push({ wx: player.wx, wy: player.wy + 0.5, item: s.item, qty: s.qty });
        INVENTORY.removeItem(act.slot, s.qty);
        UI.renderInventory(player);
      } else if (act.type === 'unequip') {
        if (INVENTORY.unequip(act.slot)) {
          syncEquipment();
          UI.renderInventory(player);
          UI.updateHotbar(player);
        } else {
          UI.log('No room in pack.', 'warn');
        }
      } else if (act.type === 'take_loot') {
        const c = act.container;
        const l = c.loot[act.idx];
        if (!l) return;
        // Scavenger: 30% chance to roll an extra unit
        let qty = l.qty;
        if (player._scavenger && Math.random() < 0.30) qty += 1;
        if (INVENTORY.addItem(l.item, qty)) {
          UI.log(`Took ${itemDef(l.item).name}${qty>1 ? ' ×' + qty : ''}.`, 'good');
          c.loot.splice(act.idx, 1);
          UI.renderLoot(c);
        } else {
          UI.log('Pockets full.', 'warn');
        }
      } else if (act.type === 'take_all') {
        const c = act.container;
        for (let i = c.loot.length - 1; i >= 0; i--) {
          const l = c.loot[i];
          if (INVENTORY.addItem(l.item, l.qty)) {
            c.loot.splice(i, 1);
          }
        }
        UI.log('Stripped the lot.', 'good');
        UI.renderLoot(c);
      } else if (act.type === 'craft') {
        if (craft(act.recipe)) {
          UI.log(`Crafted ${itemDef(act.recipe.output.item).name}.`, 'good');
          UI.renderCrafting();
        }
      }
    }
  });

  // Hotbar slot click
  document.querySelectorAll('#hotbar .slot').forEach((s, i) => {
    s.addEventListener('click', () => selectHotbar(i));
  });

  /* ----- Time of day ----- */
  let illuminate = 0;
  const time = { minutes: 17 * 60 }; // start at 17:00 — dusk
  const dayLengthRealSeconds = 240; // 4 minutes IRL = full day
  const minPerSec = (24 * 60) / dayLengthRealSeconds;

  function updateLightingOverlay() {
    const minOfDay = time.minutes % (24 * 60);
    const h = minOfDay / 60;
    // 0..1 darkness curve
    let darkness;
    if (h >= 7 && h < 17) darkness = 0;
    else if (h >= 5 && h < 7) darkness = (7 - h) / 2 * 0.6;
    else if (h >= 17 && h < 19) darkness = (h - 17) / 2 * 0.75;
    else if (h >= 19 && h < 22) darkness = 0.75 + ((h - 19) / 3) * 0.2;
    else darkness = 0.95;
    if (performance.now() < illuminate) darkness *= 0.2;
    document.getElementById('night-overlay').style.background =
      `oklch(0.10 0.06 250 / ${darkness * 0.78})`;
  }

  /* ----- Main loop ----- */
  let last = performance.now();
  let foreboding = performance.now() + 8000;
  const forebodingLines = [
    'The wind smells of rust and old prayer.',
    'Something shifts in the cemetery.',
    'You feel the cold creeping in.',
    'A name you do not recognize, whispered.',
    'The road forgets where it was going.',
    'Old wood ticks like a clock.',
    'The horizon is wrong tonight.'
  ];

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Movement input → velocity
    const up = keys['KeyW'] || keys['ArrowUp'];
    const dn = keys['KeyS'] || keys['ArrowDown'];
    const lf = keys['KeyA'] || keys['ArrowLeft'];
    const rt = keys['KeyD'] || keys['ArrowRight'];
    // In iso, "up" on screen should reduce both wx and wy; "right" increases wx and reduces wy
    let vx = 0, vy = 0;
    if (up) { vx -= 1; vy -= 1; }
    if (dn) { vx += 1; vy += 1; }
    if (lf) { vx -= 1; vy += 1; }
    if (rt) { vx += 1; vy -= 1; }
    player.vx = vx;
    player.vy = vy;

    // Facing direction from mouse
    if (!player.dead) {
      const cam = RENDER.cam;
      const sw = window.innerWidth, sh = window.innerHeight;
      const cx = sw / 2, cy = sh / 2;
      // mouse direction in screen space relative to player (assume player on-screen near center)
      const playerScreen = ISO.worldToScreen(player.wx, player.wy, RENDER.cam);
      const mxRel = mouseX - playerScreen.x;
      const myRel = mouseY - playerScreen.y;
      // Convert screen vector back into world facing angle (un-iso)
      const wxDir = mxRel / ISO.HALF_W + myRel / ISO.HALF_H;
      const wyDir = myRel / ISO.HALF_H - mxRel / ISO.HALF_W;
      const ang = Math.atan2(wyDir, wxDir);
      player.facing = ang;
      player.targetAng = ang;
    }

    // Hold-to-attack
    if (mouseDown && !player.dead) tryAttack();

    // Update entities
    ENTITIES.updatePlayer(player, dt, world);
    for (const e of enemies) ENTITIES.updateEnemy(e, dt, world, player, enemies, UI.log, civilians);
    for (const c of civilians) ENTITIES.updateCivilian(c, dt, world, player, enemies, UI.log);
    // Remove dead enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dying && e.dead) {
        ENTITIES.spawnDrops(e, world);
        enemies.splice(i, 1);
      }
    }

    // Camera follow
    RENDER.centerCameraOn(player.wx, player.wy);

    // Render
    RENDER.render(world, player, enemies, world.drops, time, civilians);

    // Time advance
    time.minutes += minPerSec * dt;
    updateLightingOverlay();

    // HUD
    UI.updateStats(player);
    UI.updateClock(time);
    UI.updateHotbar(player);
    UI.drawMinimap(world, player, enemies);

    // Player hurt flash
    if (now - player.lastHitT < 200 && player.iframe > 200) UI.hurtFlash();

    // Interaction prompt
    let prompt = null;
    // Civilian dialogue prompt
    for (const c of civilians) {
      if (c.dead || c.dying) continue;
      if (ISO.dist(c.wx, c.wy, player.wx, player.wy) < 1.5) {
        prompt = `Speak with <b>${c.name}</b> · <kbd>E</kbd>`;
        break;
      }
    }
    if (!prompt) {
      // Light switch prompt
      for (const p of world.props) {
        if (p.type === 'light_switch' && !p.dead) {
          if (ISO.dist(p.wx, p.wy, player.wx, player.wy) < 1.3) {
            prompt = `${p.structure.lit ? 'Snuff' : 'Light'} <b>lantern</b> · <kbd>E</kbd>`;
            break;
          }
        }
      }
    }
    if (!prompt) {
      const doorHit = ISO.nearestDoor(world, player.wx, player.wy, 1.4);
      if (doorHit && doorHit.distance < 1.3) {
        const open = doorHit.structure.door.open;
        prompt = `${open ? 'Close' : 'Open'} <b>door</b> · <kbd>E</kbd>`;
      }
    }
    if (!prompt) {
      for (const p of world.props) {
        if (p.dead && !p.container) continue;
        if (p.container && ISO.dist(p.wx, p.wy, player.wx, player.wy) < 1.4) {
          prompt = `Open <b>${({car:'car', barrel:'barrel', crate:'crate', chest:'chest'}[p.type])}</b> · <kbd>E</kbd>`;
          break;
        }
      }
    }
    if (!prompt) {
      for (const d of world.drops) {
        if (ISO.dist(d.wx, d.wy, player.wx, player.wy) < 1.0) {
          prompt = `Pick up <b>${itemDef(d.item).name}</b> · <kbd>E</kbd>`;
          break;
        }
      }
    }
    UI.setPrompt(prompt);

    // Foreboding
    if (now > foreboding) {
      UI.log(forebodingLines[Math.floor(Math.random() * forebodingLines.length)], 'dim');
      foreboding = now + 18000 + Math.random() * 12000;
    }

    // Death
    if (player.dead) {
      document.getElementById('death').classList.add('show');
    }

    requestAnimationFrame(step);
  }

  function root_creator_open() {
    return document.getElementById('creator').classList.contains('show');
  }

  // Start splash
  document.getElementById('splash-customize').addEventListener('click', () => {
    CREATOR.open('traits');
  });
  document.getElementById('splash-start').addEventListener('click', () => {
    document.getElementById('splash').classList.add('gone');
    // Re-apply traits + job in case user changed them after page load
    const tids = TRAITS.load() || [];
    TRAITS.applyTraits(player, tids);
    const jid = JOBS.load() || 'none';
    JOBS.applyJob(player, jid);
    UI.log(`A ${JOBS.DEFS[jid].name.toLowerCase()} steps into the world.`, 'dim');
    UI.log('The veil is thin tonight.', 'dim');
    UI.log('You stand at the crossroads.', 'dim');
    last = performance.now();
    requestAnimationFrame(step);
  });

  // Restart button on death
  document.getElementById('restart').addEventListener('click', () => location.reload());

  // Initial frame so canvas isn't blank behind splash
  RENDER.centerCameraOn(player.wx, player.wy);
  RENDER.render(world, player, enemies, world.drops, time);

})();

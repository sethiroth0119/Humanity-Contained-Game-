/* ============================================================
   Canvas renderer — draws tiles, structures, props, entities
   Painter's algorithm by Y-depth for overlapping sprites.
   ============================================================ */

const RENDER = (() => {

const { TILE_W, TILE_H, HALF_W, HALF_H, worldToScreen, TILES, T, WORLD_SIZE } = ISO;

let ctx, canvas;
let dpr = window.devicePixelRatio || 1;

function init(c) {
  canvas = c;
  ctx = c.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Camera follows player; cam.x/cam.y are world-pixel offsets
const cam = { x: 0, y: 0 };
function centerCameraOn(wx, wy) {
  const sw = canvas.width / dpr;
  const sh = canvas.height / dpr;
  const tx = (wx - wy) * HALF_W;
  const ty = (wx + wy) * HALF_H;
  cam.x = tx - sw / 2;
  cam.y = ty - sh / 2;
}

/* ----- Tile drawing ----- */
function drawTile(wx, wy, type) {
  const { x, y } = worldToScreen(wx, wy, cam);
  // Skip off-screen tiles
  if (x < -TILE_W || x > canvas.width/dpr + TILE_W) return;
  if (y < -TILE_H || y > canvas.height/dpr + TILE_H) return;

  const td = TILES[type];
  // Diamond: top, right, bottom, left
  ctx.beginPath();
  ctx.moveTo(x,           y - HALF_H);
  ctx.lineTo(x + HALF_W,  y);
  ctx.lineTo(x,           y + HALF_H);
  ctx.lineTo(x - HALF_W,  y);
  ctx.closePath();
  ctx.fillStyle = td.color;
  ctx.fill();
  ctx.strokeStyle = td.edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Special: water ripple
  if (type === T.WATER) {
    ctx.strokeStyle = 'oklch(0.45 0.05 220 / 0.4)';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 10, y);
    ctx.stroke();
  }
  // Road dashes on center lanes (only on perfect road tiles where wy%4==0)
  if (type === T.ROAD && (wy % 4 === 0)) {
    ctx.fillStyle = 'oklch(0.65 0.06 90 / 0.5)';
    ctx.fillRect(x - 6, y - 1.5, 12, 3);
  }
}

/* ----- World rendering ----- */
function drawTiles(world) {
  // We draw in iso back-to-front order: increasing wy + wx
  // For correctness, render row by row of wy+wx isolines.
  // Simpler: nested loop y then x.
  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      drawTile(x + 0.5, y + 0.5, world.tiles[y][x]);
    }
  }
}

/* ----- Structures: walls + roofs ----- */
function drawWall(s, wall) {
  // For a wall on tile (sx, sy) side (n/s/e/w), draw a vertical billboard
  const { x, y } = worldToScreen(wall.wx, wall.wy, cam);
  const H = 56;
  const colorFront = 'oklch(0.40 0.02 60)';
  const colorSide  = 'oklch(0.32 0.02 60)';
  const trim       = 'oklch(0.50 0.02 60)';

  // Determine wall footprint corners depending on side
  let p1, p2;
  if (wall.side === 'n') {
    p1 = worldToScreen(s.x,        s.y, cam);
    p2 = worldToScreen(s.x + s.w,  s.y, cam);
  } else if (wall.side === 's') {
    p1 = worldToScreen(s.x,        s.y + s.h, cam);
    p2 = worldToScreen(s.x + s.w,  s.y + s.h, cam);
  } else if (wall.side === 'w') {
    p1 = worldToScreen(s.x, s.y,         cam);
    p2 = worldToScreen(s.x, s.y + s.h,   cam);
  } else {
    p1 = worldToScreen(s.x + s.w, s.y,        cam);
    p2 = worldToScreen(s.x + s.w, s.y + s.h,  cam);
  }
  // Use only the segment for the single tile
  // Recompute per-tile segment more precisely:
  let ax, ay, bx, by;
  if (wall.side === 'n') {
    const tx = Math.floor(wall.wx);
    const p1t = worldToScreen(tx,     s.y, cam);
    const p2t = worldToScreen(tx + 1, s.y, cam);
    ax = p1t.x; ay = p1t.y; bx = p2t.x; by = p2t.y;
  } else if (wall.side === 's') {
    const tx = Math.floor(wall.wx);
    const p1t = worldToScreen(tx,     s.y + s.h, cam);
    const p2t = worldToScreen(tx + 1, s.y + s.h, cam);
    ax = p1t.x; ay = p1t.y; bx = p2t.x; by = p2t.y;
  } else if (wall.side === 'w') {
    const ty = Math.floor(wall.wy);
    const p1t = worldToScreen(s.x, ty,     cam);
    const p2t = worldToScreen(s.x, ty + 1, cam);
    ax = p1t.x; ay = p1t.y; bx = p2t.x; by = p2t.y;
  } else {
    const ty = Math.floor(wall.wy);
    const p1t = worldToScreen(s.x + s.w, ty,     cam);
    const p2t = worldToScreen(s.x + s.w, ty + 1, cam);
    ax = p1t.x; ay = p1t.y; bx = p2t.x; by = p2t.y;
  }

  // Wall = quad from baseline to baseline-H
  // If this is a door tile, draw a gap (open doorway) — if closed, draw a solid door.
  if (wall.door) {
    // Door posts
    ctx.fillStyle = 'oklch(0.25 0.02 60)';
    ctx.fillRect(ax - 1, ay - H, 2, H);
    ctx.fillRect(bx - 1, by - H, 2, H);
    if (!s.door.open) {
      // Draw closed door panel (slightly inset)
      const insetA = { x: ax + 3, y: ay };
      const insetB = { x: bx - 3, y: by };
      ctx.fillStyle = 'oklch(0.32 0.04 60)';
      ctx.beginPath();
      ctx.moveTo(insetA.x, insetA.y);
      ctx.lineTo(insetB.x, insetB.y);
      ctx.lineTo(insetB.x, insetB.y - H + 6);
      ctx.lineTo(insetA.x, insetA.y - H + 6);
      ctx.closePath();
      ctx.fill();
      // Door handle
      ctx.fillStyle = 'oklch(0.65 0.05 80)';
      const mx = (insetA.x + insetB.x) / 2;
      const my = (insetA.y + insetB.y) / 2 - H / 2;
      ctx.fillRect(mx - 1, my, 2, 4);
      // Lintel above
      ctx.strokeStyle = 'oklch(0.45 0.02 60)';
      ctx.beginPath();
      ctx.moveTo(ax, ay - H);
      ctx.lineTo(bx, by - H);
      ctx.stroke();
    } else {
      // Open — show top lintel only
      ctx.strokeStyle = 'oklch(0.45 0.02 60)';
      ctx.beginPath();
      ctx.moveTo(ax, ay - H);
      ctx.lineTo(bx, by - H);
      ctx.stroke();
    }
    return;
  }

  // Side shading: side walls slightly darker
  const isSide = (wall.side === 'w' || wall.side === 'e');
  ctx.fillStyle = isSide ? colorSide : colorFront;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx, by - H);
  ctx.lineTo(ax, ay - H);
  ctx.closePath();
  ctx.fill();

  // Top trim
  ctx.strokeStyle = trim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax, ay - H);
  ctx.lineTo(bx, by - H);
  ctx.stroke();

  // Bottom edge
  ctx.strokeStyle = 'oklch(0.15 0.01 60)';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Window? Add a small dim rectangle on long walls
  if ((wall.side === 'n' || wall.side === 's') && Math.floor(wall.wx) % 3 === 1) {
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    if (s.lit) {
      // Warm window glow
      ctx.fillStyle = 'oklch(0.80 0.14 75 / 0.85)';
      ctx.fillRect(cx - 8, cy - H + 12, 16, 14);
      ctx.fillStyle = 'oklch(0.95 0.10 80 / 0.4)';
      ctx.fillRect(cx - 7, cy - H + 13, 14, 4);
    } else {
      ctx.fillStyle = 'oklch(0.18 0.02 250 / 0.6)';
      ctx.fillRect(cx - 8, cy - H + 12, 16, 14);
    }
    ctx.strokeStyle = 'oklch(0.20 0.01 60)';
    ctx.strokeRect(cx - 8, cy - H + 12, 16, 14);
  }
}

function drawStructure(s) {
  // Walls are sorted with player by depth; we draw walls here in correct order:
  // North + West walls (back), then south + east (front). For player occlusion,
  // we draw south walls AFTER player at player's row. Simpler: walls always drawn,
  // then we apply a slight transparency to south/east walls when player is inside.
  const sortedWalls = [...s.walls].sort((a, b) => (a.wy + a.wx) - (b.wy + b.wx));
  for (const w of sortedWalls) drawWall(s, w);

  // Chapel cross on the south side (decorative)
  if (s.type === 'chapel') {
    const top = worldToScreen(s.x + s.w/2, s.y, cam);
    ctx.fillStyle = 'oklch(0.55 0.02 60)';
    ctx.fillRect(top.x - 1.5, top.y - 72, 3, 18);
    ctx.fillRect(top.x - 7,   top.y - 64, 14, 3);
  }
}

/* ----- Props (trees, fences, etc.) ----- */
function drawProp(p) {
  const { x, y } = worldToScreen(p.wx, p.wy, cam);
  ctx.save();
  if (p.dead) ctx.globalAlpha = 0.5;
  switch (p.type) {
    case 'tree':       drawTree(x, y, p); break;
    case 'deadtree':   drawDeadTree(x, y); break;
    case 'gravestone': drawGravestone(x, y); break;
    case 'car':        drawCar(x, y, p); break;
    case 'barrel':     drawBarrel(x, y, p); break;
    case 'crate':      drawCrate(x, y, p); break;
    case 'chest':      drawChest(x, y, p); break;
    case 'fence':      drawFence(x, y); break;
    case 'light_switch': drawLightSwitch(x, y, p); break;
  }
  ctx.restore();
}

function drawLightSwitch(x, y, p) {
  // Small lantern/post on the ground
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y, 5, 2, 0, 0, Math.PI*2); ctx.fill();
  // Post
  ctx.fillStyle = 'oklch(0.25 0.02 60)';
  ctx.fillRect(x - 1, y - 18, 2, 18);
  // Lantern body
  const lit = p.structure.lit;
  ctx.fillStyle = lit ? 'oklch(0.85 0.14 80)' : 'oklch(0.25 0.02 60)';
  ctx.fillRect(x - 4, y - 24, 8, 8);
  ctx.strokeStyle = 'oklch(0.40 0.02 60)';
  ctx.strokeRect(x - 4, y - 24, 8, 8);
  // Glow
  if (lit) {
    ctx.fillStyle = 'oklch(0.85 0.18 80 / 0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 20, 16, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawTree(x, y, p) {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  // trunk
  ctx.fillStyle = 'oklch(0.28 0.04 60)';
  ctx.fillRect(x - 3, y - 28, 6, 28);
  // crown
  const crownColors = [
    'oklch(0.32 0.07 140)',
    'oklch(0.28 0.06 130)',
    'oklch(0.30 0.05 150)'
  ];
  ctx.fillStyle = crownColors[p.variant || 0];
  ctx.beginPath(); ctx.ellipse(x, y - 38, 22, 26, 0, 0, Math.PI * 2); ctx.fill();
  // hint of highlight
  ctx.fillStyle = 'oklch(0.42 0.07 140 / 0.6)';
  ctx.beginPath(); ctx.ellipse(x - 8, y - 44, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
}

function drawDeadTree(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'oklch(0.30 0.02 60)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 2, y - 40);
  // branches
  ctx.moveTo(x - 1, y - 22); ctx.lineTo(x - 12, y - 30);
  ctx.moveTo(x - 1, y - 30); ctx.lineTo(x + 10, y - 38);
  ctx.moveTo(x - 2, y - 38); ctx.lineTo(x - 9, y - 48);
  ctx.stroke();
}

function drawGravestone(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(x, y, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'oklch(0.55 0.01 250)';
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x - 7, y - 16);
  ctx.quadraticCurveTo(x, y - 22, x + 7, y - 16);
  ctx.lineTo(x + 7, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'oklch(0.30 0.01 250)';
  ctx.stroke();
  // cross etch
  ctx.fillStyle = 'oklch(0.35 0.01 250)';
  ctx.fillRect(x - 0.5, y - 14, 1, 7);
  ctx.fillRect(x - 2.5, y - 12, 5, 1);
}

function drawCar(x, y, p) {
  // p.rot: 0/1 = north-south, 2 = east-west
  const horiz = p.rot === 2;
  const w = horiz ? 46 : 22;
  const h = horiz ? 22 : 46;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(x, y + 4, w/2 + 4, 8, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = p.color || 'oklch(0.30 0.05 25)';
  ctx.fillRect(x - w/2, y - h - 4, w, h);
  ctx.strokeStyle = 'oklch(0.12 0.02 25)';
  ctx.strokeRect(x - w/2, y - h - 4, w, h);
  // roof
  ctx.fillStyle = 'oklch(0.18 0.02 25)';
  if (horiz) ctx.fillRect(x - 14, y - h - 2, 28, 12);
  else       ctx.fillRect(x - 8, y - h + 4, 16, 24);
  // windshield glint
  ctx.fillStyle = 'oklch(0.5 0.05 220 / 0.4)';
  if (horiz) ctx.fillRect(x + 8, y - h, 8, 12);
  else       ctx.fillRect(x - 7, y - h + 6, 14, 6);
  // damage cue if opened
  if (p.opened) {
    ctx.strokeStyle = 'oklch(0.55 0.18 25 / 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - w/2 + 2, y - h - 2); ctx.lineTo(x + w/2 - 4, y - 6);
    ctx.stroke();
  }
}

function drawBarrel(x, y, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'oklch(0.32 0.04 60)';
  ctx.fillRect(x - 10, y - 26, 20, 26);
  ctx.fillStyle = 'oklch(0.40 0.04 60)';
  ctx.fillRect(x - 10, y - 26, 20, 3);
  ctx.fillRect(x - 10, y - 16, 20, 2);
  ctx.fillRect(x - 10, y - 6, 20, 2);
  if (p.opened) {
    ctx.fillStyle = 'oklch(0.10 0.02 60)';
    ctx.fillRect(x - 8, y - 24, 16, 4);
  }
}

function drawCrate(x, y, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'oklch(0.40 0.05 60)';
  ctx.fillRect(x - 12, y - 22, 24, 22);
  ctx.strokeStyle = 'oklch(0.28 0.04 60)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 12, y - 22, 24, 22);
  // X bracing
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 22); ctx.lineTo(x + 12, y);
  ctx.moveTo(x + 12, y - 22); ctx.lineTo(x - 12, y);
  ctx.stroke();
  if (p.opened) {
    ctx.fillStyle = 'oklch(0.10 0.02 60)';
    ctx.fillRect(x - 10, y - 20, 20, 6);
  }
}

function drawChest(x, y, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(x, y, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'oklch(0.32 0.06 60)';
  ctx.fillRect(x - 14, y - 18, 28, 18);
  // lid
  ctx.fillStyle = 'oklch(0.40 0.06 60)';
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 18);
  ctx.quadraticCurveTo(x, y - 30, x + 14, y - 18);
  ctx.lineTo(x + 14, y - 18);
  ctx.fill();
  // bands
  ctx.fillStyle = 'oklch(0.55 0.10 85)';
  ctx.fillRect(x - 14, y - 12, 28, 2);
  ctx.fillRect(x - 14, y - 4,  28, 2);
  // lock glow
  ctx.fillStyle = p.opened ? 'oklch(0.30 0.02 60)' : 'oklch(0.75 0.12 85)';
  ctx.fillRect(x - 2, y - 10, 4, 5);
}

function drawFence(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(x, y, 18, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'oklch(0.30 0.03 60)';
  // horizontal rails
  ctx.fillRect(x - 18, y - 14, 36, 2);
  ctx.fillRect(x - 18, y - 5, 36, 2);
  // posts
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(x + i * 9 - 1, y - 18, 2, 18);
  }
}

/* ----- Entities (player + enemies) ----- */
function drawShadow(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
}

function drawPlayer(player) {
  const { x, y } = worldToScreen(player.wx, player.wy, cam);
  drawShadow(x, y);

  // Characters are 3D models in Godot; here we draw a silhouette placeholder.
  // Body silhouette: head + torso (vaguely humanoid)
  // Slight lean depending on facing
  ctx.save();
  ctx.translate(x, y);
  // Cloak / outline shadow
  ctx.fillStyle = 'oklch(0.13 0.02 250)';
  // legs/lower
  ctx.beginPath();
  ctx.ellipse(0, -4, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // torso
  ctx.fillStyle = 'oklch(0.30 0.03 250)';
  ctx.beginPath();
  ctx.moveTo(-7, -8);
  ctx.quadraticCurveTo(-9, -22, -3, -28);
  ctx.lineTo(3, -28);
  ctx.quadraticCurveTo(9, -22, 7, -8);
  ctx.closePath();
  ctx.fill();

  // head
  ctx.fillStyle = 'oklch(0.55 0.03 60)';
  ctx.beginPath();
  ctx.ellipse(0, -32, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // weapon: small protruding shape in facing direction
  if (player.weapon) {
    const ang = player.facing;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang) * 0.5; // iso squash
    drawWeaponSilhouette(dx, dy, player.weapon);
  }
  ctx.restore();

  // Attack arc swing
  if (player.swing && player.swing.t < player.swing.dur) {
    drawSwingArc(x, y, player.swing);
  }

  // Bullet trail / spell line during ranged attacks
  if (player.shot && performance.now() - player.shot.time < 90) {
    const a = worldToScreen(player.shot.from.wx, player.shot.from.wy - 0.3, cam);
    const b = worldToScreen(player.shot.to.wx, player.shot.to.wy - 0.3, cam);
    ctx.strokeStyle = player.shot.kind === 'staff'
      ? 'oklch(0.75 0.18 280 / 0.8)'
      : 'oklch(0.85 0.02 90 / 0.7)';
    ctx.lineWidth = player.shot.kind === 'staff' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (player.shot.kind === 'staff') {
      ctx.fillStyle = 'oklch(0.85 0.18 280 / 0.7)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI*2); ctx.fill();
    }
  }
}

function drawWeaponSilhouette(dx, dy, weapon) {
  ctx.save();
  const a = Math.atan2(dy, dx);
  ctx.rotate(a);
  ctx.translate(8, -16);
  ctx.fillStyle = 'oklch(0.65 0.01 90)';
  switch (weapon.shape) {
    case 'sword':
      ctx.fillRect(0, -1, 16, 2);
      ctx.fillStyle = 'oklch(0.40 0.04 60)';
      ctx.fillRect(-3, -2, 3, 4);
      break;
    case 'spear':
      ctx.fillStyle = 'oklch(0.40 0.04 60)';
      ctx.fillRect(-6, -0.5, 22, 1);
      ctx.fillStyle = 'oklch(0.7 0.01 90)';
      ctx.beginPath();
      ctx.moveTo(16, -2); ctx.lineTo(22, 0); ctx.lineTo(16, 2);
      ctx.closePath(); ctx.fill();
      break;
    case 'axe':
      ctx.fillStyle = 'oklch(0.35 0.04 60)';
      ctx.fillRect(0, -1, 14, 2);
      ctx.fillStyle = 'oklch(0.70 0.01 90)';
      ctx.beginPath();
      ctx.moveTo(12, -5); ctx.lineTo(20, -1); ctx.lineTo(20, 1); ctx.lineTo(12, 5);
      ctx.closePath(); ctx.fill();
      break;
    case 'dagger':
      ctx.fillStyle = 'oklch(0.70 0.01 90)';
      ctx.fillRect(0, -1, 8, 2);
      break;
    case 'bow':
      ctx.strokeStyle = 'oklch(0.45 0.04 60)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(8, 0, 9, -Math.PI/2, Math.PI/2);
      ctx.stroke();
      break;
    case 'staff':
      ctx.fillStyle = 'oklch(0.35 0.04 60)';
      ctx.fillRect(0, -0.5, 18, 1);
      ctx.fillStyle = 'oklch(0.70 0.16 280)';
      ctx.beginPath(); ctx.arc(18, 0, 3, 0, Math.PI*2); ctx.fill();
      break;
    case 'gun':
      ctx.fillStyle = 'oklch(0.20 0.01 250)';
      ctx.fillRect(0, -2, 12, 4);
      ctx.fillRect(2, 0, 4, 4);
      break;
    case 'shotgun':
      ctx.fillStyle = 'oklch(0.20 0.01 250)';
      ctx.fillRect(0, -2.5, 18, 5);
      break;
  }
  ctx.restore();
}

function drawSwingArc(x, y, swing) {
  const t = swing.t / swing.dur; // 0..1
  const ang = swing.startAng + (swing.endAng - swing.startAng) * t;
  const halfArc = swing.arc / 2;
  // squashed iso ellipse arc
  ctx.save();
  ctx.translate(x, y - 14);
  ctx.scale(1, 0.5);
  ctx.strokeStyle = `oklch(0.85 0.01 90 / ${0.7 * (1 - t)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, swing.range * TILE_W * 0.5, ang - halfArc, ang + halfArc);
  ctx.stroke();
  // trailing fill
  ctx.fillStyle = `oklch(0.7 0.01 90 / ${0.18 * (1 - t)})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, swing.range * TILE_W * 0.5, ang - halfArc, ang + halfArc);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(e) {
  const { x, y } = worldToScreen(e.wx, e.wy, cam);
  drawShadow(x, y);
  ctx.save();
  ctx.translate(x, y);

  if (e.dying) ctx.globalAlpha = Math.max(0, 1 - e.dying / 600);

  if (e.kind === 'skeleton') {
    // legs
    ctx.fillStyle = 'oklch(0.82 0.02 90)';
    ctx.fillRect(-4, -10, 2, 10);
    ctx.fillRect(2, -10, 2, 10);
    // torso (ribcage)
    ctx.fillStyle = 'oklch(0.78 0.02 90)';
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(-5, -22);
    ctx.lineTo(5, -22);
    ctx.lineTo(6, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'oklch(0.45 0.02 90)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-5, -13 - i*3);
      ctx.lineTo(5, -13 - i*3);
      ctx.stroke();
    }
    // head/skull
    ctx.fillStyle = 'oklch(0.88 0.02 90)';
    ctx.beginPath(); ctx.ellipse(0, -28, 5, 6, 0, 0, Math.PI*2); ctx.fill();
    // eye sockets
    ctx.fillStyle = '#000';
    ctx.fillRect(-3, -29, 2, 2);
    ctx.fillRect(1, -29, 2, 2);
  } else if (e.kind === 'wraith') {
    // floating cloak
    ctx.fillStyle = 'oklch(0.18 0.04 250 / 0.85)';
    ctx.beginPath();
    ctx.moveTo(-9, -2);
    ctx.quadraticCurveTo(-14, -22, -4, -30);
    ctx.lineTo(4, -30);
    ctx.quadraticCurveTo(14, -22, 9, -2);
    ctx.quadraticCurveTo(0, 4, -9, -2);
    ctx.closePath();
    ctx.fill();
    // glowing eyes
    ctx.fillStyle = 'oklch(0.70 0.18 280)';
    ctx.beginPath(); ctx.arc(-3, -22, 1.6, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -22, 1.6, 0, Math.PI*2); ctx.fill();
    // wisp under
    ctx.fillStyle = 'oklch(0.45 0.08 280 / 0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI*2); ctx.fill();
  } else if (e.kind === 'ghoul') {
    // hulking ghoul
    ctx.fillStyle = 'oklch(0.35 0.03 130)';
    ctx.beginPath(); ctx.ellipse(0, -8, 11, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'oklch(0.30 0.03 130)';
    ctx.beginPath(); ctx.ellipse(-10, -10, 4, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -10, 4, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'oklch(0.42 0.04 130)';
    ctx.beginPath(); ctx.ellipse(0, -22, 6, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0a0';
    ctx.fillRect(-3, -23, 2, 1.5);
    ctx.fillRect(1, -23, 2, 1.5);
  } else if (e.kind === 'cultist') {
    // hooded figure, violet glow inside hood
    // robe
    ctx.fillStyle = 'oklch(0.18 0.04 280)';
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-7, -22);
    ctx.quadraticCurveTo(0, -32, 7, -22);
    ctx.lineTo(8, -2);
    ctx.quadraticCurveTo(0, 4, -8, -2);
    ctx.closePath();
    ctx.fill();
    // hood shadow / face
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, -22, 4, 5, 0, 0, Math.PI*2); ctx.fill();
    // violet eyes
    ctx.fillStyle = 'oklch(0.75 0.18 280)';
    ctx.beginPath(); ctx.arc(-1.5, -22, 0.9, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(1.5, -22, 0.9, 0, Math.PI*2); ctx.fill();
    // charging glow if cd low
    if (e.magicCd > 0 && e.magicCd < 400) {
      ctx.fillStyle = `oklch(0.7 0.18 280 / ${0.4 + Math.sin(performance.now()/60)*0.2})`;
      ctx.beginPath(); ctx.arc(0, -14, 5, 0, Math.PI*2); ctx.fill();
    }
  } else if (e.kind === 'bandit') {
    // legs
    ctx.fillStyle = 'oklch(0.25 0.02 60)';
    ctx.fillRect(-4, -10, 3, 10);
    ctx.fillRect(1, -10, 3, 10);
    // torso (dark jacket)
    ctx.fillStyle = 'oklch(0.30 0.04 25)';
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(-7, -24);
    ctx.lineTo(7, -24);
    ctx.lineTo(7, -10);
    ctx.closePath();
    ctx.fill();
    // head (skin)
    ctx.fillStyle = 'oklch(0.55 0.03 60)';
    ctx.beginPath(); ctx.ellipse(0, -28, 4.5, 5.5, 0, 0, Math.PI*2); ctx.fill();
    // bandana
    ctx.fillStyle = 'oklch(0.40 0.10 25)';
    ctx.fillRect(-4.5, -27, 9, 3);
    // gun / knife
    if (e.ammo > 0) {
      ctx.fillStyle = 'oklch(0.18 0.01 250)';
      ctx.fillRect(6, -18, 8, 3);
    } else {
      ctx.fillStyle = 'oklch(0.65 0.01 90)';
      ctx.fillRect(6, -17, 5, 1.5);
    }
    if (e.fleeing) {
      ctx.fillStyle = 'oklch(0.85 0.15 60)';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText('!?', 0, -38);
    }
  } else if (e.kind === 'guard') {
    // legs
    ctx.fillStyle = 'oklch(0.20 0.01 250)';
    ctx.fillRect(-5, -10, 4, 10);
    ctx.fillRect(1, -10, 4, 10);
    // torso (chainmail dim)
    ctx.fillStyle = 'oklch(0.32 0.01 250)';
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.lineTo(-9, -25);
    ctx.lineTo(9, -25);
    ctx.lineTo(9, -10);
    ctx.closePath();
    ctx.fill();
    // chain shoulders
    ctx.fillStyle = 'oklch(0.45 0.005 250)';
    ctx.fillRect(-9, -25, 18, 4);
    // helmet
    ctx.fillStyle = 'oklch(0.40 0.005 250)';
    ctx.beginPath(); ctx.ellipse(0, -29, 5.5, 7, 0, 0, Math.PI*2); ctx.fill();
    // visor slit (cursed eyes)
    ctx.fillStyle = 'oklch(0.65 0.15 25)';
    ctx.fillRect(-3, -29, 6, 1);
    // shotgun
    if (e.ammo > 0) {
      ctx.fillStyle = 'oklch(0.15 0.01 60)';
      ctx.fillRect(6, -19, 12, 4);
    } else {
      // long blade
      ctx.fillStyle = 'oklch(0.70 0.005 250)';
      ctx.fillRect(6, -18, 14, 2);
    }
  }
  ctx.restore();

  // Enemy ranged shot — quick fading line
  if (e.shot && performance.now() - e.shot.time < 110) {
    const a = worldToScreen(e.shot.from.wx, e.shot.from.wy, cam);
    const b = worldToScreen(e.shot.to.wx, e.shot.to.wy, cam);
    if (e.shot.kind === 'magic') {
      ctx.strokeStyle = 'oklch(0.75 0.20 280 / 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // arc glow at endpoint
      ctx.fillStyle = 'oklch(0.85 0.18 280 / 0.7)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle = 'oklch(0.85 0.05 60 / 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // muzzle flash
      ctx.fillStyle = 'oklch(0.95 0.15 80 / 0.6)';
      ctx.beginPath(); ctx.arc(a.x, a.y - 12, 4, 0, Math.PI*2); ctx.fill();
    }
  }

  // HP bar above enemy when damaged
  if (e.hp < e.maxHp && !e.dying) {
    const bx = x - 14, by = y - 44;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, 28, 3);
    ctx.fillStyle = 'oklch(0.55 0.18 25)';
    ctx.fillRect(bx, by, 28 * (e.hp / e.maxHp), 3);
  }

  // Aggro / alert indicator
  if (e.alert && !e.dying) {
    ctx.fillStyle = 'oklch(0.65 0.18 25)';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 50);
  }
}

/* ----- Dark building visibility cone -----
   Draw an opaque dark overlay covering the whole viewport, then punch
   a wedge of visibility forward of the player's facing direction.
   The wedge is in SCREEN space — we convert the world facing angle. */
function drawDarknessOverlay(player, structure) {
  const { x: px, y: py } = worldToScreen(player.wx, player.wy, cam);
  const screenW = canvas.width / dpr;
  const screenH = canvas.height / dpr;

  // Convert world-space facing → screen-space angle
  const wdx = Math.cos(player.facing);
  const wdy = Math.sin(player.facing);
  const sdx = wdx - wdy;
  const sdy = (wdx + wdy) * 0.5;
  const screenFacing = Math.atan2(sdy, sdx);

  const R = 280;                // cone radius (px)
  const ARC = Math.PI / 2.2;    // ~82° cone
  const OY = 18;                // origin: player torso
  // Offset the lantern origin slightly forward so light extends past the player
  const lanternX = px + Math.cos(screenFacing) * 12;
  const lanternY = (py - OY) + Math.sin(screenFacing) * 12;

  ctx.save();

  // 1. Dark overlay EVERYWHERE EXCEPT inside the cone wedge.
  //    Use even-odd fill so the cone is subtracted from the rect.
  const darkPath = new Path2D();
  darkPath.rect(0, 0, screenW, screenH);
  darkPath.moveTo(px, py - OY);
  darkPath.arc(px, py - OY, R, screenFacing - ARC/2, screenFacing + ARC/2);
  darkPath.closePath();
  ctx.fillStyle = 'oklch(0.04 0.01 250 / 0.97)';
  ctx.fill(darkPath, 'evenodd');

  // 2. Warm lantern glow INSIDE the cone — additive light so the world shows brighter.
  ctx.beginPath();
  ctx.moveTo(px, py - OY);
  ctx.arc(px, py - OY, R, screenFacing - ARC/2, screenFacing + ARC/2);
  ctx.closePath();
  ctx.clip();

  ctx.globalCompositeOperation = 'lighter';
  const lantern = ctx.createRadialGradient(lanternX, lanternY, 10, lanternX, lanternY, R * 0.85);
  lantern.addColorStop(0,   'oklch(0.85 0.15 75 / 0.55)');
  lantern.addColorStop(0.4, 'oklch(0.70 0.12 75 / 0.30)');
  lantern.addColorStop(1,   'oklch(0.20 0.05 75 / 0)');
  ctx.fillStyle = lantern;
  ctx.fillRect(0, 0, screenW, screenH);

  // 3. Slight feather along the cone edges so the cutoff isn't a hard line
  ctx.globalCompositeOperation = 'destination-out';
  const edgeFade = ctx.createRadialGradient(px, py - OY, R - 30, px, py - OY, R + 4);
  edgeFade.addColorStop(0, 'rgba(0,0,0,0)');
  edgeFade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = edgeFade;
  ctx.fillRect(0, 0, screenW, screenH);

  ctx.restore();
}

/* ----- Interior walls (lower, with interior door support) ----- */
function drawInteriorWall(s, wall) {
  const tx = Math.floor(wall.wx);
  const p1t = worldToScreen(tx,     wall.wy, cam);
  const p2t = worldToScreen(tx + 1, wall.wy, cam);
  const H = 44;     // a bit shorter than exterior wall
  const ax = p1t.x, ay = p1t.y;
  const bx = p2t.x, by = p2t.y;
  const intD = s.interiorDoor;
  const isDoorCell = wall.door;

  if (isDoorCell) {
    ctx.fillStyle = 'oklch(0.28 0.02 60)';
    ctx.fillRect(ax - 1, ay - H, 2, H);
    ctx.fillRect(bx - 1, by - H, 2, H);
    if (intD && !intD.open) {
      // Closed interior door panel
      ctx.fillStyle = 'oklch(0.35 0.04 60)';
      ctx.beginPath();
      ctx.moveTo(ax + 2, ay);
      ctx.lineTo(bx - 2, by);
      ctx.lineTo(bx - 2, by - H + 4);
      ctx.lineTo(ax + 2, ay - H + 4);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = 'oklch(0.34 0.02 60)';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx, by - H);
  ctx.lineTo(ax, ay - H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'oklch(0.45 0.02 60)';
  ctx.beginPath();
  ctx.moveTo(ax, ay - H);
  ctx.lineTo(bx, by - H);
  ctx.stroke();
}

/* ----- Civilian silhouette ----- */
function drawCivilian(c) {
  const { x, y } = worldToScreen(c.wx, c.wy, cam);
  drawShadow(x, y);
  ctx.save();
  ctx.translate(x, y);
  if (c.dying) ctx.globalAlpha = Math.max(0, 1 - c.dying / 800);

  // Variant tints based on appearance index
  const TONES = [
    { shirt: 'oklch(0.45 0.05 60)',  pants: 'oklch(0.28 0.02 250)', skin: 'oklch(0.58 0.04 60)' },
    { shirt: 'oklch(0.40 0.06 220)', pants: 'oklch(0.30 0.02 60)',  skin: 'oklch(0.62 0.04 60)' },
    { shirt: 'oklch(0.42 0.05 130)', pants: 'oklch(0.32 0.02 250)', skin: 'oklch(0.55 0.04 60)' }
  ];
  const t = TONES[c.appearance % 3];
  // legs
  ctx.fillStyle = t.pants;
  ctx.fillRect(-4, -10, 3, 10);
  ctx.fillRect(1, -10, 3, 10);
  // torso
  ctx.fillStyle = t.shirt;
  ctx.beginPath();
  ctx.moveTo(-7, -10);
  ctx.quadraticCurveTo(-8, -22, -3, -26);
  ctx.lineTo(3, -26);
  ctx.quadraticCurveTo(8, -22, 7, -10);
  ctx.closePath();
  ctx.fill();
  // head
  ctx.fillStyle = t.skin;
  ctx.beginPath(); ctx.ellipse(0, -29, 4.5, 5.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // HP bar when wounded
  if (c.hp < c.maxHp && !c.dying) {
    const bx = x - 14, by = y - 42;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, 28, 3);
    ctx.fillStyle = 'oklch(0.55 0.10 130)';
    ctx.fillRect(bx, by, 28 * (c.hp / c.maxHp), 3);
  }

  // Indicator: fleeing
  if (c.fleeing && !c.dying) {
    ctx.fillStyle = 'oklch(0.85 0.15 60)';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 48);
  }

  // Name tag — small, only when close to player (handled by drawNamePlate)
  // (We could draw it here, but we don't have player ref. Skipping for now.)
}

/* ----- Item drops on the ground ----- */
function drawDrop(d) {
  const { x, y } = worldToScreen(d.wx, d.wy, cam);
  const bob = Math.sin(performance.now() / 400 + d.wx) * 1.5;
  ctx.fillStyle = 'oklch(0.85 0.10 85 / 0.5)';
  ctx.beginPath(); ctx.ellipse(x, y, 7, 2.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'oklch(0.75 0.10 85)';
  ctx.fillRect(x - 4, y - 7 + bob, 8, 8);
  ctx.strokeStyle = 'oklch(0.40 0.06 85)';
  ctx.strokeRect(x - 4, y - 7 + bob, 8, 8);
}

/* ============================================================
   Main render entry point
   ============================================================ */
function render(world, player, enemies, drops, time, civilians) {
  civilians = civilians || [];
  // Clear
  ctx.fillStyle = 'oklch(0.06 0.005 250)';
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  // Tiles
  drawTiles(world);

  // Build a depth-sorted list of "tall" things to draw
  const items = [];
  // Walls per structure: each wall has its (wx, wy) depth = wx + wy
  for (const s of world.structures) {
    for (const w of s.walls) {
      items.push({ depth: w.wx + w.wy, kind: 'wall', data: { s, wall: w } });
    }
    // Interior walls
    if (s.interiorWalls) {
      for (const w of s.interiorWalls) {
        items.push({ depth: w.wx + w.wy + 0.001, kind: 'interior_wall', data: { s, wall: w } });
      }
    }
  }
  for (const p of world.props) {
    items.push({ depth: p.wx + p.wy, kind: 'prop', data: p });
  }
  for (const e of enemies) {
    items.push({ depth: e.wx + e.wy + 0.01, kind: 'enemy', data: e });
  }
  for (const c of civilians) {
    items.push({ depth: c.wx + c.wy + 0.01, kind: 'civilian', data: c });
  }
  for (const d of drops) {
    items.push({ depth: d.wx + d.wy - 0.05, kind: 'drop', data: d });
  }
  items.push({ depth: player.wx + player.wy + 0.02, kind: 'player', data: player });

  items.sort((a, b) => a.depth - b.depth);

  for (const it of items) {
    if (it.kind === 'wall') drawWall(it.data.s, it.data.wall);
    else if (it.kind === 'interior_wall') drawInteriorWall(it.data.s, it.data.wall);
    else if (it.kind === 'prop') drawProp(it.data);
    else if (it.kind === 'enemy') drawEnemy(it.data);
    else if (it.kind === 'civilian') drawCivilian(it.data);
    else if (it.kind === 'drop') drawDrop(it.data);
    else if (it.kind === 'player') drawPlayer(it.data);
  }

  // ----- Dark building visibility cone -----
  const insideStruct = ISO.structureAt(world, player.wx, player.wy);
  if (insideStruct && !insideStruct.lit) {
    drawDarknessOverlay(player, insideStruct);
  }

  // Mouse direction indicator at player
  if (player.targetAng !== undefined) {
    const { x: px, y: py } = worldToScreen(player.wx, player.wy, cam);
    const r = 36;
    const ang = player.targetAng;
    ctx.save();
    ctx.translate(px, py - 14);
    ctx.scale(1, 0.5);
    ctx.strokeStyle = 'oklch(0.85 0.01 90 / 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'oklch(0.85 0.01 90 / 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    ctx.stroke();
    ctx.restore();
  }
}

return { init, render, cam, centerCameraOn, resize };
})();

window.RENDER = RENDER;

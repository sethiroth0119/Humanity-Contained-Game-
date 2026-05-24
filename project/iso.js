/* ============================================================
   Isometric math + world generation
   World coordinates: (wx, wy) — float tile positions
   Screen coordinates: (sx, sy) — pixels relative to camera
   Tile size: 64 wide × 32 tall (2:1 diamond)
   ============================================================ */

const TILE_W = 64;
const TILE_H = 32;
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

// World → screen (relative to camera-center origin)
function worldToScreen(wx, wy, cam) {
  return {
    x: (wx - wy) * HALF_W - cam.x,
    y: (wx + wy) * HALF_H - cam.y
  };
}

// Screen → world (inverse of above; cam is camera offset)
function screenToWorld(sx, sy, cam) {
  const x = sx + cam.x;
  const y = sy + cam.y;
  return {
    wx: (x / HALF_W + y / HALF_H) / 2,
    wy: (y / HALF_H - x / HALF_W) / 2
  };
}

// Distance helpers
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx*dx + dy*dy);
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

/* ============================================================
   World data
   ============================================================ */

const WORLD_SIZE = 60;

// Tile types
const T = {
  GRASS: 0,
  GRASS_DARK: 1,
  DIRT: 2,
  ROAD: 3,
  ROAD_EDGE: 4,
  SIDEWALK: 5,
  FLOOR_WOOD: 6,
  FLOOR_TILE: 7,
  WATER: 8,
  GRAVE: 9,
  MOSS: 10
};

// Each tile: { type, walkable, blocksLOS }
const TILES = {
  [T.GRASS]:      { color: 'oklch(0.42 0.04 130)', edge: 'oklch(0.35 0.04 130)', walkable: true },
  [T.GRASS_DARK]: { color: 'oklch(0.34 0.05 135)', edge: 'oklch(0.28 0.05 135)', walkable: true },
  [T.MOSS]:       { color: 'oklch(0.48 0.06 130)', edge: 'oklch(0.38 0.06 130)', walkable: true },
  [T.DIRT]:       { color: 'oklch(0.34 0.03 70)',  edge: 'oklch(0.27 0.03 70)',  walkable: true },
  [T.ROAD]:       { color: 'oklch(0.22 0.005 250)', edge: 'oklch(0.18 0.005 250)', walkable: true },
  [T.ROAD_EDGE]:  { color: 'oklch(0.28 0.005 250)', edge: 'oklch(0.22 0.005 250)', walkable: true },
  [T.SIDEWALK]:   { color: 'oklch(0.50 0.005 250)', edge: 'oklch(0.42 0.005 250)', walkable: true },
  [T.FLOOR_WOOD]: { color: 'oklch(0.35 0.04 60)',  edge: 'oklch(0.28 0.04 60)',  walkable: true },
  [T.FLOOR_TILE]: { color: 'oklch(0.55 0.01 250)', edge: 'oklch(0.45 0.01 250)', walkable: true },
  [T.WATER]:      { color: 'oklch(0.28 0.05 220)', edge: 'oklch(0.22 0.05 220)', walkable: false },
  [T.GRAVE]:      { color: 'oklch(0.30 0.02 70)',  edge: 'oklch(0.24 0.02 70)',  walkable: true }
};

// Seeded RNG so the world is consistent
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(7);
const rand = () => rng();
const randi = (n) => Math.floor(rand() * n);
const choice = (arr) => arr[randi(arr.length)];

/* ============================================================
   Generate the world
   ============================================================ */

function genWorld() {
  // 2D array of tile types
  const tiles = [];
  for (let y = 0; y < WORLD_SIZE; y++) {
    const row = [];
    for (let x = 0; x < WORLD_SIZE; x++) {
      // Sprinkle of dark grass for texture
      const r = rand();
      if (r < 0.08) row.push(T.GRASS_DARK);
      else if (r < 0.12) row.push(T.MOSS);
      else row.push(T.GRASS);
    }
    tiles.push(row);
  }

  // ---- Roads (cross-shape, asphalt) ----
  const roadX = 28; // vertical road column
  const roadY = 32; // horizontal road row
  for (let y = 0; y < WORLD_SIZE; y++) {
    tiles[y][roadX]   = T.ROAD;
    tiles[y][roadX+1] = T.ROAD;
    tiles[y][roadX-1] = T.ROAD_EDGE;
    tiles[y][roadX+2] = T.ROAD_EDGE;
  }
  for (let x = 0; x < WORLD_SIZE; x++) {
    tiles[roadY][x]   = T.ROAD;
    tiles[roadY+1][x] = T.ROAD;
    tiles[roadY-1][x] = T.ROAD_EDGE;
    tiles[roadY+2][x] = T.ROAD_EDGE;
  }
  // re-mark intersection
  for (let yy = roadY-1; yy <= roadY+2; yy++)
    for (let xx = roadX-1; xx <= roadX+2; xx++)
      tiles[yy][xx] = T.ROAD;

  // ---- Cemetery patch (NW) ----
  for (let y = 6; y < 16; y++) {
    for (let x = 6; x < 18; x++) {
      tiles[y][x] = (rand() < 0.4) ? T.GRAVE : T.DIRT;
    }
  }

  // ---- Water pond (SE) ----
  const pcx = 48, pcy = 46;
  for (let y = pcy - 4; y <= pcy + 4; y++) {
    for (let x = pcx - 5; x <= pcx + 5; x++) {
      const d = Math.hypot(x-pcx, y-pcy);
      if (d < 4.5) tiles[y][x] = T.WATER;
      else if (d < 5.5 && rand() < 0.6) tiles[y][x] = T.MOSS;
    }
  }

  // ---- Structures: footprints we'll render as walls + floor tiles ----
  const structures = [];
  // House 1 (NE of intersection) — multi-room
  structures.push(makeHouse(38, 18, 10, 8, T.FLOOR_WOOD, { interior: true }));
  // House 2 (SW) — multi-room, second exterior door not added (keep door logic simple)
  structures.push(makeHouse(8, 40, 11, 9, T.FLOOR_WOOD, { interior: true }));
  // Convenience store (NW corner of intersection) — open floor plan
  structures.push(makeHouse(18, 22, 8, 7, T.FLOOR_TILE));
  // Chapel (south) — open floor plan
  structures.push(makeChapel(40, 42, 9, 10));

  // Apply structure floors to tilemap
  structures.forEach(s => {
    for (let y = s.y; y < s.y + s.h; y++) {
      for (let x = s.x; x < s.x + s.w; x++) {
        if (y >= 0 && y < WORLD_SIZE && x >= 0 && x < WORLD_SIZE) {
          tiles[y][x] = s.floor;
        }
      }
    }
  });

  // ---- Props: trees, fences, cars, crates, gravestones, barrels ----
  const props = [];

  // Trees scattered (avoid roads + structures + cemetery)
  for (let i = 0; i < 80; i++) {
    const x = randi(WORLD_SIZE), y = randi(WORLD_SIZE);
    const t = tiles[y][x];
    if (t === T.GRASS || t === T.GRASS_DARK || t === T.MOSS) {
      if (!inAnyStructure(x, y, structures, 1)) {
        props.push({ type: 'tree', wx: x + 0.5, wy: y + 0.5, blocks: true, hp: 30, variant: randi(3) });
      }
    }
  }

  // Dead trees in cemetery
  for (let i = 0; i < 6; i++) {
    const x = 6 + randi(12), y = 6 + randi(10);
    if (tiles[y][x] === T.DIRT) {
      props.push({ type: 'deadtree', wx: x + 0.5, wy: y + 0.5, blocks: true, hp: 20 });
    }
  }

  // Gravestones in cemetery
  for (let y = 6; y < 16; y++) {
    for (let x = 6; x < 18; x++) {
      if (tiles[y][x] === T.GRAVE && rand() < 0.7) {
        props.push({ type: 'gravestone', wx: x + 0.5, wy: y + 0.5, blocks: false });
      }
    }
  }

  // Cars on the road (a few)
  const carSpots = [
    { x: 28.5, y: 12, rot: 0 },
    { x: 28.5, y: 50, rot: 1 },
    { x: 14, y: 32.5, rot: 2 },
    { x: 46, y: 32.5, rot: 2 }
  ];
  carSpots.forEach((c, i) => {
    props.push({
      type: 'car',
      wx: c.x, wy: c.y,
      blocks: true,
      rot: c.rot,
      container: true,
      hp: 60,
      color: ['oklch(0.30 0.05 25)', 'oklch(0.30 0.02 220)', 'oklch(0.28 0.01 60)', 'oklch(0.35 0.01 250)'][i % 4],
      loot: [
        { item: 'rag', qty: 1 + randi(3) },
        rand() < 0.5 ? { item: 'shotgun_shell', qty: 2 + randi(4) } : null,
        rand() < 0.3 ? { item: 'med_bandage', qty: 1 } : null,
        rand() < 0.4 ? { item: 'canned_food', qty: 1 } : null
      ].filter(Boolean),
      opened: false
    });
  });

  // Barrels & crates near structures
  structures.forEach(s => {
    for (let i = 0; i < 3; i++) {
      const px = s.x - 1 + randi(s.w + 2);
      const py = s.y + s.h + (rand() < 0.5 ? 0 : 1);
      if (py >= 0 && py < WORLD_SIZE && px >= 0 && px < WORLD_SIZE) {
        const t = tiles[py][px];
        if (t === T.GRASS || t === T.GRASS_DARK || t === T.MOSS || t === T.DIRT) {
          const isBarrel = rand() < 0.5;
          props.push({
            type: isBarrel ? 'barrel' : 'crate',
            wx: px + 0.5, wy: py + 0.5,
            blocks: true,
            container: true,
            hp: 25,
            loot: rollContainerLoot(isBarrel ? 'barrel' : 'crate'),
            opened: false
          });
        }
      }
    }
  });

  // Chest in chapel
  const chapel = structures[3];
  props.push({
    type: 'chest',
    wx: chapel.x + chapel.w/2,
    wy: chapel.y + 1,
    blocks: true,
    container: true,
    hp: 40,
    loot: [
      { item: 'silver_dagger', qty: 1 },
      { item: 'mana_potion', qty: 2 },
      { item: 'spell_scroll', qty: 1 },
      { item: 'gold_coin', qty: 8 }
    ],
    opened: false
  });

  // Fence segments around house 2
  const h2 = structures[1];
  for (let x = h2.x - 1; x <= h2.x + h2.w; x++) {
    if (x === h2.x + Math.floor(h2.w/2)) continue; // gate
    props.push({ type: 'fence', wx: x + 0.5, wy: h2.y - 1 + 0.5, blocks: true, hp: 15 });
  }

  // Light switches — one inside each structure, just past the south door
  for (const s of structures) {
    const sw = {
      type: 'light_switch',
      wx: s.door.x + 0.5,
      wy: s.y + s.h - 1.5,
      blocks: false,
      structure: s
    };
    props.push(sw);
  }

  // Doors get HP so they can be broken down
  for (const s of structures) {
    s.door.hp = 40;
    s.door.maxHp = 40;
    if (s.interiorDoor) {
      s.interiorDoor.hp = 25;
      s.interiorDoor.maxHp = 25;
    }
  }

  return { tiles, structures, props, roadX, roadY, noises: [] };
}

function makeHouse(x, y, w, h, floor, opts) {
  opts = opts || {};
  // Walls: along perimeter. Door at middle of south wall.
  const walls = [];
  const door = { x: x + Math.floor(w/2), y: y + h - 1, side: 's', open: false };
  for (let i = 0; i < w; i++) {
    walls.push({ wx: x + i + 0.5, wy: y + 0.0, side: 'n' });
    if (!(x + i === door.x && i !== 0 && i !== w-1)) {
      walls.push({ wx: x + i + 0.5, wy: y + h - 0.0, side: 's', door: (x+i === door.x) });
    }
  }
  for (let j = 0; j < h; j++) {
    walls.push({ wx: x + 0.0,   wy: y + j + 0.5, side: 'w' });
    walls.push({ wx: x + w-0.0, wy: y + j + 0.5, side: 'e' });
  }
  // Optional interior dividing wall — horizontal split through the middle
  const interiorWalls = [];
  let interiorDoor = null;
  if (opts.interior) {
    const divY = y + Math.floor(h / 2);
    const intDoorX = x + Math.floor(w / 2) + (rand() < 0.5 ? -1 : 1);
    interiorDoor = { x: intDoorX, y: divY, side: 'i', open: false };
    for (let i = 1; i < w - 1; i++) {
      const isDoor = (x + i === intDoorX);
      interiorWalls.push({ wx: x + i + 0.5, wy: divY, side: 'i', door: isDoor });
    }
  }
  const lit = rand() < 0.45;
  return {
    x, y, w, h, floor, walls, door, type: 'house', lit,
    interiorWalls, interiorDoor
  };
}

function makeChapel(x, y, w, h) {
  const s = makeHouse(x, y, w, h, T.FLOOR_TILE);
  s.type = 'chapel';
  return s;
}

function inAnyStructure(x, y, structures, pad = 0) {
  return structures.some(s =>
    x >= s.x - pad && x < s.x + s.w + pad &&
    y >= s.y - pad && y < s.y + s.h + pad
  );
}

function rollContainerLoot(kind) {
  const loot = [];
  if (kind === 'barrel') {
    if (rand() < 0.6) loot.push({ item: 'rag', qty: 1 + randi(3) });
    if (rand() < 0.4) loot.push({ item: 'wood_plank', qty: 1 + randi(3) });
    if (rand() < 0.3) loot.push({ item: 'water_bottle', qty: 1 });
    if (rand() < 0.2) loot.push({ item: 'pistol_round', qty: 4 + randi(8) });
  } else {
    if (rand() < 0.5) loot.push({ item: 'canned_food', qty: 1 });
    if (rand() < 0.4) loot.push({ item: 'med_bandage', qty: 1 });
    if (rand() < 0.3) loot.push({ item: 'wood_plank', qty: 2 + randi(2) });
    if (rand() < 0.2) loot.push({ item: 'cloth', qty: 2 });
    if (rand() < 0.15) loot.push({ item: 'hunting_knife', qty: 1 });
  }
  if (loot.length === 0) loot.push({ item: 'rag', qty: 1 });
  return loot;
}

// Walkability check
function isWalkable(world, wx, wy) {
  const tx = Math.floor(wx), ty = Math.floor(wy);
  if (tx < 0 || ty < 0 || tx >= WORLD_SIZE || ty >= WORLD_SIZE) return false;
  const t = world.tiles[ty][tx];
  if (!TILES[t].walkable) return false;
  // Check structures: walls block, but inside floor is fine
  for (const s of world.structures) {
    // Wall collision (thin): we treat each wall as blocking the edge
    if (wx > s.x && wx < s.x + s.w) {
      // north wall (y = s.y), block if very close
      if (Math.abs(wy - s.y) < 0.15 && !isDoor(s, wx, wy, 'n')) return false;
      // south wall — door blocks if closed
      if (Math.abs(wy - (s.y + s.h)) < 0.15) {
        if (isDoor(s, wx, wy, 's')) {
          if (!s.door.open) return false;
        } else {
          return false;
        }
      }
    }
    if (wy > s.y && wy < s.y + s.h) {
      if (Math.abs(wx - s.x) < 0.15 && !isDoor(s, wx, wy, 'w')) return false;
      if (Math.abs(wx - (s.x + s.w)) < 0.15 && !isDoor(s, wx, wy, 'e')) return false;
    }
    // Interior wall (horizontal divider)
    if (s.interiorWalls && s.interiorWalls.length) {
      const divY = s.interiorWalls[0].wy;
      if (wx > s.x && wx < s.x + s.w && Math.abs(wy - divY) < 0.15) {
        // Is this where the interior door is?
        const intD = s.interiorDoor;
        const onDoor = intD && Math.abs(wx - (intD.x + 0.5)) < 0.6;
        if (!onDoor || !intD.open) return false;
      }
    }
  }
  return true;
}
function isDoor(s, wx, wy, side) {
  if (side !== s.door.side) return false;
  return Math.abs(wx - (s.door.x + 0.5)) < 0.6;
}

// Find the structure whose door is nearest (closed or open) to a world point.
// Returns { structure, distance, isInterior } or null.
function nearestDoor(world, wx, wy, maxDist) {
  if (maxDist === undefined) maxDist = 1.4;
  let best = null, bestD = maxDist, bestInt = false;
  for (const s of world.structures) {
    // South-wall main door
    const mdx = (s.door.x + 0.5) - wx;
    const mdy = (s.y + s.h) - wy;
    const md = Math.hypot(mdx, mdy);
    if (md < bestD) { bestD = md; best = s; bestInt = false; }
    // Interior door (if present)
    if (s.interiorDoor) {
      const idx = (s.interiorDoor.x + 0.5) - wx;
      const idy = s.interiorDoor.y - wy;
      const id = Math.hypot(idx, idy);
      if (id < bestD) { bestD = id; best = s; bestInt = true; }
    }
  }
  return best ? { structure: best, distance: bestD, isInterior: bestInt } : null;
}

// Is the player INSIDE a given structure?
function insideStructure(s, wx, wy) {
  return wx > s.x && wx < s.x + s.w && wy > s.y && wy < s.y + s.h;
}
function structureAt(world, wx, wy) {
  for (const s of world.structures) {
    if (insideStructure(s, wx, wy)) return s;
  }
  return null;
}

// ----- Line of sight -----
// Returns true if a straight line from (ax,ay) to (bx,by) is not blocked
// by any solid wall (exterior or interior). Closed doors block sight too.
function hasLineOfSight(world, ax, ay, bx, by) {
  for (const s of world.structures) {
    // Exterior walls — four line segments around the rectangle.
    // N wall: y = s.y, x in [s.x, s.x+s.w]
    // S wall: y = s.y+s.h, x in [s.x, s.x+s.w]   — has a door gap
    // W wall: x = s.x, y in [s.y, s.y+s.h]
    // E wall: x = s.x+s.w, y in [s.y, s.y+s.h]
    if (_segCrossesWall(ax, ay, bx, by, s.x, s.y, s.x + s.w, s.y, null, s, 'n')) return false;
    if (_segCrossesWall(ax, ay, bx, by, s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.door, s, 's')) return false;
    if (_segCrossesWall(ax, ay, bx, by, s.x, s.y, s.x, s.y + s.h, null, s, 'w')) return false;
    if (_segCrossesWall(ax, ay, bx, by, s.x + s.w, s.y, s.x + s.w, s.y + s.h, null, s, 'e')) return false;
    // Interior wall (horizontal divider) with optional door
    if (s.interiorWalls && s.interiorWalls.length > 0) {
      const divY = s.interiorWalls[0].wy;
      if (_segCrossesWall(ax, ay, bx, by, s.x, divY, s.x + s.w, divY, s.interiorDoor, s, 'i')) return false;
    }
  }
  return true;
}

// Helper: does segment (ax,ay)-(bx,by) cross wall segment (wx1,wy1)-(wx2,wy2)?
// If `doorOpt` is provided and it's open AND the crossing point lies inside the
// door's tile range, the wall does NOT block. Otherwise it does.
function _segCrossesWall(ax, ay, bx, by, wx1, wy1, wx2, wy2, doorOpt, structure, side) {
  const hit = _segIntersect(ax, ay, bx, by, wx1, wy1, wx2, wy2);
  if (!hit) return false;
  if (doorOpt && doorOpt.open) {
    // If the crossing point falls within the door tile (within ±0.6 of the door center) treat as open
    if (side === 's' || side === 'n') {
      if (Math.abs(hit.x - (doorOpt.x + 0.5)) < 0.6) return false;
    } else if (side === 'i') {
      // Interior door is on a horizontal line — door center is (doorOpt.x + 0.5)
      if (Math.abs(hit.x - (doorOpt.x + 0.5)) < 0.6) return false;
    } else {
      if (Math.abs(hit.y - (doorOpt.y + 0.5)) < 0.6) return false;
    }
  }
  return true;
}

// Standard segment-segment intersection. Returns {x,y} of the hit, or null.
function _segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + t * (bx - ax), y: ay + t * (by - ay) };
}

// Find prop near a world point (for melee hit testing & interaction)
function propAt(world, wx, wy, radius = 0.6) {
  for (const p of world.props) {
    if (p.dead) continue;
    if (dist(p.wx, p.wy, wx, wy) <= radius) return p;
  }
  return null;
}

window.ISO = {
  TILE_W, TILE_H, HALF_W, HALF_H,
  worldToScreen, screenToWorld, dist, dist2,
  T, TILES, WORLD_SIZE,
  genWorld, isWalkable, propAt, isDoor, nearestDoor, insideStructure, structureAt,
  hasLineOfSight,
  rand, randi, choice
};

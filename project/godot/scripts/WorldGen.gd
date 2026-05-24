# WorldGen.gd — Post-apocalyptic NYC procedural world generator.
# Attach to a Node2D in Main.tscn.
#
# Required sibling nodes:
#   ▸ TileMapLayer "Ground"     — Godot 4.3 TileMapLayer in iso mode
#   ▸ Node2D       "Structures" — receives instanced building scenes
#   ▸ Node2D       "Props"      — receives prop scenes (trees, cars, barrels)
#   ▸ Node2D       "Enemies"    — receives enemy scenes
#   ▸ Node2D       "Drops"      — receives ground-drop scenes

class_name WorldGen
extends Node2D

const WORLD_SIZE: int = 80

# NYC tile types — ordered to match PlaceholderAssets source IDs
enum Tile {
	ASPHALT,        # 0  city block ground
	ASPHALT_DARK,   # 1  cracked / scorched
	CONCRETE_MOSS,  # 2  overgrown concrete
	DIRT,           # 3  exposed earth / collapsed basement
	ROAD,           # 4  asphalt road lane
	ROAD_EDGE,      # 5  road edge / yellow line
	SIDEWALK,       # 6  concrete pavement slab
	FLOOR_CONCRETE, # 7  interior floor (office / apt)
	FLOOR_TILE,     # 8  tiled interior (lobby / shop)
	WATER,          # 9  flooded / sewer overflow
	RUBBLE          # 10 collapsed building debris
}

@export var ground_layer: TileMapLayer
@export var structures_root: Node2D
@export var props_root: Node2D
@export var enemies_root: Node2D
@export var drops_root: Node2D

@export_group("Scenes")
@export var house_scene: PackedScene
@export var chapel_scene: PackedScene
@export var tree_scene: PackedScene
@export var dead_tree_scene: PackedScene
@export var gravestone_scene: PackedScene
@export var car_scene: PackedScene
@export var barrel_scene: PackedScene
@export var crate_scene: PackedScene
@export var chest_scene: PackedScene
@export var fence_scene: PackedScene
@export var skeleton_scene: PackedScene
@export var wraith_scene: PackedScene
@export var ghoul_scene: PackedScene
@export var drop_scene: PackedScene

@export var seed_value: int = 7

var rng: RandomNumberGenerator

# City block layout — avenues run N-S every ~14 tiles, streets run E-W every ~10
const AVENUE_WIDTH: int = 3   # road tiles wide (2 lane + 1 edge each side)
const STREET_WIDTH: int = 3
const SIDEWALK_W: int = 2
const AVE_SPACING: int = 16   # cells between avenue centerlines
const ST_SPACING: int = 12    # cells between street centerlines

func _ready() -> void:
	add_to_group("worldgen")
	rng = RandomNumberGenerator.new()
	rng.seed = seed_value

	var p := get_parent()
	if ground_layer == null and p != null:
		ground_layer = p.get_node_or_null("Ground") as TileMapLayer
	if structures_root == null and p != null:
		structures_root = p.get_node_or_null("Structures") as Node2D
	if props_root == null and p != null:
		props_root = p.get_node_or_null("Props") as Node2D
	if enemies_root == null and p != null:
		enemies_root = p.get_node_or_null("Enemies") as Node2D
	if drops_root == null and p != null:
		drops_root = p.get_node_or_null("Drops") as Node2D

	if ground_layer != null and ground_layer.tile_set == null:
		var pa: Node = get_node_or_null("/root/PlaceholderAssets")
		if pa != null:
			ground_layer.tile_set = pa.tile_set

	_fill_ground()
	_carve_city_grid()
	_add_flooded_zones()
	_add_rubble_fields()
	_place_buildings()
	_scatter_props()
	_spawn_enemies()

# ─── ground fill ─────────────────────────────────────────────────────────────

func _fill_ground() -> void:
	for y in WORLD_SIZE:
		for x in WORLD_SIZE:
			var r: float = rng.randf()
			var t: int = Tile.ASPHALT
			if r < 0.10:
				t = Tile.ASPHALT_DARK
			elif r < 0.14:
				t = Tile.CONCRETE_MOSS
			ground_layer.set_cell(Vector2i(x, y), t, Vector2i.ZERO)

# ─── NYC city grid ────────────────────────────────────────────────────────────

func _is_avenue(x: int) -> bool:
	var offset: int = (x + 2) % AVE_SPACING
	return offset < AVENUE_WIDTH

func _is_avenue_edge(x: int) -> bool:
	var offset: int = (x + 2) % AVE_SPACING
	return offset == AVENUE_WIDTH or offset == AVENUE_WIDTH + SIDEWALK_W - 1 or offset == AVENUE_WIDTH - 1

func _is_street(y: int) -> bool:
	var offset: int = (y + 1) % ST_SPACING
	return offset < STREET_WIDTH

func _is_street_edge(y: int) -> bool:
	var offset: int = (y + 1) % ST_SPACING
	return offset == STREET_WIDTH or offset == STREET_WIDTH + SIDEWALK_W - 1 or offset == STREET_WIDTH - 1

func _is_sidewalk(x: int, y: int) -> bool:
	var ax: int = (x + 2) % AVE_SPACING
	var sy: int = (y + 1) % ST_SPACING
	var near_ave: bool = ax == AVENUE_WIDTH or ax == AVENUE_WIDTH + 1
	var near_st: bool = sy == STREET_WIDTH or sy == STREET_WIDTH + 1
	return near_ave or near_st

func _carve_city_grid() -> void:
	for y in WORLD_SIZE:
		for x in WORLD_SIZE:
			var on_ave: bool = _is_avenue(x)
			var on_st: bool = _is_street(y)

			if on_ave or on_st:
				ground_layer.set_cell(Vector2i(x, y), Tile.ROAD, Vector2i.ZERO)
			elif _is_sidewalk(x, y):
				ground_layer.set_cell(Vector2i(x, y), Tile.SIDEWALK, Vector2i.ZERO)

	# Yellow road edge markings
	for y in WORLD_SIZE:
		for x in WORLD_SIZE:
			var ax: int = (x + 2) % AVE_SPACING
			var sy: int = (y + 1) % ST_SPACING
			if ax == AVENUE_WIDTH - 1 or ax == AVENUE_WIDTH + AVENUE_WIDTH:
				if not _is_street(y):
					ground_layer.set_cell(Vector2i(x, y), Tile.ROAD_EDGE, Vector2i.ZERO)
			if sy == STREET_WIDTH - 1 or sy == STREET_WIDTH + STREET_WIDTH:
				if not _is_avenue(x):
					ground_layer.set_cell(Vector2i(x, y), Tile.ROAD_EDGE, Vector2i.ZERO)

# ─── environmental zones ──────────────────────────────────────────────────────

func _add_flooded_zones() -> void:
	# Two flooded/sewer areas (broken water mains)
	var zones := [Vector2i(18, 22), Vector2i(54, 58)]
	for ctr in zones:
		for dy in range(-4, 5):
			for dx in range(-4, 5):
				var x: int = ctr.x + dx
				var y: int = ctr.y + dy
				if x < 0 or y < 0 or x >= WORLD_SIZE or y >= WORLD_SIZE:
					continue
				var d: float = Vector2(dx, dy).length()
				if d < 3.2:
					ground_layer.set_cell(Vector2i(x, y), Tile.WATER, Vector2i.ZERO)
				elif d < 4.2 and rng.randf() < 0.5:
					ground_layer.set_cell(Vector2i(x, y), Tile.CONCRETE_MOSS, Vector2i.ZERO)

func _add_rubble_fields() -> void:
	# Collapsed building zones
	var fields := [Vector2i(38, 12), Vector2i(10, 52), Vector2i(62, 38)]
	for ctr in fields:
		for dy in range(-3, 4):
			for dx in range(-5, 6):
				var x: int = ctr.x + dx
				var y: int = ctr.y + dy
				if x < 0 or y < 0 or x >= WORLD_SIZE or y >= WORLD_SIZE:
					continue
				if _is_avenue(x) or _is_street(y):
					continue
				if rng.randf() < 0.7:
					ground_layer.set_cell(Vector2i(x, y), Tile.RUBBLE, Vector2i.ZERO)
				elif rng.randf() < 0.3:
					ground_layer.set_cell(Vector2i(x, y), Tile.DIRT, Vector2i.ZERO)

# ─── buildings ────────────────────────────────────────────────────────────────

func _place_buildings() -> void:
	# Place buildings inside city blocks — skip road/sidewalk cells
	# Block origins are at AVE_SPACING steps; buildings fill the interior
	var block_x_starts: Array[int] = []
	var block_y_starts: Array[int] = []

	var bx: int = AVENUE_WIDTH + SIDEWALK_W
	while bx < WORLD_SIZE - AVE_SPACING:
		block_x_starts.append(bx)
		bx += AVE_SPACING

	var by: int = STREET_WIDTH + SIDEWALK_W
	while by < WORLD_SIZE - ST_SPACING:
		block_y_starts.append(by)
		by += ST_SPACING

	for bsx in block_x_starts:
		for bsy in block_y_starts:
			var interior_w: int = AVE_SPACING - AVENUE_WIDTH - SIDEWALK_W * 2
			var interior_h: int = ST_SPACING - STREET_WIDTH - SIDEWALK_W * 2
			if interior_w < 4 or interior_h < 4:
				continue
			_fill_city_block(bsx, bsy, interior_w, interior_h)

func _fill_city_block(bx: int, by: int, bw: int, bh: int) -> void:
	var r: float = rng.randf()
	var is_ruin: bool = r < 0.25
	var is_open: bool = r < 0.10  # parking lot / open plaza

	if is_open:
		for y in range(by, by + bh):
			for x in range(bx, bx + bw):
				ground_layer.set_cell(Vector2i(x, y), Tile.ASPHALT_DARK, Vector2i.ZERO)
		return

	if is_ruin:
		for y in range(by, by + bh):
			for x in range(bx, bx + bw):
				var tile := Tile.RUBBLE if rng.randf() < 0.6 else Tile.DIRT
				ground_layer.set_cell(Vector2i(x, y), tile, Vector2i.ZERO)
		return

	# Standing building — draw floor tiles, spawn building node
	var is_lobby: bool = rng.randf() < 0.4
	for y in range(by, by + bh):
		for x in range(bx, bx + bw):
			ground_layer.set_cell(Vector2i(x, y),
				Tile.FLOOR_TILE if is_lobby else Tile.FLOOR_CONCRETE, Vector2i.ZERO)

	# Spawn building visual
	if structures_root != null:
		var bld := NYCBuilding.new()
		bld.block_w = bw
		bld.block_h = bh
		bld.is_lobby = is_lobby
		bld.rng_seed = rng.randi()
		bld.position = IsoMath.world_to_screen(Vector2(bx + bw * 0.5, by + bh * 0.5))
		bld.z_index = bx + by + bw / 2 + bh / 2
		structures_root.add_child(bld)

	# Chest inside some buildings
	if chest_scene != null and rng.randf() < 0.2:
		_spawn_prop(chest_scene, Vector2(bx + 1.5, by + 1.5))

# ─── props ────────────────────────────────────────────────────────────────────

func _scatter_props() -> void:
	# Burned-out cars on roads
	for i in 24:
		var x: int = (rng.randi_range(0, WORLD_SIZE / AVE_SPACING - 1)) * AVE_SPACING + 1
		var y: int = rng.randi_range(0, WORLD_SIZE - 1)
		if car_scene != null:
			_spawn_prop(car_scene, Vector2(x + 0.5, y + 0.5))

	# Dead trees / lamp posts through city
	for i in 30:
		var x: int = rng.randi() % WORLD_SIZE
		var y: int = rng.randi() % WORLD_SIZE
		if _is_sidewalk(x, y):
			_spawn_prop(dead_tree_scene, Vector2(x + 0.5, y + 0.5))

	# Barrels / crates in alleys
	for i in 40:
		var x: int = rng.randi() % WORLD_SIZE
		var y: int = rng.randi() % WORLD_SIZE
		if not _is_avenue(x) and not _is_street(y) and not _is_sidewalk(x, y):
			var which: PackedScene = barrel_scene if rng.randf() < 0.6 else crate_scene
			if which != null:
				_spawn_prop(which, Vector2(x + 0.5, y + 0.5))

func _spawn_prop(scn: PackedScene, tile: Vector2) -> void:
	if scn == null:
		return
	var node: Node2D = scn.instantiate()
	node.position = IsoMath.world_to_screen(tile)
	if "tile_pos" in node:
		node.tile_pos = tile
	node.add_to_group("prop")
	props_root.add_child(node)
	node.z_index = int(tile.x + tile.y)

# ─── enemies ──────────────────────────────────────────────────────────────────

func _spawn_enemies() -> void:
	# Ghouls roam the streets
	for i in 12:
		var x: float = rng.randf() * WORLD_SIZE
		var y: float = rng.randf() * WORLD_SIZE
		_spawn_enemy(ghoul_scene, Vector2(x, y))
	# Wraiths haunt flooded zones
	for i in 4:
		_spawn_enemy(wraith_scene, Vector2(18 + rng.randf() * 4.0, 22 + rng.randf() * 4.0))
		_spawn_enemy(wraith_scene, Vector2(54 + rng.randf() * 4.0, 58 + rng.randf() * 4.0))
	# Skeletons in rubble
	for i in 6:
		_spawn_enemy(skeleton_scene, Vector2(38 + rng.randf() * 6.0, 12 + rng.randf() * 5.0))

func _spawn_enemy(scn: PackedScene, tile: Vector2) -> void:
	if scn == null:
		return
	var node: Enemy = scn.instantiate()
	node.position = IsoMath.world_to_screen(tile)
	enemies_root.add_child(node)
	node.z_index = int(tile.x + tile.y)

# ─── drop API (called from Enemy) ────────────────────────────────────────────

func spawn_drop(item: Item, qty: int, world_pos: Vector2) -> void:
	if drop_scene == null:
		return
	var d: Node2D = drop_scene.instantiate()
	d.position = world_pos
	if "item" in d: d.item = item
	if "qty" in d: d.qty = qty
	drops_root.add_child(d)

# ─────────────────────────────────────────────────────────────────────────────
# NYCBuilding — inline class that draws a 2.5D isometric building facade
# ─────────────────────────────────────────────────────────────────────────────

class NYCBuilding extends Node2D:
	var block_w: int = 8
	var block_h: int = 6
	var is_lobby: bool = false
	var rng_seed: int = 0

	var _rng: RandomNumberGenerator
	var _stories: int
	var _facade_color: Color
	var _roof_color: Color
	var _window_color: Color
	var _graffiti_color: Color
	var _has_fire_escape: bool
	var _has_water_tower: bool
	var _damaged: bool

	func _ready() -> void:
		_rng = RandomNumberGenerator.new()
		_rng.seed = rng_seed
		_stories = _rng.randi_range(2, 8) if not is_lobby else _rng.randi_range(4, 12)
		_damaged = _rng.randf() < 0.45
		_has_fire_escape = _rng.randf() < 0.6
		_has_water_tower = _rng.randf() < 0.35 and _stories > 4

		# Choose facade palette — NYC brick/concrete mix
		var palettes: Array[Dictionary] = [
			{f=Color(0.55, 0.32, 0.22), r=Color(0.35, 0.20, 0.14), w=Color(0.55, 0.72, 0.85)},  # brick red
			{f=Color(0.62, 0.58, 0.52), r=Color(0.42, 0.38, 0.32), w=Color(0.60, 0.75, 0.90)},  # limestone
			{f=Color(0.44, 0.44, 0.46), r=Color(0.28, 0.28, 0.30), w=Color(0.50, 0.68, 0.82)},  # concrete
			{f=Color(0.50, 0.46, 0.38), r=Color(0.30, 0.26, 0.20), w=Color(0.55, 0.70, 0.88)},  # brownstone
		]
		var p: Dictionary = palettes[_rng.randi() % palettes.size()]
		_facade_color = p.f
		_roof_color = p.r
		_window_color = p.w
		_graffiti_color = Color(_rng.randf(), _rng.randf() * 0.4, _rng.randf() * 0.3)

	func _draw() -> void:
		var tw: float = 64.0
		var th: float = 32.0
		# Isometric tile footprint in screen space
		var fp_w: float = block_w * tw * 0.5
		var fp_h: float = block_h * th * 0.5
		var story_h: float = minf(20.0, 180.0 / _stories)
		var total_h: float = _stories * story_h

		# --- Left face (west) ---
		var left_pts := PackedVector2Array([
			Vector2(-fp_w, -total_h),
			Vector2(0.0,   -total_h - fp_h),
			Vector2(0.0,   -fp_h),
			Vector2(-fp_w, 0.0)
		])
		var left_base: Color = _facade_color.darkened(0.25)
		draw_colored_polygon(left_pts, left_base)

		# Brick / panel pattern on left face
		_draw_facade_left(left_pts, left_base, total_h, story_h)

		# --- Right face (east) ---
		var right_pts := PackedVector2Array([
			Vector2(0.0,  -total_h - fp_h),
			Vector2(fp_w, -total_h),
			Vector2(fp_w, 0.0),
			Vector2(0.0,  -fp_h)
		])
		var right_base: Color = _facade_color.darkened(0.12)
		draw_colored_polygon(right_pts, right_base)
		_draw_facade_right(right_pts, right_base, total_h, story_h)

		# --- Roof ---
		var roof_pts := PackedVector2Array([
			Vector2(-fp_w, -total_h),
			Vector2(0.0,   -total_h - fp_h),
			Vector2(fp_w,  -total_h),
			Vector2(0.0,   -total_h + fp_h)
		])
		draw_colored_polygon(roof_pts, _roof_color)
		draw_polyline(roof_pts + PackedVector2Array([roof_pts[0]]), Color(0,0,0,0.4), 1.0)

		# Rooftop details
		if _has_water_tower:
			_draw_water_tower(Vector2(fp_w * 0.3, -total_h - fp_h * 0.3))

		# Damage — blown-out section
		if _damaged:
			_draw_damage(fp_w, fp_h, total_h, story_h)

	func _draw_facade_left(pts: PackedVector2Array, base: Color, total_h: float, story_h: float) -> void:
		var fp_w: float = absf(pts[0].x)
		var fp_h: float = absf(pts[1].y - pts[0].y)
		# Story lines
		for s in _stories:
			var t: float = float(s) / float(_stories)
			var y_off: float = -total_h * t
			var p0 := Vector2(-fp_w, y_off)
			var p1 := Vector2(0.0, y_off - fp_h)
			draw_line(p0, p1, Color(0, 0, 0, 0.15), 0.8)
		# Windows
		var win_cols: int = maxi(1, int(block_w * 0.7))
		for s in _stories - 1:
			for c in win_cols:
				var tx: float = (float(c) + 0.5) / float(win_cols)
				# parametric along left face
				var wx: float = lerpf(pts[0].x, pts[3].x, tx)
				var base_y: float = lerpf(pts[0].y, pts[3].y, tx)
				var wy: float = base_y - story_h * (float(s) + 0.5)
				var wy_top: float = base_y - story_h * (float(s) + 0.85)
				var ww: float = story_h * 0.25
				# Skip occasionally for apocalyptic look
				if _rng.randf() < 0.15:
					continue
				var broken: bool = _rng.randf() < 0.3
				var wc: Color = Color(0.05, 0.05, 0.08, 0.8) if broken else _window_color
				draw_rect(Rect2(wx - ww, wy_top, ww * 2.0, story_h * 0.35), wc)
				if not broken:
					draw_line(Vector2(wx - ww, (wy + wy_top) * 0.5), Vector2(wx + ww, (wy + wy_top) * 0.5), Color(0,0,0,0.3), 0.5)
		# Fire escape
		if _has_fire_escape:
			var fe_x: float = pts[0].x * 0.4
			for s in mini(_stories - 1, 5):
				var fy: float = -story_h * (s + 1)
				draw_line(Vector2(fe_x - 3, fy), Vector2(fe_x + 3, fy), Color(0.25, 0.22, 0.18), 1.5)
				draw_line(Vector2(fe_x - 3, fy), Vector2(fe_x - 3, fy + story_h * 0.8), Color(0.25, 0.22, 0.18), 1.0)
				draw_line(Vector2(fe_x + 3, fy), Vector2(fe_x + 3, fy + story_h * 0.8), Color(0.25, 0.22, 0.18), 1.0)
		# Graffiti on ground floor
		if _rng.randf() < 0.5:
			var gx: float = pts[0].x * 0.6
			var gy: float = -story_h * 0.5
			draw_rect(Rect2(gx, gy - story_h * 0.25, story_h * 0.6, story_h * 0.22), _graffiti_color.lightened(0.2))

	func _draw_facade_right(pts: PackedVector2Array, base: Color, total_h: float, story_h: float) -> void:
		var fp_w: float = absf(pts[1].x)
		var fp_h: float = absf(pts[0].y - pts[1].y)
		var win_cols: int = maxi(1, int(block_h * 0.7))
		for s in _stories - 1:
			for c in win_cols:
				var tx: float = (float(c) + 0.5) / float(win_cols)
				var wx: float = lerpf(0.0, pts[1].x, tx)
				var base_y: float = lerpf(pts[0].y, pts[1].y, tx)
				var wy_top: float = base_y - story_h * (float(s) + 0.85)
				var ww: float = story_h * 0.25
				if _rng.randf() < 0.15:
					continue
				var broken: bool = _rng.randf() < 0.3
				var wc: Color = Color(0.05, 0.05, 0.08, 0.8) if broken else _window_color
				draw_rect(Rect2(wx - ww, wy_top, ww * 2.0, story_h * 0.35), wc)
		for s in _stories:
			var t: float = float(s) / float(_stories)
			var y_off: float = -total_h * t
			draw_line(Vector2(0.0, y_off - fp_h), Vector2(fp_w, y_off), Color(0, 0, 0, 0.15), 0.8)

	func _draw_water_tower(pos: Vector2) -> void:
		var tank_w: float = 12.0
		var tank_h: float = 14.0
		# Legs
		draw_line(pos + Vector2(-tank_w * 0.5, 0), pos + Vector2(-tank_w * 0.3, tank_h), Color(0.3, 0.25, 0.2), 1.2)
		draw_line(pos + Vector2(tank_w * 0.5, 0),  pos + Vector2(tank_w * 0.3, tank_h), Color(0.3, 0.25, 0.2), 1.2)
		draw_line(pos + Vector2(0, -4), pos + Vector2(0, tank_h), Color(0.3, 0.25, 0.2), 1.2)
		# Tank body
		draw_circle(pos, tank_w * 0.5, Color(0.35, 0.28, 0.18))
		draw_arc(pos, tank_w * 0.5, 0.0, TAU, 12, Color(0.18, 0.14, 0.08), 1.2)
		# Cone roof
		draw_colored_polygon(PackedVector2Array([
			pos + Vector2(-tank_w * 0.5, 0),
			pos + Vector2(0, -tank_h * 0.5),
			pos + Vector2(tank_w * 0.5, 0)
		]), Color(0.22, 0.16, 0.10))

	func _draw_damage(fp_w: float, fp_h: float, total_h: float, story_h: float) -> void:
		# Jagged hole in upper-right corner of facade
		var dmg_y: float = -total_h * (_rng.randf_range(0.4, 0.75))
		var dmg_pts := PackedVector2Array([
			Vector2(fp_w * 0.3, dmg_y - story_h),
			Vector2(fp_w * 0.7, dmg_y - story_h * 1.5),
			Vector2(fp_w * 0.9, dmg_y - story_h * 0.8),
			Vector2(fp_w * 0.8, dmg_y - story_h * 0.2),
			Vector2(fp_w * 0.4, dmg_y),
		])
		draw_colored_polygon(dmg_pts, Color(0.05, 0.04, 0.04, 0.85))
		# Scorch marks
		draw_colored_polygon(PackedVector2Array([
			Vector2(fp_w * 0.2, dmg_y),
			Vector2(fp_w * 0.45, dmg_y - story_h * 2.0),
			Vector2(fp_w * 0.6,  dmg_y - story_h * 1.5),
			Vector2(fp_w * 0.35, dmg_y + story_h * 0.3),
		]), Color(0.1, 0.06, 0.02, 0.5))

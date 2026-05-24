# WorldGen.gd — Procedural world filler. Attach to a Node2D in Main.tscn.
#
# Required sibling nodes:
#   ▸ TileMapLayer "Ground"     — Godot 4.3 TileMapLayer in iso mode
#   ▸ Node2D       "Structures" — receives instanced house scenes
#   ▸ Node2D       "Props"      — receives prop scenes (trees, cars, barrels)
#   ▸ Node2D       "Enemies"    — receives enemy scenes
#   ▸ Node2D       "Drops"      — receives ground-drop scenes
#
# Mirrors the JS prototype's genWorld() output but emits real nodes.

class_name WorldGen
extends Node2D

const WORLD_SIZE: int = 60

# TileSet sources — set up in the editor on the TileMapLayer.
# Atlas IDs must match the source IDs you assigned.
enum Tile { GRASS, GRASS_DARK, MOSS, DIRT, ROAD, ROAD_EDGE, SIDEWALK, FLOOR_WOOD, FLOOR_TILE, WATER, GRAVE }

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

func _ready() -> void:
	add_to_group("worldgen")
	rng = RandomNumberGenerator.new()
	rng.seed = seed_value
	if ground_layer != null and ground_layer.tile_set == null:
		var pa: Node = get_node_or_null("/root/PlaceholderAssets")
		if pa != null:
			ground_layer.tile_set = pa.tile_set
	_fill_ground()
	_carve_roads()
	_cemetery()
	_pond()
	_place_structures()
	_scatter_props()
	_spawn_enemies()

# ---------------------------------------------------------------- ground
func _fill_ground() -> void:
	for y in WORLD_SIZE:
		for x in WORLD_SIZE:
			var r: float = rng.randf()
			var t: int = Tile.GRASS
			if r < 0.08: t = Tile.GRASS_DARK
			elif r < 0.12: t = Tile.MOSS
			ground_layer.set_cell(Vector2i(x, y), t, Vector2i.ZERO)

# ---------------------------------------------------------------- roads
func _carve_roads() -> void:
	var rx: int = 28
	var ry: int = 32
	for y in WORLD_SIZE:
		ground_layer.set_cell(Vector2i(rx, y), Tile.ROAD)
		ground_layer.set_cell(Vector2i(rx + 1, y), Tile.ROAD)
		ground_layer.set_cell(Vector2i(rx - 1, y), Tile.ROAD_EDGE)
		ground_layer.set_cell(Vector2i(rx + 2, y), Tile.ROAD_EDGE)
	for x in WORLD_SIZE:
		ground_layer.set_cell(Vector2i(x, ry), Tile.ROAD)
		ground_layer.set_cell(Vector2i(x, ry + 1), Tile.ROAD)
		ground_layer.set_cell(Vector2i(x, ry - 1), Tile.ROAD_EDGE)
		ground_layer.set_cell(Vector2i(x, ry + 2), Tile.ROAD_EDGE)

# ---------------------------------------------------------------- cemetery
func _cemetery() -> void:
	for y in range(6, 16):
		for x in range(6, 18):
			var t: int = Tile.GRAVE if rng.randf() < 0.4 else Tile.DIRT
			ground_layer.set_cell(Vector2i(x, y), t)
			if rng.randf() < 0.5 and t == Tile.GRAVE:
				_spawn_prop(gravestone_scene, Vector2(x + 0.5, y + 0.5))

	for i in 6:
		var x := rng.randi_range(6, 17)
		var y := rng.randi_range(6, 15)
		_spawn_prop(dead_tree_scene, Vector2(x + 0.5, y + 0.5))

# ---------------------------------------------------------------- pond
func _pond() -> void:
	var cx: int = 48
	var cy: int = 46
	for y in range(cy - 5, cy + 6):
		for x in range(cx - 5, cx + 6):
			var d: float = Vector2(x - cx, y - cy).length()
			if d < 4.5:
				ground_layer.set_cell(Vector2i(x, y), Tile.WATER)
			elif d < 5.5 and rng.randf() < 0.6:
				ground_layer.set_cell(Vector2i(x, y), Tile.MOSS)

# ---------------------------------------------------------------- houses + chapel
func _place_structures() -> void:
	_instance_house(38, 18, 10, 8, false)
	_instance_house(8, 40, 11, 9, false)
	_instance_house(18, 22, 8, 7, false)
	_instance_house(40, 42, 9, 10, true)   # chapel

func _instance_house(x: int, y: int, w: int, h: int, is_chapel: bool) -> void:
	var scn: PackedScene = chapel_scene if is_chapel else house_scene
	if scn == null:
		return
	var node: Node2D = scn.instantiate()
	node.position = IsoMath.world_to_screen(Vector2(x + w * 0.5, y + h * 0.5))
	if "footprint" in node:
		node.footprint = Vector2i(w, h)
	structures_root.add_child(node)
	# Floor tiles inside
	for yy in range(y, y + h):
		for xx in range(x, x + w):
			ground_layer.set_cell(Vector2i(xx, yy), Tile.FLOOR_TILE if is_chapel else Tile.FLOOR_WOOD)
	# Chest in chapel
	if is_chapel and chest_scene != null:
		_spawn_prop(chest_scene, Vector2(x + w * 0.5, y + 1.0))

# ---------------------------------------------------------------- props
func _scatter_props() -> void:
	# Trees
	for i in 80:
		var x: int = rng.randi() % WORLD_SIZE
		var y: int = rng.randi() % WORLD_SIZE
		_spawn_prop(tree_scene, Vector2(x + 0.5, y + 0.5))
	# Cars on road
	var car_spots := [Vector2(28.5, 12), Vector2(28.5, 50), Vector2(14, 32.5), Vector2(46, 32.5)]
	for sp in car_spots:
		_spawn_prop(car_scene, sp)
	# Barrels / crates near each structure (you can iterate the structures group here)

func _spawn_prop(scn: PackedScene, tile: Vector2) -> void:
	if scn == null:
		return
	var node: Node2D = scn.instantiate()
	node.position = IsoMath.world_to_screen(tile)
	if "tile_pos" in node:
		node.tile_pos = tile
	node.add_to_group("prop")
	props_root.add_child(node)
	# Set z_index for painter sort
	node.z_index = int(tile.x + tile.y)

# ---------------------------------------------------------------- enemies
func _spawn_enemies() -> void:
	# Cemetery skeletons
	for i in 6:
		_spawn_enemy(skeleton_scene, Vector2(7 + rng.randf() * 10.0, 7 + rng.randf() * 8.0))
	# Chapel wraiths
	for i in 3:
		_spawn_enemy(wraith_scene, Vector2(40 + rng.randf() * 9.0, 42 + rng.randf() * 10.0))
	# Field ghouls
	for i in 4:
		_spawn_enemy(ghoul_scene, Vector2(rng.randf() * WORLD_SIZE, rng.randf() * WORLD_SIZE))

func _spawn_enemy(scn: PackedScene, tile: Vector2) -> void:
	if scn == null: return
	var node: Enemy = scn.instantiate()
	node.position = IsoMath.world_to_screen(tile)
	enemies_root.add_child(node)
	node.z_index = int(tile.x + tile.y)

# ---------------------------------------------------------------- drop spawning (called from anywhere)
func spawn_drop(item: Item, qty: int, world_pos: Vector2) -> void:
	if drop_scene == null:
		return
	var d: Node2D = drop_scene.instantiate()
	d.position = world_pos
	if "item" in d: d.item = item
	if "qty" in d: d.qty = qty
	drops_root.add_child(d)

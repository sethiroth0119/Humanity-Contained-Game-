# Prop.gd — Base class for destructible / breakable scenery (trees, fences, etc.).
# Containers (chests, barrels, cars) extend this with .loot + opened state.

class_name Prop
extends StaticBody2D

@export var max_hp: float = 30.0
@export var blocks_movement: bool = true
@export var drops: Array[Item] = []
@export var drop_qty_min: Array[int] = []
@export var drop_qty_max: Array[int] = []

var hp: float
var tile_pos: Vector2
var is_dead: bool = false

func _ready() -> void:
	hp = max_hp
	add_to_group("prop")

func damage(amount: float) -> void:
	if is_dead:
		return
	hp -= amount
	# Flash sprite, shake — implement in subclass override
	if hp <= 0.0:
		_break()

func _break() -> void:
	is_dead = true
	# Spawn drops
	var world_gen := get_tree().get_first_node_in_group("world_gen") as WorldGen
	if world_gen != null:
		for i in drops.size():
			var q: int = randi_range(drop_qty_min[i], drop_qty_max[i])
			world_gen.spawn_drop(drops[i], q, global_position)
	queue_free()

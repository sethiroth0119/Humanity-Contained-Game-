# House.gd — A single building. Wraps walls + doors + lights + interior.
#
# Required children (set up in the editor):
#   ▸ Walls (Node2D)
#       ├── NorthWall, SouthWall, EastWall, WestWall (StaticBody2D each)
#       └── InteriorWall (optional, only if `interior` is true)
#   ▸ MainDoor (Door scene)
#   ▸ InteriorDoor (Door scene, optional)
#   ▸ LightSwitch (LightSwitch scene)
#   ▸ WindowLights (Node2D containing Light2D children for warm window glow)
#
# A WorldGen helper instantiates these and wires the references.

class_name House
extends Node2D

@export var lit: bool = false
@export var has_interior: bool = false
@export var footprint: Vector2i = Vector2i(10, 8)   # in tiles

@onready var window_lights: Node2D = $WindowLights
@onready var main_door: Door = $MainDoor

func _ready() -> void:
	add_to_group("house")
	_apply_lit()

func set_lit(value: bool) -> void:
	if lit == value:
		return
	lit = value
	_apply_lit()
	EventBus.emit_signal("building_light_changed", self, lit)

func _apply_lit() -> void:
	if window_lights == null:
		return
	for child in window_lights.get_children():
		if child is Light2D:
			# Smooth in / out
			var tw: Tween = create_tween()
			tw.tween_property(child, "energy", 1.0 if lit else 0.0, 0.4)

func is_player_inside(player: Node2D) -> bool:
	# Check if player's tile coords are within our footprint
	var ptile: Vector2 = IsoMath.screen_to_world(player.global_position)
	var origin_tile: Vector2 = IsoMath.screen_to_world(global_position)
	var local: Vector2 = ptile - origin_tile
	return local.x > 0 and local.x < footprint.x and local.y > 0 and local.y < footprint.y

# Door.gd — Toggle-able door on a wall. Closed blocks movement; open is a gap.
# Attach to a Node2D with an Area2D + CollisionShape2D (physics layer "World").
# When `is_open`, the collision shape is disabled.

class_name Door
extends Node2D

signal toggled(is_open: bool)

@export var is_open: bool = false
@export var is_interior: bool = false     # interior wall door (shorter render)
@export var open_log_text: String = "The door creaks open."
@export var close_log_text: String = "You push the door closed."

@onready var collision: CollisionShape2D = $Collision
@onready var sprite: Sprite2D = $Sprite

func _ready() -> void:
	add_to_group("door")
	_apply_state()

func toggle() -> void:
	is_open = not is_open
	_apply_state()
	emit_signal("toggled", is_open)
	EventBus.emit_signal(
		"log_message",
		open_log_text if is_open else close_log_text,
		&"dim"
	)

func _apply_state() -> void:
	collision.disabled = is_open
	# Swap sprite frame or rotate, depending on art
	sprite.region_enabled = true
	# Editor-defined regions: rect (0,0,32,32) closed, (32,0,32,32) open
	sprite.region_rect = Rect2(32 if is_open else 0, 0, 32, 32)

class_name Drop
extends Area2D

@export var item: Item
@export var qty: int = 1

@onready var sprite: Sprite2D = $Sprite

func _ready() -> void:
	add_to_group("drop")
	body_entered.connect(_on_body_entered)
	if item != null and item.world_sprite != null:
		sprite.texture = item.world_sprite

func _on_body_entered(body: Node) -> void:
	if not body.is_in_group("player"):
		return
	if Inventory.add(item, qty):
		queue_free()

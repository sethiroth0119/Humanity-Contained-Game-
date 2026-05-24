# Recipe.gd — Crafting recipe Resource.
# Live as .tres files in res://resources/recipes/

class_name Recipe
extends Resource

@export var id: StringName = &""
@export var output_item: Item
@export var output_qty: int = 1

# Two parallel arrays kept simple for editor authoring.
# Use the same length: input_items[i] and input_qty[i] form one requirement.
@export var input_items: Array[Item] = []
@export var input_qty: Array[int] = []

@export_multiline var flavor: String = ""

func can_craft() -> bool:
	for i in input_items.size():
		if Inventory.count(input_items[i].id) < input_qty[i]:
			return false
	return true

func craft() -> bool:
	if not can_craft():
		return false
	for i in input_items.size():
		Inventory.consume(input_items[i].id, input_qty[i])
	Inventory.add(output_item, output_qty)
	EventBus.emit_signal("recipe_crafted", self)
	return true

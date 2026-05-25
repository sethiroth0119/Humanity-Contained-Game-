# Container.gd — Lootable container (chest, barrel, crate, car).
# Extends Prop so it can also be smashed open (if hp > 0) to dump loot as drops.
#
# To open via interaction: player presses E within `interact_range`, the Main
# scene calls `open_for(player)` which raises a panel with `.loot`.

class_name Container
extends Prop

@export var container_label: String = "Container"
@export var loot: Array[Item] = []
@export var loot_qty: Array[int] = []

var opened: bool = false

func open_for(_player: Node) -> Dictionary:
	opened = true
	# Caller (HUD/LootPanel) reads `loot` + `loot_qty`.
	EventBus.emit_signal("container_opened", self)
	return { "items": loot, "qty": loot_qty }

func take(index: int) -> Dictionary:
	if index < 0 or index >= loot.size():
		return {}
	var out := { "item": loot[index], "qty": loot_qty[index] }
	loot.remove_at(index)
	loot_qty.remove_at(index)
	return out

# Inventory.gd — Autoload singleton holding the player's pack, equipment, and hotbar.
# Mirrors the JS prototype's INVENTORY module 1:1 in API.
#
# Listen to EventBus.inventory_changed / equipment_changed for HUD redraws.

extends Node

const MAX_SLOTS: int = 32

# Each slot: { "item": Item, "qty": int }   or null
var slots: Array = []

# Equipment: { weapon: WeaponItem, armor: Item, shield: Item, accessory: Item }
var equipment: Dictionary = {
	&"weapon": null,
	&"armor": null,
	&"shield": null,
	&"accessory": null,
}

# Hotbar: 5 entries. Each is either an int slot-index, -1 (sentinel = "equipped weapon"), or null.
var hotbar: Array = [null, null, null, null, null]

func _ready() -> void:
	slots.resize(MAX_SLOTS)

# ---- Add / remove ----

func add(item: Item, qty: int = 1) -> bool:
	if item == null or qty <= 0:
		return false
	# Try stack first
	if item.stack > 1:
		for i in slots.size():
			var s = slots[i]
			if s != null and s.item == item:
				s.qty += qty
				EventBus.emit_signal("inventory_changed")
				return true
	# Empty slot
	for i in slots.size():
		if slots[i] == null:
			slots[i] = { "item": item, "qty": qty }
			EventBus.emit_signal("inventory_changed")
			EventBus.emit_signal("item_picked_up", item, qty)
			return true
	return false

func remove_at(slot_index: int, qty: int = 1) -> Dictionary:
	var s = slots[slot_index]
	if s == null:
		return {}
	var taken: int = mini(qty, s.qty)
	s.qty -= taken
	var out := { "item": s.item, "qty": taken }
	if s.qty <= 0:
		slots[slot_index] = null
	EventBus.emit_signal("inventory_changed")
	return out

func count(item_id: StringName) -> int:
	var n: int = 0
	for s in slots:
		if s != null and s.item.id == item_id:
			n += s.qty
	return n

func consume(item_id: StringName, qty: int) -> bool:
	var need: int = qty
	for i in slots.size():
		if need <= 0: break
		var s = slots[i]
		if s != null and s.item.id == item_id:
			var take: int = mini(s.qty, need)
			s.qty -= take
			need -= take
			if s.qty <= 0:
				slots[i] = null
	EventBus.emit_signal("inventory_changed")
	return need == 0

# ---- Equipment ----

func equip(slot_index: int) -> bool:
	var s = slots[slot_index]
	if s == null:
		return false
	var item: Item = s.item
	var key: StringName
	match item.kind:
		Item.Kind.WEAPON: key = &"weapon"
		Item.Kind.ARMOR: key = &"armor"
		Item.Kind.SHIELD: key = &"shield"
		Item.Kind.ACCESSORY: key = &"accessory"
		_: return false
	var prev = equipment[key]
	equipment[key] = { "item": item, "qty": 1 }
	slots[slot_index] = prev
	EventBus.emit_signal("equipment_changed", key, item)
	EventBus.emit_signal("inventory_changed")
	return true

func unequip(slot_key: StringName) -> bool:
	var cur = equipment[slot_key]
	if cur == null:
		return false
	for i in slots.size():
		if slots[i] == null:
			slots[i] = cur
			equipment[slot_key] = null
			EventBus.emit_signal("equipment_changed", slot_key, null)
			EventBus.emit_signal("inventory_changed")
			return true
	return false

func equipped_weapon() -> WeaponItem:
	var e = equipment[&"weapon"]
	if e == null:
		return null
	return e.item as WeaponItem

# ---- Hotbar ----

func set_hotbar(idx: int, slot_index_or_sentinel) -> void:
	hotbar[idx] = slot_index_or_sentinel
	EventBus.emit_signal("inventory_changed")

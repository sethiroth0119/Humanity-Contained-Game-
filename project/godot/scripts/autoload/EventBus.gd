# EventBus.gd — Autoload singleton.
# Global signal hub so systems stay decoupled. Emit from anywhere,
# listen from anywhere (HUD, audio, save system, achievements, …).

extends Node

# Player
signal player_hurt(amount: float, source: Node)
signal player_died
signal player_healed(amount: float)
signal stats_changed                              # any of hp/stam/mana/hunger/thirst

# Combat
signal enemy_hit(enemy: Node, damage: float)
signal enemy_killed(enemy: Node)
signal player_attacked(weapon: WeaponItem, facing: float)
signal swing_started(arc_data: Dictionary)

# Inventory / loot
signal inventory_changed
signal item_picked_up(item: Item, qty: int)
signal container_opened(container: Node)
signal recipe_crafted(recipe: Recipe)
signal equipment_changed(slot: StringName, item: Item)

# World
signal time_changed(minutes_since_dawn: float)
signal phase_changed(phase: StringName)           # &"day", &"dusk", &"night", &"dawn"

# UI
signal log_message(text: String, severity: StringName)  # &"info", &"warn", &"good", &"dim"
signal prompt_show(text: String)
signal prompt_hide

# Dialogue
signal dialogue_opened(dialogue: Resource)
signal dialogue_line(text: String, index: int, total: int)
signal dialogue_closed

# Civilians + faction combat
signal civilian_killed(civ: Node)
signal building_light_changed(house: Node, lit: bool)

# Faction.gd — Resource describing a faction and its hostility relationships.
# Authored as .tres files in res://resources/factions/.
#
# Each entity (player, enemy, civilian) holds a reference to a Faction.
# The targeting system reads `hostile_to` to decide whether to engage.

class_name Faction
extends Resource

@export var id: StringName = &""
@export var display_name: String = "Unnamed"

# StringNames of other faction ids this faction will attack on sight.
@export var hostile_to: Array[StringName] = []

# Visual flag for UI: red for monster, gold for hostile humans, green for civilians.
@export var color: Color = Color(0.7, 0.7, 0.7)

func is_hostile_to(other_id: StringName) -> bool:
	return other_id in hostile_to

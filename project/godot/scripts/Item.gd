# Item.gd — Base Resource class for any item in the game.
# Items live as .tres files in res://resources/items/ and are referenced
# by the Inventory autoload + UI tooltips + crafting recipes.
#
# To create one in-editor:  FileSystem ▸ + ▸ Resource ▸ Item (or WeaponItem)
# then save as a .tres. Drag into recipes / loot tables / starting inventory.

class_name Item
extends Resource

enum Kind { MATERIAL, AMMO, CONSUMABLE, WEAPON, ARMOR, SHIELD, ACCESSORY }

@export var id: StringName = &""
@export var display_name: String = "Untitled"
@export_multiline var description: String = ""
@export var kind: Kind = Kind.MATERIAL
@export var stack: int = 1                       # max stack size
@export var icon: Texture2D                      # 32×32 ideal
@export var world_sprite: Texture2D              # ground-drop sprite

# Consumable effects (kind == CONSUMABLE)
@export_group("Consumable")
@export var heal: int = 0
@export var restore_hunger: int = 0
@export var restore_thirst: int = 0
@export var restore_mana: int = 0
@export var special: StringName = &""            # e.g. "illume", "berserk"

# Armor / shield (kind == ARMOR / SHIELD / ACCESSORY)
@export_group("Defense")
@export var defense: int = 0
@export var block_fraction: float = 0.0          # shields only: % damage reduced when blocking
@export var mana_regen: float = 0.0              # accessories only: per-second

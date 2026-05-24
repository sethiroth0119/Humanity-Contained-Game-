# WeaponItem.gd — A weapon-flavoured Item. Used by Player.attack().
#
# Mirrors the JS prototype's per-weapon fields exactly:
#   damage, range, arc, cooldown, stamina cost, ranged, ammo, mana cost,
#   spread, bonus-vs-kind multiplier.
#
# Make sure `kind = WEAPON` when you instantiate one in the editor.

class_name WeaponItem
extends Item

enum Shape { SWORD, AXE, DAGGER, SPEAR, BOW, STAFF, PISTOL, SHOTGUN, FIST }

@export_group("Weapon")
@export var shape: Shape = Shape.SWORD

# Melee
@export var damage: float = 18.0
@export var attack_range: float = 1.4            # in tiles
@export var arc: float = 1.3                     # radians (full arc width)
@export var cooldown_ms: int = 500
@export var stamina_cost: float = 8.0

# Ranged (set ranged = true)
@export_group("Ranged")
@export var ranged: bool = false
@export var ammo_id: StringName = &""            # "" or "mana"
@export var mana_cost: float = 0.0
@export var spread: float = 0.0                  # damage variance factor (shotguns)

# Bonus damage vs particular enemy kind
@export_group("Bonus")
@export var bonus_vs_kind: StringName = &""      # "wraith", "skeleton", "ghoul"
@export var bonus_multiplier: float = 1.0

func _init() -> void:
	kind = Kind.WEAPON

# Convenience: returns the damage for a strike, accounting for kind bonus + spread.
func roll_damage(target_kind: StringName) -> float:
	var d: float = damage
	if bonus_vs_kind != &"" and target_kind == bonus_vs_kind:
		d *= bonus_multiplier
	if spread > 0.0:
		d *= 1.0 - spread * 0.5 + randf() * spread
	return d

# EnemyData.gd — Resource describing one enemy archetype.
# Authored as .tres files in res://resources/enemies/.

class_name EnemyData
extends Resource

@export var id: StringName = &""
@export var display_name: String = "Enemy"

@export_group("Stats")
@export var max_hp: float = 35.0
@export var move_speed_tiles: float = 1.8
@export var damage: float = 8.0
@export var attack_range: float = 0.9
@export var attack_cooldown_ms: int = 1100
@export var sight_range_tiles: float = 10.0

@export_group("Behavior")
@export var ghost: bool = false                  # passes through walls (wraith)
@export var ai_script: Script                    # the AI module to attach
@export var sprite_scene: PackedScene            # how to draw it

@export_group("Drops")
@export var drop_items: Array[Item] = []
@export var drop_chances: Array[float] = []      # parallel to drop_items
@export var drop_qty_min: Array[int] = []
@export var drop_qty_max: Array[int] = []

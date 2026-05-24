# Enemy.gd — Base class for all hostile mobs.
# Attach to a CharacterBody2D in Enemy.tscn. Drop in an EnemyData resource
# to configure stats + AI script. The AI script is _called_ each frame
# via `ai_tick(delta)` so it stays decoupled from the body.
#
# Required children:
#   ▸ Sprite2D / AnimatedSprite2D "Sprite"
#   ▸ CollisionShape2D "Collision"
#   ▸ Node "AIHost"  — instance the EnemyData.ai_script as its script

class_name Enemy
extends CharacterBody2D

@export var data: EnemyData

# Runtime
var hp: float
var is_dying: bool = false
var dying_ms: int = 0
var attack_cd_ms: int = 0
var alert: bool = false
var kb_velocity: Vector2 = Vector2.ZERO
var kb_ms: int = 0
var flash_ms: int = 0
var tile_pos: Vector2 = Vector2.ZERO

# Cached
var player: Player
var kind: StringName

@onready var sprite: Node2D = $Sprite
@onready var ai_host: Node = $AIHost

func _ready() -> void:
	add_to_group("enemy")
	hp = data.max_hp
	kind = data.id
	tile_pos = IsoMath.screen_to_world(global_position)
	player = get_tree().get_first_node_in_group("player") as Player
	# AI scripts: must implement ai_tick(self, delta)
	if data.ai_script != null and ai_host.get_script() == null:
		ai_host.set_script(data.ai_script)

func _physics_process(delta: float) -> void:
	tile_pos = IsoMath.screen_to_world(global_position)

	if is_dying:
		dying_ms += int(delta * 1000.0)
		modulate.a = maxf(0.0, 1.0 - dying_ms / 600.0)
		if dying_ms > 600:
			_drop_loot()
			queue_free()
		return

	attack_cd_ms = maxi(0, attack_cd_ms - int(delta * 1000.0))
	flash_ms = maxi(0, flash_ms - int(delta * 1000.0))

	# Knockback
	if kb_ms > 0:
		global_position += kb_velocity
		kb_ms -= int(delta * 1000.0)

	# Delegate to AI module
	if ai_host.has_method("ai_tick"):
		ai_host.ai_tick(self, delta)

# ----------------------------------------------------------------------
# Damage
# ----------------------------------------------------------------------
func take_damage(amount: float, source: Node) -> void:
	if is_dying:
		return
	hp -= amount
	alert = true
	flash_ms = 200
	# Knockback away from source
	if source is Node2D:
		var dir: Vector2 = (global_position - source.global_position).normalized()
		kb_velocity = dir * 6.0
		kb_ms = 120
	if hp <= 0.0:
		is_dying = true
		EventBus.emit_signal("enemy_killed", self)

# ----------------------------------------------------------------------
# Attack the player (called by AI when in range)
# ----------------------------------------------------------------------
func attack_player() -> void:
	if player == null or attack_cd_ms > 0:
		return
	attack_cd_ms = data.attack_cooldown_ms
	player.take_damage(data.damage, self)

# ----------------------------------------------------------------------
# Move toward a target in screen-space; respects ghost flag.
# ----------------------------------------------------------------------
func move_toward_tile(target_tile: Vector2, delta: float) -> void:
	var here: Vector2 = tile_pos
	var to_tile: Vector2 = target_tile - here
	if to_tile.length() < 0.05:
		velocity = Vector2.ZERO
		return
	var step: Vector2 = to_tile.normalized() * data.move_speed_tiles
	var screen_vel: Vector2 = IsoMath.world_to_screen(step)
	velocity = screen_vel
	if data.ghost:
		global_position += screen_vel * delta
	else:
		move_and_slide()

# ----------------------------------------------------------------------
# Loot drop
# ----------------------------------------------------------------------
func _drop_loot() -> void:
	for i in data.drop_items.size():
		if randf() > data.drop_chances[i]:
			continue
		var q: int = randi_range(data.drop_qty_min[i], data.drop_qty_max[i])
		# Spawn a ground-drop scene at this position. WorldGen handles the actual scene.
		EventBus.emit_signal("item_picked_up", data.drop_items[i], 0)  # placeholder
		# Real implementation: get_parent().spawn_drop(data.drop_items[i], q, global_position)

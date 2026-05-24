# SkeletonAI.gd — Bone-and-rust melee bruiser. Idle wander → spotted → chase → swing.
# Attach as the script on Enemy's $AIHost child (or via EnemyData.ai_script).

extends Node

var wander_target: Vector2 = Vector2.ZERO
var wander_cd: float = 0.0

func ai_tick(e: Enemy, delta: float) -> void:
	if e.player == null:
		return
	var to_player_dist: float = e.tile_pos.distance_to(e.player.tile_pos)

	# Aggro?
	if to_player_dist < e.data.sight_range_tiles:
		e.alert = true

	if not e.alert:
		_wander(e, delta)
		return

	if to_player_dist > e.data.attack_range:
		# Chase
		e.move_toward_tile(e.player.tile_pos, delta)
	else:
		# In range — swing
		e.velocity = Vector2.ZERO
		e.attack_player()

func _wander(e: Enemy, delta: float) -> void:
	wander_cd -= delta
	if wander_cd <= 0.0:
		wander_target = e.tile_pos + Vector2(randf_range(-3.0, 3.0), randf_range(-3.0, 3.0))
		wander_cd = randf_range(2.0, 5.0)
	# Wander slower than aggro speed
	var here: Vector2 = e.tile_pos
	var to_tile: Vector2 = wander_target - here
	if to_tile.length() < 0.1:
		e.velocity = Vector2.ZERO
		return
	var step: Vector2 = to_tile.normalized() * e.data.move_speed_tiles * 0.4
	e.velocity = IsoMath.world_to_screen(step)
	e.move_and_slide()

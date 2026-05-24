# BanditAI.gd — Ranged human hostile. Shoots from distance, flees or switches melee when dry.
extends Node

const KEEP_DIST: float = 4.5  # tiles
const FLEE_CHANCE: float = 0.55

var _ammo: int = 8
var _ranged_cd: float = 0.0
var _melee_cd: float = 0.0
var _decided_flee: bool = false

func ai_tick(e, delta: float) -> void:
	_ranged_cd = maxf(0.0, _ranged_cd - delta)
	_melee_cd  = maxf(0.0, _melee_cd  - delta)

	if not e.alert:
		_wander(e, delta)
		return

	var target: Node2D = _get_target(e)
	if target == null:
		_wander(e, delta)
		return

	var tw: Vector2 = IsoMath.screen_to_world(target.position)
	var ew: Vector2 = IsoMath.screen_to_world(e.position)
	var dist: float = ew.distance_to(tw)

	if _ammo > 0:
		_engage_ranged(e, ew, tw, dist, delta)
	else:
		if not _decided_flee:
			_decided_flee = true
			e._flee = randf() < FLEE_CHANCE
		if e._flee:
			_flee(e, ew, tw, delta)
		else:
			_engage_melee(e, ew, tw, dist, delta)

func _engage_ranged(e, ew: Vector2, tw: Vector2, dist: float, _delta: float) -> void:
	var ranged_range: float = e.data.attack_range if e.data else 8.0
	# Strafe to keep distance
	var dir: Vector2 = (ew - tw).normalized()
	var diff: float = dist - KEEP_DIST
	if absf(diff) > 0.5:
		var move_dir: Vector2 = dir if diff < 0 else -dir
		e.velocity = IsoMath.world_to_screen(move_dir * (e.data.move_speed_tiles if e.data else 2.0)) \
			- IsoMath.world_to_screen(Vector2.ZERO)
		e.move_and_slide()
	else:
		e.velocity = Vector2.ZERO

	if dist <= ranged_range and _ranged_cd <= 0.0:
		_fire(e, tw)
		_ranged_cd = (e.data.attack_cooldown_ms if e.data else 720) / 1000.0

func _fire(e, tw: Vector2) -> void:
	_ammo -= 1
	var dmg: float = e.data.damage if e.data else 18.0
	var target: Node2D = _get_target(e)
	if target and target.has_method("take_damage"):
		target.take_damage(dmg, e)
	EventBus.enemy_hit.emit(e, target)

func _engage_melee(e, ew: Vector2, tw: Vector2, dist: float, _delta: float) -> void:
	var melee_range: float = 1.2
	if dist > melee_range:
		var spd: float = e.data.move_speed_tiles if e.data else 2.0
		var dir: Vector2 = (tw - ew).normalized()
		var screen_vel: Vector2 = IsoMath.world_to_screen(ew + dir * spd) - IsoMath.world_to_screen(ew)
		e.velocity = screen_vel
		e.move_and_slide()
	else:
		e.velocity = Vector2.ZERO
		if _melee_cd <= 0.0:
			var target: Node2D = _get_target(e)
			if target and target.has_method("take_damage"):
				target.take_damage(e.data.damage if e.data else 10.0, e)
			_melee_cd = (e.data.attack_cooldown_ms if e.data else 900) / 1000.0

func _flee(e, ew: Vector2, tw: Vector2, _delta: float) -> void:
	var spd: float = (e.data.move_speed_tiles if e.data else 2.0) * 1.2
	var dir: Vector2 = (ew - tw).normalized()
	var screen_vel: Vector2 = IsoMath.world_to_screen(ew + dir * spd) - IsoMath.world_to_screen(ew)
	e.velocity = screen_vel
	e.move_and_slide()

func _wander(e, delta: float) -> void:
	if not e.has_meta("wander_timer"):
		e.set_meta("wander_timer", 0.0)
		e.set_meta("wander_dir", Vector2.ZERO)
	var t: float = e.get_meta("wander_timer") - delta
	if t <= 0.0:
		t = randf_range(1.5, 3.5)
		e.set_meta("wander_dir", Vector2(randf_range(-1,1), randf_range(-1,1)).normalized())
	e.set_meta("wander_timer", t)
	var ew: Vector2 = IsoMath.screen_to_world(e.position)
	var d: Vector2 = e.get_meta("wander_dir")
	var spd: float = (e.data.move_speed_tiles if e.data else 2.0) * 0.4
	e.velocity = IsoMath.world_to_screen(ew + d * spd) - IsoMath.world_to_screen(ew)
	e.move_and_slide()

func _get_target(e) -> Node2D:
	var players: Array = e.get_tree().get_nodes_in_group("player")
	return players[0] if players.size() > 0 else null

# GuardAI.gd — Cursed guard. Shotgun at close range, never flees, switches to melee when dry.
extends Node

const KEEP_DIST: float = 3.0  # tiles

var _ammo: int = 6
var _ranged_cd: float = 0.0
var _melee_cd: float = 0.0

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
		_engage_ranged(e, ew, tw, dist)
	else:
		_engage_melee(e, ew, tw, dist)

func _engage_ranged(e, ew: Vector2, tw: Vector2, dist: float) -> void:
	var shotgun_range: float = 6.0
	var diff: float = dist - KEEP_DIST
	if absf(diff) > 0.5:
		var dir: Vector2 = (ew - tw).normalized()
		var move_dir: Vector2 = dir if diff < 0 else -dir
		var spd: float = e.data.move_speed_tiles if e.data else 1.5
		e.velocity = IsoMath.world_to_screen(ew + move_dir * spd) - IsoMath.world_to_screen(ew)
		e.move_and_slide()
	else:
		e.velocity = Vector2.ZERO

	if dist <= shotgun_range and _ranged_cd <= 0.0:
		_fire_shotgun(e, ew, tw)
		_ranged_cd = (e.data.attack_cooldown_ms if e.data else 1000) / 1000.0

func _fire_shotgun(e, _ew: Vector2, _tw: Vector2) -> void:
	_ammo -= 1
	var dmg: float = (e.data.damage if e.data else 30.0) * randf_range(0.7, 1.3)
	var target: Node2D = _get_target(e)
	if target and target.has_method("take_damage"):
		target.take_damage(dmg, e)

func _engage_melee(e, ew: Vector2, tw: Vector2, dist: float) -> void:
	var melee_range: float = 1.1
	if dist > melee_range:
		var spd: float = e.data.move_speed_tiles if e.data else 1.5
		var dir: Vector2 = (tw - ew).normalized()
		e.velocity = IsoMath.world_to_screen(ew + dir * spd) - IsoMath.world_to_screen(ew)
		e.move_and_slide()
	else:
		e.velocity = Vector2.ZERO
		if _melee_cd <= 0.0:
			var target: Node2D = _get_target(e)
			if target and target.has_method("take_damage"):
				target.take_damage(e.data.damage if e.data else 16.0, e)
			_melee_cd = (e.data.attack_cooldown_ms if e.data else 1200) / 1000.0

func _wander(e, delta: float) -> void:
	if not e.has_meta("wander_timer"):
		e.set_meta("wander_timer", 0.0)
		e.set_meta("wander_dir", Vector2.ZERO)
	var t: float = e.get_meta("wander_timer") - delta
	if t <= 0.0:
		t = randf_range(2.0, 4.0)
		e.set_meta("wander_dir", Vector2(randf_range(-1,1), randf_range(-1,1)).normalized())
	e.set_meta("wander_timer", t)
	var ew: Vector2 = IsoMath.screen_to_world(e.position)
	var d: Vector2 = e.get_meta("wander_dir")
	var spd: float = (e.data.move_speed_tiles if e.data else 1.5) * 0.35
	e.velocity = IsoMath.world_to_screen(ew + d * spd) - IsoMath.world_to_screen(ew)
	e.move_and_slide()

func _get_target(e) -> Node2D:
	var players: Array = e.get_tree().get_nodes_in_group("player")
	return players[0] if players.size() > 0 else null

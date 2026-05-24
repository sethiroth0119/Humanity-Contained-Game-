# CultistAI.gd — Magic-caster. Stays at range, charges a bolt for 500ms then fires.
extends Node

const MAGIC_RANGE: float = 7.0
const CHARGE_TIME: float = 0.5

var _magic_cd: float = 0.0
var _charge: float = -1.0   # -1 = not charging; >=0 = charging timer

func ai_tick(e, delta: float) -> void:
	_magic_cd = maxf(0.0, _magic_cd - delta)

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

	# Move to within magic range
	if dist > MAGIC_RANGE:
		_charge = -1.0
		var spd: float = e.data.move_speed_tiles if e.data else 1.6
		var dir: Vector2 = (tw - ew).normalized()
		e.velocity = IsoMath.world_to_screen(ew + dir * spd) - IsoMath.world_to_screen(ew)
		e.move_and_slide()
		return

	e.velocity = Vector2.ZERO

	if _magic_cd > 0.0:
		_charge = -1.0
		return

	# Start or continue charge
	if _charge < 0.0:
		_charge = 0.0

	_charge += delta
	if _charge >= CHARGE_TIME:
		_fire_bolt(e, tw)
		_charge = -1.0
		_magic_cd = (e.data.attack_cooldown_ms if e.data else 1800) / 1000.0

func _fire_bolt(e, _tw: Vector2) -> void:
	var dmg: float = 16.0
	if e.data and e.data.has_method("get"):
		dmg = e.data.damage
	var target: Node2D = _get_target(e)
	if target and target.has_method("take_damage"):
		target.take_damage(dmg * 1.4, e)  # magic bolt hits harder than melee
	EventBus.log_message.emit("A bolt of shadow strikes you!", &"warn")

func _wander(e, delta: float) -> void:
	if not e.has_meta("wander_timer"):
		e.set_meta("wander_timer", 0.0)
		e.set_meta("wander_dir", Vector2.ZERO)
	var t: float = e.get_meta("wander_timer") - delta
	if t <= 0.0:
		t = randf_range(1.8, 4.0)
		e.set_meta("wander_dir", Vector2(randf_range(-1,1), randf_range(-1,1)).normalized())
	e.set_meta("wander_timer", t)
	var ew: Vector2 = IsoMath.screen_to_world(e.position)
	var d: Vector2 = e.get_meta("wander_dir")
	var spd: float = (e.data.move_speed_tiles if e.data else 1.6) * 0.4
	e.velocity = IsoMath.world_to_screen(ew + d * spd) - IsoMath.world_to_screen(ew)
	e.move_and_slide()

func _get_target(e) -> Node2D:
	var players: Array = e.get_tree().get_nodes_in_group("player")
	return players[0] if players.size() > 0 else null

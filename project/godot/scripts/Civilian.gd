# Civilian.gd — Friendly NPC. Wanders, flees hostiles, speaks when prompted.
#
# Required children:
#   ▸ Sprite2D / Sprite3D / MeshInstance3D "Body"
#   ▸ CollisionShape2D "Collision"
#   ▸ DialogueComponent "Speech" — set its `dialogue` to a Dialogue.tres
#
# Group: civilian (set in editor or in _ready)
# Faction: load res://resources/factions/civilian.tres in faction @export

class_name Civilian
extends CharacterBody2D

@export var faction: Faction
@export var dialogue: Dialogue
@export var home_radius_tiles: float = 4.0
@export var wander_speed_tiles: float = 1.4
@export var flee_speed_tiles: float = 2.2
@export var max_hp: float = 28.0

var hp: float = max_hp
var home_position: Vector2
var wander_target: Vector2
var wander_cooldown: float = 0.0
var fleeing: bool = false
var is_dying: bool = false
var dying_ms: int = 0
var aggrieved_at_ms: int = 0   # if player attacked us, treat them as hostile briefly

func _ready() -> void:
	add_to_group("civilian")
	home_position = global_position
	wander_target = home_position

func _physics_process(delta: float) -> void:
	if is_dying:
		dying_ms += int(delta * 1000.0)
		modulate.a = maxf(0.0, 1.0 - dying_ms / 800.0)
		if dying_ms > 800:
			queue_free()
		return

	# Find nearest hostile in 7-tile range
	var threat: Node2D = _find_threat(7.0)
	if threat != null:
		fleeing = true
		_flee_from(threat, delta)
		return

	fleeing = false
	# Wander toward home / random
	wander_cooldown -= delta
	if wander_cooldown <= 0.0 or global_position.distance_to(IsoMath.world_to_screen(wander_target)) < 12:
		wander_target = IsoMath.screen_to_world(home_position) + Vector2(
			randf_range(-home_radius_tiles, home_radius_tiles),
			randf_range(-home_radius_tiles, home_radius_tiles)
		)
		wander_cooldown = randf_range(2.0, 5.0)

	var target_screen: Vector2 = IsoMath.world_to_screen(wander_target)
	var to: Vector2 = target_screen - global_position
	if to.length() > 4:
		velocity = to.normalized() * wander_speed_tiles * IsoMath.HALF_W * 0.5
		move_and_slide()

func _find_threat(range_tiles: float) -> Node2D:
	var best: Node2D = null
	var best_d: float = range_tiles * IsoMath.HALF_W * 2.0   # rough screen-space cap
	for group_name in ["monster", "human_hostile"]:
		for node in get_tree().get_nodes_in_group(group_name):
			if not is_instance_valid(node):
				continue
			var d: float = global_position.distance_to(node.global_position)
			if d < best_d:
				best_d = d
				best = node
	return best

func _flee_from(threat: Node2D, delta: float) -> void:
	var away: Vector2 = (global_position - threat.global_position).normalized()
	velocity = away * flee_speed_tiles * IsoMath.HALF_W * 0.5
	move_and_slide()

func take_damage(amount: float, source: Node) -> void:
	if is_dying:
		return
	hp -= amount
	if source != null and source.is_in_group("player"):
		aggrieved_at_ms = Time.get_ticks_msec()
	if hp <= 0.0:
		is_dying = true
		EventBus.emit_signal("civilian_killed", self)

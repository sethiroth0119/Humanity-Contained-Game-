# Player.gd — Attach to a CharacterBody2D in res://scenes/Player.tscn.
#
# Required children (set up in editor):
#   ▸ Sprite2D            "Sprite"       — body/silhouette (or AnimatedSprite2D)
#   ▸ Sprite2D            "WeaponSprite" — small weapon graphic, anchored offset
#   ▸ CollisionShape2D    "Collision"    — capsule, ~24×12 ellipse footprint
#   ▸ Camera2D            "Camera"
#   ▸ Node2D              "AimIndicator" — child Line2D under it for the facing line
#
# Wire its `tile_pos` to ISO via WorldGen so AI can read it.

class_name Player
extends CharacterBody2D

# ---- Configurable ----
@export var move_speed_tiles: float = 3.5         # tiles per second (walking)
@export var heavy_weapon_speed_tiles: float = 3.0
@export var blocking_speed_tiles: float = 1.2

@export var max_hp: float = 100.0
@export var max_stamina: float = 100.0
@export var max_mana: float = 60.0
@export var max_hunger: float = 100.0
@export var max_thirst: float = 100.0

@export var stamina_drain_per_sec: float = 5.0
@export var stamina_regen_per_sec: float = 8.0
@export var hunger_drain_per_sec: float = 0.30
@export var thirst_drain_per_sec: float = 0.45
@export var mana_regen_per_sec: float = 0.6

# ---- Runtime stats ----
var hp: float = max_hp
var stamina: float = max_stamina
var mana: float = max_mana
var hunger: float = max_hunger
var thirst: float = max_thirst

var facing: float = -PI * 0.5                     # in WORLD-space radians
var tile_pos: Vector2 = Vector2(30, 35)           # convenience: cached tile coords
var blocking: bool = false
var iframe_ms: int = 0
var busy_until_ms: int = 0
var dead: bool = false
var _near_interact: Node = null

# Children references (cached in _ready)
@onready var sprite: Node2D = $Sprite
@onready var weapon_sprite: Sprite2D = $WeaponSprite
@onready var camera: Camera2D = $Camera
@onready var aim_indicator: Node2D = $AimIndicator

# Reference to current swing animation data (consumed by attack VFX)
var current_swing: Dictionary = {}

func _ready() -> void:
	add_to_group("player")
	global_position = IsoMath.world_to_screen(tile_pos)
	# Subscribe to UI signals
	EventBus.emit_signal("stats_changed")
	_give_starter_items()

# ----------------------------------------------------------------------
# Per-frame update
# ----------------------------------------------------------------------
func _physics_process(delta: float) -> void:
	if dead:
		return

	_apply_movement(delta)
	_decay_stats(delta)
	_update_facing()

	# Hold-to-attack
	if Input.is_action_pressed("attack") and not _ui_blocking_input():
		attack()
	# Block toggle
	blocking = Input.is_action_pressed("block") and Inventory.equipment[&"shield"] != null

	# Cache tile_pos from current screen position
	tile_pos = IsoMath.screen_to_world(global_position)
	EventBus.emit_signal("stats_changed")
	_update_interact_prompt()

# ----------------------------------------------------------------------
# Movement (iso WASD → screen-space velocity)
# ----------------------------------------------------------------------
func _apply_movement(delta: float) -> void:
	var move: Vector2 = Vector2.ZERO
	# In iso, screen-up = -wx -wy ; screen-right = +wx -wy
	if Input.is_action_pressed("move_up"):    move += Vector2(-1, -1)
	if Input.is_action_pressed("move_down"):  move += Vector2( 1,  1)
	if Input.is_action_pressed("move_left"):  move += Vector2(-1,  1)
	if Input.is_action_pressed("move_right"): move += Vector2( 1, -1)
	if move.length() > 0.001:
		move = move.normalized()
		# Convert tile-space velocity to screen-space pixels/sec
		var sp: float = _current_speed()
		var screen_vel: Vector2 = IsoMath.world_to_screen(move) * sp
		velocity = screen_vel
		stamina = max(0.0, stamina - stamina_drain_per_sec * delta)
	else:
		velocity = Vector2.ZERO
		stamina = min(max_stamina, stamina + stamina_regen_per_sec * delta)
	move_and_slide()

func _current_speed() -> float:
	if blocking:
		return blocking_speed_tiles
	var w := Inventory.equipped_weapon()
	if w != null and w.cooldown_ms > 700:
		return heavy_weapon_speed_tiles
	return move_speed_tiles

# ----------------------------------------------------------------------
# Stats: hunger / thirst / mana drift
# ----------------------------------------------------------------------
func _decay_stats(delta: float) -> void:
	hunger = max(0.0, hunger - hunger_drain_per_sec * delta)
	thirst = max(0.0, thirst - thirst_drain_per_sec * delta)
	# HP penalty when starving / dehydrated
	if hunger <= 0.0:
		hp = max(0.0, hp - 0.5 * delta)
	if thirst <= 0.0:
		hp = max(0.0, hp - 0.8 * delta)
	# Mana regen (boosted by accessory)
	var regen: float = mana_regen_per_sec
	var acc = Inventory.equipment[&"accessory"]
	if acc != null and acc.item.mana_regen > 0.0:
		regen += acc.item.mana_regen
	mana = min(max_mana, mana + regen * delta)
	iframe_ms = max(0, iframe_ms - int(delta * 1000.0))
	busy_until_ms = max(0, busy_until_ms - int(delta * 1000.0))
	if hp <= 0.0:
		_die()

# ----------------------------------------------------------------------
# Facing — cursor direction in WORLD space
# ----------------------------------------------------------------------
func _update_facing() -> void:
	var cam_offset: Vector2 = camera.get_screen_center_position() - get_viewport().get_visible_rect().size * 0.5
	var mouse_world: Vector2 = get_global_mouse_position()
	facing = IsoMath.cursor_facing(global_position, mouse_world)
	# Update aim indicator rotation (visual only — Line2D inside AimIndicator points along +X)
	aim_indicator.rotation = (IsoMath.world_to_screen(Vector2(cos(facing), sin(facing))) ).angle()

# ----------------------------------------------------------------------
# Attack
# ----------------------------------------------------------------------
func attack() -> void:
	if Time.get_ticks_msec() < busy_until_ms:
		return
	var w := Inventory.equipped_weapon()
	if w == null:
		_melee_swing(_bare_hands())
	elif w.ranged:
		_ranged_shoot(w)
	else:
		_melee_swing(w)

func _bare_hands() -> WeaponItem:
	var w := WeaponItem.new()
	w.id = &"bare_hands"
	w.display_name = "Bare Hands"
	w.shape = WeaponItem.Shape.FIST
	w.damage = 4.0
	w.attack_range = 0.7
	w.arc = 0.9
	w.cooldown_ms = 350
	w.stamina_cost = 2.0
	return w

func _melee_swing(w: WeaponItem) -> void:
	if stamina < w.stamina_cost:
		EventBus.emit_signal("log_message", "You are too winded to swing.", &"dim")
		return
	stamina -= w.stamina_cost
	busy_until_ms = Time.get_ticks_msec() + w.cooldown_ms
	current_swing = {
		"start_t": Time.get_ticks_msec(),
		"duration_ms": int(w.cooldown_ms * 0.6),
		"facing": facing,
		"arc": w.arc,
		"range": w.attack_range,
		"weapon": w
	}
	EventBus.emit_signal("swing_started", current_swing)
	EventBus.emit_signal("player_attacked", w, facing)

	# Resolve damage instantly (no traveling hitbox — matches PZ-style swing)
	var enemies: Array = get_tree().get_nodes_in_group("enemy")
	for e in enemies:
		if not is_instance_valid(e) or e.is_dying:
			continue
		if IsoMath.in_arc(tile_pos, e.tile_pos, facing, w.attack_range, w.arc):
			var dmg: float = w.roll_damage(e.kind)
			e.take_damage(dmg, self)
			EventBus.emit_signal("enemy_hit", e, dmg)
	# Hit props (trees, fences, barrels)
	var props: Array = get_tree().get_nodes_in_group("prop")
	for p in props:
		if not is_instance_valid(p) or not p.has_method("damage"):
			continue
		if IsoMath.in_arc(tile_pos, p.tile_pos, facing, w.attack_range, w.arc):
			p.damage(w.damage * 0.5)

func _ranged_shoot(w: WeaponItem) -> void:
	# Ammo / mana check
	if w.ammo_id == &"mana":
		if mana < w.mana_cost:
			EventBus.emit_signal("log_message", "Your mana wells are dry.", &"dim")
			return
		mana -= w.mana_cost
	elif w.ammo_id != &"":
		if Inventory.count(w.ammo_id) <= 0:
			EventBus.emit_signal("log_message", "Out of ammo.", &"warn")
			return
		Inventory.consume(w.ammo_id, 1)
	busy_until_ms = Time.get_ticks_msec() + w.cooldown_ms
	EventBus.emit_signal("player_attacked", w, facing)

	# Raycast against enemies
	var enemies: Array = []
	for e in get_tree().get_nodes_in_group("enemy"):
		if is_instance_valid(e) and not e.is_dying:
			enemies.append(e)
	var hit: Node = IsoMath.raycast_hit(tile_pos, facing, w.attack_range, enemies, 0.5)
	if hit != null:
		var dmg: float = w.roll_damage(hit.kind)
		hit.take_damage(dmg, self)
		EventBus.emit_signal("enemy_hit", hit, dmg)

	# TODO: spawn a bullet/spell projectile child node for VFX (Line2D fading over 90ms).

# ----------------------------------------------------------------------
# Damage in
# ----------------------------------------------------------------------
func take_damage(amount: float, source: Node) -> void:
	if iframe_ms > 0 or dead:
		return
	var armor_def: float = 0.0
	var shield_def: float = 0.0
	var block_frac: float = 0.0
	var a = Inventory.equipment[&"armor"]
	if a != null: armor_def = a.item.defense
	var s = Inventory.equipment[&"shield"]
	if s != null:
		shield_def = s.item.defense
		if blocking: block_frac = s.item.block_fraction
	var dmg: float = maxf(1.0, amount - armor_def - shield_def - amount * block_frac)
	hp = maxf(0.0, hp - dmg)
	iframe_ms = 250
	EventBus.emit_signal("player_hurt", dmg, source)
	if hp <= 0.0:
		_die()

func _die() -> void:
	if dead:
		return
	dead = true
	velocity = Vector2.ZERO
	EventBus.emit_signal("player_died")

# ----------------------------------------------------------------------
# Starter items
# ----------------------------------------------------------------------
func _give_starter_items() -> void:
	var axe := Database.item(&"hunting_axe")
	if axe != null:
		Inventory.add(axe, 1)
		Inventory.equip(0)
	var food := Database.item(&"canned_food")
	if food != null:
		Inventory.add(food, 3)
	var water := Database.item(&"water_bottle")
	if water != null:
		Inventory.add(water, 3)
	Inventory.hotbar[0] = -1
	for i in Inventory.MAX_SLOTS:
		var s = Inventory.slots[i]
		if s == null: continue
		if s.item.id == &"canned_food" and Inventory.hotbar[1] == null:
			Inventory.hotbar[1] = i
		elif s.item.id == &"water_bottle" and Inventory.hotbar[2] == null:
			Inventory.hotbar[2] = i

# ----------------------------------------------------------------------
# Input — hotbar keys + interact
# ----------------------------------------------------------------------
func _input(event: InputEvent) -> void:
	if dead: return
	if event.is_action_pressed("interact"):
		_interact()
	for i in 5:
		if event.is_action_pressed("hotbar_%d" % (i + 1)):
			_use_hotbar(i)

# ----------------------------------------------------------------------
# Interact prompt
# ----------------------------------------------------------------------
func _update_interact_prompt() -> void:
	var prev := _near_interact
	_near_interact = _find_nearest_interactable(80.0)
	if _near_interact == prev:
		return
	if _near_interact != null:
		var lbl: String = "[E] Interact"
		if _near_interact is Container:
			lbl = "[E] Open %s" % (_near_interact as Container).container_label
		elif _near_interact is Door:
			lbl = "[E] %s" % ("Close door" if (_near_interact as Door).is_open else "Open door")
		EventBus.emit_signal("prompt_show", lbl)
	else:
		EventBus.emit_signal("prompt_hide")

func _find_nearest_interactable(max_dist: float) -> Node:
	var best: Node = null
	var best_dist: float = max_dist
	var nodes: Array = get_tree().get_nodes_in_group("container")
	nodes.append_array(get_tree().get_nodes_in_group("door"))
	for node in nodes:
		if not is_instance_valid(node): continue
		var d: float = global_position.distance_to(node.global_position)
		if d < best_dist:
			best_dist = d
			best = node
	return best

func _interact() -> void:
	if _ui_blocking_input(): return
	var target := _find_nearest_interactable(80.0)
	if target == null:
		EventBus.emit_signal("log_message", "Nothing to interact with.", &"dim")
		return
	if target is Container:
		(target as Container).open_for(self)
	elif target is Door:
		(target as Door).toggle()

# ----------------------------------------------------------------------
# Hotbar / item use
# ----------------------------------------------------------------------
func _use_hotbar(idx: int) -> void:
	if _ui_blocking_input() or dead: return
	var slot_ref = Inventory.hotbar[idx]
	if slot_ref == null: return
	if slot_ref == -1: return  # sentinel = equipped weapon, already equipped
	if slot_ref >= Inventory.MAX_SLOTS: return
	use_item(slot_ref)

func use_item(slot_index: int) -> void:
	var s = Inventory.slots[slot_index]
	if s == null: return
	match s.item.kind:
		Item.Kind.CONSUMABLE:
			_use_consumable(s.item, slot_index)
		Item.Kind.WEAPON, Item.Kind.ARMOR, Item.Kind.SHIELD, Item.Kind.ACCESSORY:
			Inventory.equip(slot_index)

func _use_consumable(item: Item, slot_index: int) -> void:
	Inventory.remove_at(slot_index, 1)
	if item.heal > 0:
		hp = minf(max_hp, hp + item.heal)
		EventBus.emit_signal("player_healed", float(item.heal))
		EventBus.emit_signal("log_message", "Restored %d HP." % item.heal, &"good")
	if item.restore_hunger > 0:
		hunger = minf(max_hunger, hunger + float(item.restore_hunger))
		EventBus.emit_signal("log_message", "You eat something.", &"dim")
	if item.restore_thirst > 0:
		thirst = minf(max_thirst, thirst + float(item.restore_thirst))
		EventBus.emit_signal("log_message", "You drink.", &"dim")
	if item.restore_mana > 0:
		mana = minf(max_mana, mana + float(item.restore_mana))
	match item.special:
		&"illume": GameState.illuminate_for(60.0)
		&"berserk": EventBus.emit_signal("log_message", "Blood-rage!", &"warn")
	EventBus.emit_signal("stats_changed")

# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
func _ui_blocking_input() -> bool:
	# Set this true while any modal panel (inventory, loot, crafting) is open.
	return GameState.paused

# PlaceholderSprite.gd — Draws detailed NYC survivor / undead character art.
# Attach to Node2D child of any entity. Auto-styles by parent group or data.id.
extends Node2D

enum Style { SURVIVOR, ZOMBIE, WRAITH, SKELETON, BANDIT, GUARD, CULTIST, CIVILIAN }

var style: Style = Style.ZOMBIE
var _rng: RandomNumberGenerator
var _seed: int = 0

func _ready() -> void:
	_rng = RandomNumberGenerator.new()
	call_deferred("_auto_style")

func _process(_delta: float) -> void:
	var p := get_parent()
	if p != null and "hp" in p:
		queue_redraw()

func _auto_style() -> void:
	var p := get_parent()
	if p == null:
		queue_redraw()
		return
	# Pick seed from position so each entity looks unique but consistent
	_seed = int(abs(p.position.x * 7.3 + p.position.y * 13.1)) % 65536

	if p.is_in_group("player"):
		style = Style.SURVIVOR
	elif p.is_in_group("civilian"):
		style = Style.CIVILIAN
	elif "data" in p and p.get("data") != null:
		match p.data.id:
			&"skeleton": style = Style.SKELETON
			&"wraith":   style = Style.WRAITH
			&"ghoul":    style = Style.ZOMBIE
			&"cultist":  style = Style.CULTIST
			&"bandit":   style = Style.BANDIT
			&"guard":    style = Style.GUARD
			_:           style = Style.ZOMBIE
	queue_redraw()

func _draw() -> void:
	_rng.seed = _seed
	# Enemy HP bar
	var p2 := get_parent()
	if p2 != null and "hp" in p2 and "data" in p2 and p2.get("data") != null and not p2.is_in_group("player"):
		var pct: float = clampf(float(p2.hp) / float(p2.data.max_hp), 0.0, 1.0)
		var bw: float = 32.0
		var bh: float = 4.0
		var by: float = -60.0
		draw_rect(Rect2(-bw * 0.5, by, bw, bh), Color(0.12, 0.04, 0.04, 0.9))
		var hcol: Color = Color(0.1, 0.85, 0.1) if pct > 0.6 else (Color(0.85, 0.65, 0.1) if pct > 0.3 else Color(0.9, 0.1, 0.1))
		draw_rect(Rect2(-bw * 0.5, by, bw * pct, bh), hcol)
	match style:
		Style.SURVIVOR:  _draw_survivor()
		Style.CIVILIAN:  _draw_civilian()
		Style.ZOMBIE:    _draw_zombie()
		Style.SKELETON:  _draw_skeleton()
		Style.WRAITH:    _draw_wraith()
		Style.BANDIT:    _draw_bandit()
		Style.GUARD:     _draw_guard()
		Style.CULTIST:   _draw_cultist()

# ── shared helpers ────────────────────────────────────────────────────────────

var SHADOW := PackedVector2Array([
	Vector2(-9, 2), Vector2(0, -2), Vector2(9, 2), Vector2(0, 6)
])

func _shadow() -> void:
	draw_colored_polygon(SHADOW, Color(0, 0, 0, 0.28))

func _body(skin: Color, shirt: Color, pants: Color, head_r: float = 7.0) -> void:
	var bw: float = 13.0
	var bh: float = 18.0
	var top: float = -(bh + head_r * 2.0)

	# Legs (split trousers)
	var lw: float = bw * 0.42
	draw_rect(Rect2(-lw - 1.0, top + bh, lw, bh * 0.5), pants.darkened(0.15))
	draw_rect(Rect2(1.0, top + bh, lw, bh * 0.5), pants.darkened(0.05))

	# Torso / shirt
	draw_rect(Rect2(-bw * 0.5, top, bw, bh), shirt)
	draw_rect(Rect2(-bw * 0.5, top, bw, bh), Color(0, 0, 0, 0.18), false, 1.0)

	# Neck
	draw_rect(Rect2(-3, top - head_r * 0.9, 6, head_r * 0.8), skin)

	# Head
	draw_circle(Vector2(0, top - head_r), head_r, skin)
	draw_arc(Vector2(0, top - head_r), head_r, 0.0, TAU, 20, skin.darkened(0.25), 1.2)

	# Eyes
	var ey: float = top - head_r * 1.1
	draw_circle(Vector2(-2.8, ey), 1.4, Color(0.1, 0.1, 0.12))
	draw_circle(Vector2(2.8, ey), 1.4, Color(0.1, 0.1, 0.12))
	draw_circle(Vector2(-2.6, ey), 0.6, Color(0.85, 0.85, 0.9))
	draw_circle(Vector2(2.6, ey), 0.6, Color(0.85, 0.85, 0.9))

func _hair(color: Color, head_r: float = 7.0, style_id: int = 0) -> void:
	var top: float = -(18.0 + head_r * 3.0)
	match style_id % 3:
		0:  # short cap
			draw_arc(Vector2(0, top + head_r * 0.5), head_r, PI, TAU, 12, color, 3.0)
		1:  # mohawk
			draw_line(Vector2(0, top), Vector2(0, top + head_r * 0.3), color, 3.5)
		2:  # longer sides
			draw_arc(Vector2(0, top + head_r * 0.5), head_r + 1.0, PI + 0.3, TAU - 0.3, 10, color, 2.5)

# ── character styles ──────────────────────────────────────────────────────────

func _draw_survivor() -> void:
	_shadow()
	var skin := Color(0.80, 0.64, 0.50)
	var jacket := Color(0.30, 0.32, 0.28)   # military green jacket
	var pants := Color(0.25, 0.22, 0.16)    # dark cargo pants
	_body(skin, jacket, pants)
	_hair(Color(0.25, 0.18, 0.10), 7.0, _rng.randi() % 3)
	# Backpack silhouette
	draw_rect(Rect2(5.0, -30.0, 7.0, 14.0), Color(0.28, 0.24, 0.18))
	draw_rect(Rect2(5.0, -30.0, 7.0, 14.0), Color(0, 0, 0, 0.3), false, 0.8)
	# Weapon — rifle stock visible over shoulder
	draw_line(Vector2(-7, -32), Vector2(-4, -16), Color(0.30, 0.22, 0.14), 2.0)
	draw_line(Vector2(-4, -16), Vector2(-1, -8), Color(0.22, 0.22, 0.22), 2.0)
	# Headlamp / goggles hint
	draw_arc(Vector2(0, -34.0), 3.5, 0.0, TAU, 10, Color(0.65, 0.55, 0.20), 1.5)

func _draw_civilian() -> void:
	_shadow()
	var skins: Array[Color] = [Color(0.88, 0.70, 0.54), Color(0.55, 0.38, 0.28), Color(0.95, 0.78, 0.62)]
	var skin: Color = skins[_rng.randi() % skins.size()]
	var shirt_h := Color(_rng.randf_range(0.4, 0.8), _rng.randf_range(0.2, 0.6), _rng.randf_range(0.1, 0.5))
	_body(skin, shirt_h, Color(0.22, 0.20, 0.28))
	_hair(Color(_rng.randf_range(0.1, 0.7), _rng.randf_range(0.06, 0.4), 0.05), 7.0, _rng.randi() % 3)

func _draw_zombie() -> void:
	_shadow()
	var skin := Color(0.52, 0.58, 0.44)    # greenish-gray undead skin
	var shirt := Color(0.32, 0.28, 0.25)   # torn dirty shirt
	var pants := Color(0.22, 0.20, 0.18)
	_body(skin, shirt, pants, 7.5)
	# Rotting effect — dark spots
	draw_circle(Vector2(-3.5, -28), 2.0, Color(0.25, 0.30, 0.18, 0.7))
	draw_circle(Vector2(4.0, -22), 1.5, Color(0.20, 0.25, 0.14, 0.7))
	# Mouth — open/snarling
	var ey: float = -36.5
	draw_arc(Vector2(0, ey + 5.5), 3.0, 0.2, PI - 0.2, 8, Color(0.1, 0.05, 0.05), 1.5)
	# Claw / reaching arms
	draw_line(Vector2(-7, -22), Vector2(-12, -28), skin.darkened(0.2), 2.5)
	draw_line(Vector2(7, -22), Vector2(13, -26), skin.darkened(0.2), 2.5)
	# Wild hair
	for i in 4:
		var ang: float = PI + _rng.randf() * PI
		var len: float = _rng.randf_range(4.0, 9.0)
		var base := Vector2(0, -42)
		draw_line(base, base + Vector2(cos(ang) * len, sin(ang) * len), Color(0.18, 0.12, 0.06), 1.8)

func _draw_skeleton() -> void:
	_shadow()
	var bone := Color(0.90, 0.86, 0.74)
	var shadow_bone := Color(0.55, 0.52, 0.42)
	# Pelvis / spine
	draw_rect(Rect2(-5, -28, 10, 14), bone)
	draw_line(Vector2(0, -28), Vector2(0, -42), bone, 3.0)
	# Ribcage
	for r in 4:
		var ry: float = -28 - r * 3.2
		draw_line(Vector2(-5.5, ry), Vector2(5.5, ry), bone, 1.5)
		draw_arc(Vector2(-5.5, ry - 1.0), 2.0, PI * 0.5, PI * 1.5, 6, bone, 1.5)
		draw_arc(Vector2(5.5, ry - 1.0),  2.0, -PI * 0.5, PI * 0.5, 6, bone, 1.5)
	# Arms — bone segments
	draw_line(Vector2(-6, -38), Vector2(-11, -28), bone, 3.0)
	draw_line(Vector2(-11, -28), Vector2(-14, -18), bone, 2.5)
	draw_line(Vector2(6, -38), Vector2(11, -28), bone, 3.0)
	draw_line(Vector2(11, -28), Vector2(14, -18), bone, 2.5)
	# Leg bones
	draw_line(Vector2(-3, -14), Vector2(-4, -4), bone, 3.0)
	draw_line(Vector2(3, -14), Vector2(4, -4), bone, 3.0)
	draw_line(Vector2(-4, -4), Vector2(-6, 2), bone, 2.5)
	draw_line(Vector2(4, -4), Vector2(6, 2), bone, 2.5)
	# Skull
	draw_circle(Vector2(0, -46), 8.0, bone)
	draw_arc(Vector2(0, -46), 8.0, 0.0, TAU, 16, shadow_bone, 1.0)
	# Eye sockets
	draw_circle(Vector2(-2.8, -47), 2.2, Color(0.05, 0.04, 0.04))
	draw_circle(Vector2(2.8, -47),  2.2, Color(0.05, 0.04, 0.04))
	# Jaw
	draw_arc(Vector2(0, -40.5), 5.5, 0.15, PI - 0.15, 8, shadow_bone, 1.5)
	draw_line(Vector2(-5.3, -41), Vector2(5.3, -41), bone, 1.2)
	# Glowing eye
	draw_circle(Vector2(-2.8, -47), 1.0, Color(0.8, 0.4, 0.1))
	draw_circle(Vector2(2.8,  -47), 1.0, Color(0.8, 0.4, 0.1))

func _draw_wraith() -> void:
	_shadow()
	# Ghostly robes — semi-transparent layered shapes
	var ghost := Color(0.48, 0.28, 0.72, 0.85)
	var dark := Color(0.18, 0.08, 0.30, 0.9)
	# Flowing robe body — multiple overlapping triangles
	draw_colored_polygon(PackedVector2Array([
		Vector2(0, -14), Vector2(-12, -8), Vector2(-9, 4), Vector2(0, 6), Vector2(9, 4), Vector2(12, -8)
	]), ghost)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-8, -8), Vector2(0, -10), Vector2(8, -8), Vector2(5, 2), Vector2(0, 4), Vector2(-5, 2)
	]), dark)
	# Wispy tendrils at base
	for i in 5:
		var tx: float = lerpf(-10.0, 10.0, float(i) / 4.0)
		var ty: float = 4.0 + sin(i * 1.7) * 3.0
		draw_line(Vector2(tx, ty), Vector2(tx + _rng.randf_range(-3.0, 3.0), ty + 8.0),
			ghost.lightened(0.1), 1.5)
	# Upper body / cloak
	draw_colored_polygon(PackedVector2Array([
		Vector2(-10, -28), Vector2(0, -32), Vector2(10, -28),
		Vector2(8, -18), Vector2(0, -16), Vector2(-8, -18)
	]), ghost)
	# Hood
	draw_circle(Vector2(0, -38), 9.0, dark)
	draw_arc(Vector2(0, -38), 9.0, PI, TAU, 16, ghost.lightened(0.1), 1.5)
	# Glowing eyes
	draw_circle(Vector2(-3, -39.5), 2.5, Color(0.6, 0.2, 1.0, 0.9))
	draw_circle(Vector2(3, -39.5),  2.5, Color(0.6, 0.2, 1.0, 0.9))
	draw_circle(Vector2(-3, -39.5), 1.0, Color(1.0, 0.8, 1.0))
	draw_circle(Vector2(3, -39.5),  1.0, Color(1.0, 0.8, 1.0))
	# Ethereal glow halo
	draw_arc(Vector2(0, -38), 12.0, 0.0, TAU, 24, Color(0.6, 0.2, 1.0, 0.25), 4.0)

func _draw_bandit() -> void:
	_shadow()
	var skin := Color(0.74, 0.56, 0.42)
	var jacket := Color(0.18, 0.16, 0.14)   # black leather jacket
	var pants := Color(0.20, 0.18, 0.16)    # dark jeans
	_body(skin, jacket, pants)
	_hair(Color(0.12, 0.10, 0.08), 7.0, 1)
	# Ski mask / bandana over lower face
	draw_rect(Rect2(-6.5, -38, 13, 6), Color(0.12, 0.12, 0.12))
	# Gun (pistol) in hand
	draw_rect(Rect2(7, -24, 6, 3), Color(0.15, 0.15, 0.15))
	draw_rect(Rect2(11, -22, 2, 5), Color(0.12, 0.12, 0.12))
	# Shoulder knife handle
	draw_line(Vector2(-7, -36), Vector2(-10, -30), Color(0.55, 0.42, 0.18), 2.0)

func _draw_guard() -> void:
	_shadow()
	var skin := Color(0.76, 0.60, 0.46)
	var armor := Color(0.30, 0.36, 0.30)    # olive green tactical
	var pants := Color(0.26, 0.30, 0.26)
	_body(skin, armor, pants)
	_hair(Color(0.18, 0.14, 0.10), 7.0, 0)
	# Tactical helmet
	draw_circle(Vector2(0, -41), 9.5, Color(0.28, 0.34, 0.28))
	draw_arc(Vector2(0, -41), 9.5, PI, TAU, 16, Color(0.18, 0.22, 0.18), 1.5)
	draw_rect(Rect2(-9.5, -41, 19, 3), Color(0.22, 0.28, 0.22))  # brim
	# Body armor plates
	draw_rect(Rect2(-6, -32, 12, 10), Color(0.25, 0.30, 0.25))
	draw_rect(Rect2(-6, -32, 12, 10), Color(0, 0, 0, 0.25), false, 0.8)
	# Shotgun
	draw_line(Vector2(-8, -28), Vector2(-14, -18), Color(0.28, 0.22, 0.16), 3.0)
	draw_line(Vector2(-14, -18), Vector2(-16, -8), Color(0.20, 0.20, 0.20), 2.5)
	draw_rect(Rect2(-17, -10, 3, 6), Color(0.15, 0.15, 0.15))

func _draw_cultist() -> void:
	_shadow()
	var robe := Color(0.22, 0.10, 0.28)     # dark purple robe
	var skin := Color(0.68, 0.54, 0.46)
	# Long robe — wider at base
	draw_colored_polygon(PackedVector2Array([
		Vector2(-8, -28), Vector2(8, -28),
		Vector2(12, 0), Vector2(0, 4), Vector2(-12, 0)
	]), robe)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-8, -28), Vector2(8, -28),
		Vector2(10, -14), Vector2(0, -10), Vector2(-10, -14)
	]), robe.darkened(0.2))
	# Arms out for casting
	draw_line(Vector2(-8, -24), Vector2(-16, -30), skin, 3.5)
	draw_line(Vector2(8, -24),  Vector2(16, -30), skin, 3.5)
	# Hands with glow
	draw_circle(Vector2(-16, -30), 3.5, Color(0.55, 0.10, 0.70))
	draw_circle(Vector2(16, -30),  3.5, Color(0.55, 0.10, 0.70))
	draw_arc(Vector2(-16, -30), 5.5, 0.0, TAU, 12, Color(0.7, 0.2, 1.0, 0.4), 2.5)
	draw_arc(Vector2(16, -30),  5.5, 0.0, TAU, 12, Color(0.7, 0.2, 1.0, 0.4), 2.5)
	# Hood + face
	draw_circle(Vector2(0, -36), 9.0, robe.darkened(0.15))
	draw_circle(Vector2(0, -36), 7.0, skin.darkened(0.3))
	# Glowing cultist eyes
	draw_circle(Vector2(-2.5, -37.5), 1.8, Color(0.8, 0.1, 0.9))
	draw_circle(Vector2(2.5, -37.5),  1.8, Color(0.8, 0.1, 0.9))
	# Sigil / pendant
	draw_circle(Vector2(0, -22), 3.5, Color(0.60, 0.05, 0.75, 0.9))
	draw_arc(Vector2(0, -22), 3.5, 0.0, TAU, 6, Color(0.85, 0.4, 1.0), 1.2)

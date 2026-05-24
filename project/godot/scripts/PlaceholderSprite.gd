# PlaceholderSprite.gd — pawn silhouette drawn with _draw().
# Attach as the script on any Sprite/Body Node2D child.
# Auto-colors based on the parent entity's group or EnemyData id.
extends Node2D

var fill_color: Color = Color(0.75, 0.78, 0.92)
var outline_color: Color = Color(0.0, 0.0, 0.0, 0.45)
var head_radius: float = 7.0
var body_w: float = 14.0
var body_h: float = 20.0

func _ready() -> void:
	call_deferred("_auto_color")

func _auto_color() -> void:
	var p := get_parent()
	if p == null:
		queue_redraw()
		return
	if p.is_in_group("player"):
		fill_color = Color(0.50, 0.72, 1.0)
		outline_color = Color(0.1, 0.2, 0.45, 0.7)
	elif p.is_in_group("civilian"):
		fill_color = Color(0.82, 0.70, 0.50)
		outline_color = Color(0.25, 0.15, 0.05, 0.6)
	elif "data" in p and p.get("data") != null:
		var d = p.data
		match d.id:
			&"skeleton":
				fill_color = Color(0.88, 0.85, 0.72)
				outline_color = Color(0.3, 0.25, 0.1, 0.6)
			&"wraith":
				fill_color = Color(0.55, 0.35, 0.82)
				outline_color = Color(0.15, 0.05, 0.3, 0.7)
			&"ghoul":
				fill_color = Color(0.38, 0.58, 0.28)
				outline_color = Color(0.08, 0.18, 0.05, 0.7)
			&"cultist":
				fill_color = Color(0.40, 0.20, 0.52)
				outline_color = Color(0.1, 0.0, 0.2, 0.7)
			&"bandit":
				fill_color = Color(0.70, 0.55, 0.25)
				outline_color = Color(0.2, 0.1, 0.0, 0.6)
			&"guard":
				fill_color = Color(0.35, 0.45, 0.35)
				outline_color = Color(0.05, 0.12, 0.05, 0.6)
			_:
				fill_color = Color(0.75, 0.28, 0.28)
	queue_redraw()

func _draw() -> void:
	# Drop shadow
	var shadow := PackedVector2Array([
		Vector2(-10, 1), Vector2(0, -3), Vector2(10, 1), Vector2(0, 5)
	])
	draw_colored_polygon(shadow, Color(0.0, 0.0, 0.0, 0.22))
	# Body
	var bx: float = body_w * 0.5
	var top: float = -(body_h + head_radius * 2.0 - 2.0)
	draw_rect(Rect2(-bx, top, body_w, body_h), fill_color)
	draw_rect(Rect2(-bx, top, body_w, body_h), outline_color, false, 1.2)
	# Head
	var hy: float = -(body_h + head_radius + 1.0)
	draw_circle(Vector2(0, hy), head_radius, fill_color)
	draw_arc(Vector2(0, hy), head_radius, 0.0, TAU, 16, outline_color, 1.2)

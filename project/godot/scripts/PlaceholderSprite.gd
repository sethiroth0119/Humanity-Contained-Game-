# PlaceholderSprite.gd — Node2D child that draws a pawn silhouette until real art is added.
# Attach to the Sprite node of Player, Enemy, or Civilian.
extends Node2D

@export var fill_color: Color = Color(0.75, 0.78, 0.92)
@export var outline_color: Color = Color(0.0, 0.0, 0.0, 0.45)
@export var head_radius: float = 7.0
@export var body_w: float = 14.0
@export var body_h: float = 20.0

func _ready() -> void:
	queue_redraw()

func _draw() -> void:
	# Drop shadow (iso-ellipse on the ground plane)
	var shadow: PackedVector2Array = PackedVector2Array([
		Vector2(-10, 1), Vector2(0, -3), Vector2(10, 1), Vector2(0, 5)
	])
	draw_colored_polygon(shadow, Color(0.0, 0.0, 0.0, 0.22))

	# Body rect
	var bx: float = body_w * 0.5
	draw_rect(Rect2(-bx, -(body_h + head_radius * 2.0 - 2.0), body_w, body_h), fill_color)
	draw_rect(Rect2(-bx, -(body_h + head_radius * 2.0 - 2.0), body_w, body_h), outline_color, false, 1.2)

	# Head circle
	var hy: float = -(body_h + head_radius + 1.0)
	draw_circle(Vector2(0, hy), head_radius, fill_color)
	draw_arc(Vector2(0, hy), head_radius, 0.0, TAU, 16, outline_color, 1.2)

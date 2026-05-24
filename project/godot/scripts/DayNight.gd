# DayNight.gd — Reads GameState.darkness() and applies it to a CanvasModulate.
# Attach to a CanvasModulate node in Main.tscn.

extends CanvasModulate

@export var night_tint: Color = Color(0.30, 0.36, 0.52)  # cold moonlight
@export var day_tint: Color = Color(1.0, 1.0, 1.0)
@export var transition_speed: float = 1.5

func _process(delta: float) -> void:
	var d: float = GameState.darkness()
	var target: Color = day_tint.lerp(night_tint, d)
	color = color.lerp(target, transition_speed * delta)

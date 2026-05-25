class_name FloatingText
extends Node2D

func setup(text: String, col: Color) -> void:
	z_index = 200
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_color_override("font_color", col)
	lbl.add_theme_font_size_override("font_size", 16)
	lbl.position = Vector2(-10, 0)
	add_child(lbl)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(self, "position:y", position.y - 52, 0.9)
	tw.tween_property(lbl, "modulate:a", 0.0, 0.9)
	tw.set_parallel(false)
	tw.tween_callback(queue_free)

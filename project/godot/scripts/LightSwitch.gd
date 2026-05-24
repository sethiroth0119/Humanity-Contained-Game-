# LightSwitch.gd — Toggle a House's `lit` state.
# Attach to an Area2D near a building's entrance. Set `house` to the parent
# House node in the editor.

class_name LightSwitch
extends Area2D

@export var house: Node       # House.gd instance — exposes .lit + .set_lit(bool)

func interact() -> void:
	if house == null:
		return
	var new_state: bool = not house.lit
	house.set_lit(new_state)
	EventBus.emit_signal(
		"log_message",
		"The light flickers on." if new_state else "You snuff the light.",
		&"dim"
	)

# DialogueController.gd — Autoload. Manages the currently-open dialogue.
# UI listens to its signals on the EventBus.
#
# Pattern: any node calls DialogueController.open_with(dialogue_resource);
#          UI shows the panel; user clicks/SPACE to advance via .advance();
#          when out of lines, .close() emits dialogue_closed.

extends Node

var current: Dialogue = null
var line_index: int = 0

func is_open() -> bool:
	return current != null

func open_with(dlg: Dialogue) -> void:
	current = dlg
	line_index = 0
	GameState.paused = true   # gate combat input
	EventBus.emit_signal("dialogue_opened", dlg)
	EventBus.emit_signal("dialogue_line", dlg.lines[0], 0, dlg.lines.size())

func advance() -> void:
	if current == null:
		return
	line_index += 1
	if line_index >= current.lines.size():
		close()
	else:
		EventBus.emit_signal(
			"dialogue_line",
			current.lines[line_index],
			line_index,
			current.lines.size()
		)

func close() -> void:
	if current == null:
		return
	current = null
	GameState.paused = false
	EventBus.emit_signal("dialogue_closed")

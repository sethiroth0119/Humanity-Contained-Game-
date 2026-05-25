@tool
extends EditorPlugin

# Called by Godot before every Play / F5 run.
# Returns true to allow the run, false to abort it.
func _build() -> bool:
	print("[AutoPull] Pulling latest code from GitHub...")
	var output: Array = []
	var exit_code: int = OS.execute("git", ["pull"], output, true)
	for line in output:
		var s: String = str(line).strip_edges()
		if s.length() > 0:
			print("[AutoPull] ", s)
	if exit_code != 0:
		push_warning("AutoPull: git pull exited with code %d — running with local files." % exit_code)
	return true   # always let the game run even if pull fails

@tool
extends EditorPlugin

# Called by Godot before every Play / F5 run.
# Stashes any local editor changes, pulls latest code, then restores them.
func _build() -> bool:
	var out: Array = []
	# Stash local changes so Godot's own edits to project.godot don't block the pull
	OS.execute("git", ["stash", "--include-untracked", "-m", "autopull-stash"], out, true)
	out.clear()

	print("[AutoPull] Pulling latest code from GitHub...")
	var exit_code: int = OS.execute("git", ["pull"], out, true)
	for line in out:
		var s: String = str(line).strip_edges()
		if s.length() > 0:
			print("[AutoPull] ", s)

	# Restore any stashed editor changes
	OS.execute("git", ["stash", "pop"], [], true)

	if exit_code != 0:
		push_warning("AutoPull: git pull exited with code %d — running with local files." % exit_code)
	return true   # always let the game run even if pull fails

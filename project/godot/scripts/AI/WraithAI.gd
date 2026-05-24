# WraithAI.gd — Ghostly. Pours through walls (data.ghost = true).
# Speeds up briefly when alerted; takes bonus damage from silver.

extends Node

var spook_warmup: float = 0.4   # delay before pursuing on first sighting

func ai_tick(e: Enemy, delta: float) -> void:
	if e.player == null:
		return
	var d: float = e.tile_pos.distance_to(e.player.tile_pos)
	if d < e.data.sight_range_tiles:
		e.alert = true

	if not e.alert:
		# Drift in a slow oscillation
		var t: float = Time.get_ticks_msec() / 1000.0
		var drift: Vector2 = Vector2(cos(t + e.get_instance_id() * 0.01), sin(t * 0.7 + e.get_instance_id() * 0.01)) * 0.4
		e.global_position += IsoMath.world_to_screen(drift) * delta
		return

	# Warm up then pursue
	spook_warmup -= delta
	if spook_warmup > 0.0:
		return

	if d > e.data.attack_range:
		# Ghost-move (ignores walls)
		e.move_toward_tile(e.player.tile_pos, delta)
	else:
		e.velocity = Vector2.ZERO
		e.attack_player()

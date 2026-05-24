# GhoulAI.gd — Slow, tanky brute. Same shape as Skeleton but with telegraph.

extends Node

var telegraph_ms: int = 0       # winds up before swinging

func ai_tick(e: Enemy, delta: float) -> void:
	if e.player == null: return
	var d: float = e.tile_pos.distance_to(e.player.tile_pos)
	if d < e.data.sight_range_tiles:
		e.alert = true
	if not e.alert:
		return

	if d > e.data.attack_range:
		telegraph_ms = 0
		e.move_toward_tile(e.player.tile_pos, delta)
	else:
		e.velocity = Vector2.ZERO
		# Telegraph: hold position 250ms then swing
		telegraph_ms += int(delta * 1000.0)
		if telegraph_ms >= 250 and e.attack_cd_ms <= 0:
			e.attack_player()
			telegraph_ms = 0

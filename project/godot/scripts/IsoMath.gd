# IsoMath.gd
# Static helpers for isometric world ↔ screen conversion and
# direction utilities used by both player and enemies.
#
# Tile size constants must match the TileMap in WorldGen.
# We use a 2:1 diamond (64×32) — standard for "Project Zomboid"-style iso.

class_name IsoMath
extends RefCounted

const TILE_W: int = 64
const TILE_H: int = 32
const HALF_W: float = TILE_W * 0.5
const HALF_H: float = TILE_H * 0.5

# ----- World <-> Screen (manual; useful for arc math & cursor) -----
# `world` is a Vector2 in tile units (can be fractional).
# `screen` is Vector2 in pixels, relative to the world origin
# (NOT the camera — apply camera offset separately).
static func world_to_screen(world: Vector2) -> Vector2:
	return Vector2((world.x - world.y) * HALF_W, (world.x + world.y) * HALF_H)

static func screen_to_world(screen: Vector2) -> Vector2:
	# Inverse of the above
	var wx: float = (screen.x / HALF_W + screen.y / HALF_H) * 0.5
	var wy: float = (screen.y / HALF_H - screen.x / HALF_W) * 0.5
	return Vector2(wx, wy)

# ----- Cursor → facing angle in world space -----
# Given the player's screen position and the mouse screen position,
# return the angle (radians) in WORLD space pointing from player to mouse.
# Used by Player.gd to set `facing` for directional attacks.
static func cursor_facing(player_screen: Vector2, mouse_screen: Vector2) -> float:
	var rel: Vector2 = mouse_screen - player_screen
	# Un-isometric the screen-space vector back to world-space:
	var world_dir: Vector2 = Vector2(
		rel.x / HALF_W + rel.y / HALF_H,
		rel.y / HALF_H - rel.x / HALF_W
	)
	return world_dir.angle()

# ----- Arc hit test -----
# Returns true if `target` is within `range` of `origin` AND
# within an arc of width `arc_radians` centred on `facing`.
# All vectors are in WORLD (tile) space; angles in WORLD space.
static func in_arc(origin: Vector2, target: Vector2, facing: float, range_tiles: float, arc_radians: float) -> bool:
	var to: Vector2 = target - origin
	if to.length() > range_tiles + 0.4:
		return false
	var ang: float = to.angle()
	var delta: float = wrapf(ang - facing, -PI, PI)
	return absf(delta) <= arc_radians * 0.5 + 0.15

# ----- Ranged ray-hit test (for bows, guns, staff) -----
# Returns the closest entity from `entities` whose position lies within
# `perp_tolerance` of the ray from `origin` along `facing`, and within `max_range`.
static func raycast_hit(origin: Vector2, facing: float, max_range: float, entities: Array, perp_tolerance: float = 0.5) -> Node:
	var dir: Vector2 = Vector2(cos(facing), sin(facing))
	var best: Node = null
	var best_dist: float = INF
	for e in entities:
		if not is_instance_valid(e):
			continue
		var to: Vector2 = e.tile_pos - origin
		var proj: float = to.dot(dir)
		if proj < 0.0 or proj > max_range:
			continue
		var perp: float = absf(-to.x * dir.y + to.y * dir.x)
		if perp > perp_tolerance:
			continue
		if proj < best_dist:
			best_dist = proj
			best = e
	return best

# PlaceholderAssets.gd — Autoload. Builds a TileSet from colored diamond images so
# WorldGen can fill the ground without requiring any texture files.
# WorldGen reads `PlaceholderAssets.tile_set` at the start of its _ready().
extends Node

const TILE_W: int = 64
const TILE_H: int = 32

# One color per WorldGen.Tile enum value (0-10)
const TILE_COLORS: Array = [
	Color(0.22, 0.42, 0.14),   #  0  GRASS
	Color(0.16, 0.32, 0.10),   #  1  GRASS_DARK
	Color(0.18, 0.38, 0.20),   #  2  MOSS
	Color(0.48, 0.36, 0.22),   #  3  DIRT
	Color(0.32, 0.32, 0.32),   #  4  ROAD
	Color(0.26, 0.26, 0.26),   #  5  ROAD_EDGE
	Color(0.52, 0.50, 0.45),   #  6  SIDEWALK
	Color(0.52, 0.40, 0.26),   #  7  FLOOR_WOOD
	Color(0.42, 0.42, 0.52),   #  8  FLOOR_TILE
	Color(0.12, 0.22, 0.52),   #  9  WATER
	Color(0.28, 0.26, 0.22),   # 10  GRAVE
]

var tile_set: TileSet

func _ready() -> void:
	tile_set = _build_tile_set()

func _build_tile_set() -> TileSet:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_ISOMETRIC
	ts.tile_layout = TileSet.TILE_LAYOUT_DIAMOND_DOWN
	ts.tile_size = Vector2i(TILE_W, TILE_H)
	for i in TILE_COLORS.size():
		var src := TileSetAtlasSource.new()
		src.texture = _make_diamond(TILE_COLORS[i])
		src.texture_region_size = Vector2i(TILE_W, TILE_H)
		src.create_tile(Vector2i(0, 0))
		ts.add_source(src, i)
	return ts

func _make_diamond(base: Color) -> ImageTexture:
	var img := Image.create(TILE_W, TILE_H, false, Image.FORMAT_RGBA8)
	var hw: float = TILE_W * 0.5
	var hh: float = TILE_H * 0.5
	for y in TILE_H:
		for x in TILE_W:
			var nx: float = absf(x - hw) / hw
			var ny: float = absf(y - hh) / hh
			if nx + ny < 1.0:
				# Slight edge darkening + left/right face shading
				var edge: float = clampf((1.0 - nx - ny) / 0.12, 0.0, 1.0)
				var side: float = 0.06 if x >= hw else -0.06
				var c := Color(
					clampf(base.r + side - 0.05 * (1.0 - edge), 0.0, 1.0),
					clampf(base.g + side - 0.05 * (1.0 - edge), 0.0, 1.0),
					clampf(base.b + side - 0.05 * (1.0 - edge), 0.0, 1.0)
				)
				img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)

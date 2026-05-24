# PlaceholderAssets.gd — Autoload. Builds a detailed TileSet with NYC textures.
# WorldGen reads `PlaceholderAssets.tile_set` at the start of its _ready().
extends Node

const TILE_W: int = 64
const TILE_H: int = 32

var tile_set: TileSet

func _ready() -> void:
	tile_set = _build_tile_set()

func _build_tile_set() -> TileSet:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_ISOMETRIC
	ts.tile_layout = TileSet.TILE_LAYOUT_DIAMOND_DOWN
	ts.tile_size = Vector2i(TILE_W, TILE_H)
	# One source per WorldGen.Tile enum value (0-10)
	ts.add_source(_make_source_asphalt(),    0)   # GRASS -> ASPHALT
	ts.add_source(_make_source_asphalt_dark(), 1) # GRASS_DARK -> CRACKED_ASPHALT
	ts.add_source(_make_source_concrete(),   2)   # MOSS -> CONCRETE_MOSS
	ts.add_source(_make_source_dirt(),       3)   # DIRT
	ts.add_source(_make_source_road(),       4)   # ROAD
	ts.add_source(_make_source_road_edge(),  5)   # ROAD_EDGE / yellow line
	ts.add_source(_make_source_sidewalk(),   6)   # SIDEWALK
	ts.add_source(_make_source_floor_tile(), 7)   # FLOOR_WOOD -> FLOOR_CONCRETE
	ts.add_source(_make_source_floor_tile2(),8)   # FLOOR_TILE
	ts.add_source(_make_source_water(),      9)   # WATER / flooded
	ts.add_source(_make_source_rubble(),    10)   # GRAVE -> RUBBLE
	return ts

func _wrap(src: TileSetAtlasSource) -> TileSetAtlasSource:
	src.texture_region_size = Vector2i(TILE_W, TILE_H)
	src.create_tile(Vector2i(0, 0))
	return src

# ── helpers ───────────────────────────────────────────────────────────────────

func _diamond_img(draw_fn: Callable) -> ImageTexture:
	var img := Image.create(TILE_W, TILE_H, false, Image.FORMAT_RGBA8)
	var hw: float = TILE_W * 0.5
	var hh: float = TILE_H * 0.5
	for y in TILE_H:
		for x in TILE_W:
			var nx: float = absf(x - hw) / hw
			var ny: float = absf(y - hh) / hh
			if nx + ny < 1.0:
				var edge: float = clampf((1.0 - nx - ny) / 0.15, 0.0, 1.0)
				var is_right: bool = x >= hw
				var c: Color = draw_fn.call(x, y, nx, ny, edge, is_right)
				img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)

func _noise(x: int, y: int, scale: float = 0.04) -> float:
	var v := sin(x * 127.1 * scale + y * 311.7 * scale) * 43758.5453
	return v - floor(v)

func _crack(x: int, y: int, freq: float) -> float:
	var n := _noise(x * 3, y * 3, freq * 0.03)
	return 1.0 if n < 0.04 else 0.0

# ── tile generators ───────────────────────────────────────────────────────────

func _make_source_asphalt() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x, y, 0.05) * 0.06
		var base := 0.20 + n
		var shade := 0.025 if right else -0.025
		return Color(base + shade, base + shade, base + shade - 0.01))
	return _wrap(src)

func _make_source_asphalt_dark() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x * 2, y, 0.04) * 0.05
		var crack := _crack(x, y, 0.5)
		var base := 0.14 + n - crack * 0.08
		var shade := 0.02 if right else -0.02
		return Color(base + shade, base + shade, base + shade - 0.01))
	return _wrap(src)

func _make_source_concrete() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x, y * 2, 0.03) * 0.07
		var moss := 1.0 if _noise(x + 77, y + 33, 0.08) < 0.35 else 0.0
		var base := Color(0.42 + n, 0.42 + n, 0.40 + n)
		if moss > 0.0:
			base = Color(0.28, 0.38, 0.24)
		var shade: float = 0.03 if right else -0.03
		base.r += shade; base.g += shade; base.b += shade
		return base)
	return _wrap(src)

func _make_source_dirt() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x, y, 0.06) * 0.10
		var base := 0.32 + n
		var shade: float = 0.04 if right else -0.04
		return Color(base + shade, base * 0.82 + shade, base * 0.60 + shade))
	return _wrap(src)

func _make_source_road() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x * 3, y, 0.03) * 0.04
		var base := 0.18 + n
		var shade: float = 0.03 if right else -0.03
		# Faded white center dashes pattern (iso space)
		var lx: float = (x - TILE_W * 0.5) / float(TILE_W)
		var dash: bool = absf(lx) < 0.06 and (y % 8) < 4
		if dash:
			return Color(0.85, 0.83, 0.75)
		return Color(base + shade, base + shade, base + shade - 0.01))
	return _wrap(src)

func _make_source_road_edge() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x, y, 0.04) * 0.04
		var base := 0.22 + n
		var shade: float = 0.03 if right else -0.03
		# Yellow road marking stripe
		var lx: float = (x - TILE_W * 0.5) / float(TILE_W)
		var stripe: bool = absf(lx) > 0.72 and absf(lx) < 0.90
		if stripe:
			return Color(0.80, 0.68, 0.08)
		return Color(base + shade, base + shade, base + shade - 0.01))
	return _wrap(src)

func _make_source_sidewalk() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		# Concrete slab grid
		var slab_x: bool = (x % 16) < 1
		var slab_y: bool = (y % 10) < 1
		var grout: bool = slab_x or slab_y
		var n := _noise(x, y, 0.05) * 0.06
		var base := 0.55 + n
		var shade: float = 0.04 if right else -0.04
		if grout:
			base -= 0.10
		return Color(base + shade, base + shade, base + shade - 0.02))
	return _wrap(src)

func _make_source_floor_tile() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var slab_x: bool = (x % 12) < 1
		var slab_y: bool = (y % 8) < 1
		var grout: bool = slab_x or slab_y
		var n := _noise(x, y, 0.04) * 0.05
		var base := 0.50 + n
		var shade: float = 0.03 if right else -0.03
		if grout:
			base -= 0.12
		return Color(base + shade, base + shade - 0.02, base + shade - 0.04))
	return _wrap(src)

func _make_source_floor_tile2() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var check: bool = ((x / 8 + y / 6) % 2) == 0
		var n := _noise(x, y, 0.05) * 0.04
		var base := (0.48 if check else 0.38) + n
		var shade: float = 0.03 if right else -0.03
		return Color(base + shade, base + shade - 0.01, base + shade + 0.02))
	return _wrap(src)

func _make_source_water() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x + 11, y + 7, 0.07) * 0.10
		var ripple := sin((x + y) * 0.4) * 0.04
		var base := Color(
			0.06 + n * 0.3,
			0.14 + n * 0.4 + ripple,
			0.42 + n + ripple * 0.5)
		var shade: float = 0.02 if right else -0.02
		base.r += shade; base.g += shade; base.b += shade
		return base)
	return _wrap(src)

func _make_source_rubble() -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = _diamond_img(func(x, y, nx, ny, edge, right):
		var n := _noise(x, y, 0.08) * 0.12
		var chunk: float = 1.0 if _noise(x * 5, y * 5, 0.15) < 0.3 else 0.0
		var base := 0.30 + n + chunk * 0.12
		var shade: float = 0.04 if right else -0.04
		return Color(base + shade, base + shade - 0.02, base + shade - 0.04))
	return _wrap(src)

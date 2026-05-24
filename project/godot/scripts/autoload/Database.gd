# Database.gd — Autoload singleton.
# Loads all Item / Recipe / Enemy resources from disk at startup and
# exposes lookup-by-id. Keeps the rest of the code free of file paths.
#
# Convention:
#   res://resources/items/*.tres     -> Item / WeaponItem
#   res://resources/recipes/*.tres   -> Recipe
#   res://resources/enemies/*.tres   -> EnemyData (see below)

extends Node

var items: Dictionary = {}                        # StringName -> Item
var recipes: Array[Recipe] = []
var enemy_defs: Dictionary = {}                   # StringName -> EnemyData

func _ready() -> void:
	_load_dir("res://resources/items/", func(r):
		if r is Item:
			items[r.id] = r
	)
	_load_dir("res://resources/recipes/", func(r):
		if r is Recipe:
			recipes.append(r)
	)
	_load_dir("res://resources/enemies/", func(r):
		if r is EnemyData:
			enemy_defs[r.id] = r
	)
	print("[Database] loaded %d items, %d recipes, %d enemies" % [items.size(), recipes.size(), enemy_defs.size()])

func _load_dir(path: String, handler: Callable) -> void:
	var dir := DirAccess.open(path)
	if dir == null:
		push_warning("Database: missing dir " + path)
		return
	dir.list_dir_begin()
	var f := dir.get_next()
	while f != "":
		if f.ends_with(".tres") or f.ends_with(".res"):
			var res := load(path + f)
			if res != null:
				handler.call(res)
		f = dir.get_next()

func item(id: StringName) -> Item:
	return items.get(id, null)

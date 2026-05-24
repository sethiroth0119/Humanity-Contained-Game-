# Humanity Contained — Godot 4.3+ Porting Kit

This folder contains a complete Godot port of the JS prototype's systems.

**Start here:** open `HANDOFF.html` in a browser — system map, file index,
setup steps, and scene-tree blueprint.

## Quick start

1. Launch Godot 4.3+
2. Import this folder as a project
3. Build the scenes (Player.tscn, Enemy.tscn, Main.tscn) per `SCENE_TREE.md`
4. F5 to play

The four autoloads (GameState, Inventory, Database, EventBus) register
automatically from `project.godot`.

## Folder structure

```
godot/
├── project.godot                  Engine config + input map + autoloads
├── HANDOFF.html                   Full porting guide (read this)
├── SCENE_TREE.md                  Main scene blueprint
├── README.md                      This file
├── scripts/
│   ├── IsoMath.gd                 Iso math helpers (static)
│   ├── Item.gd                    Resource: base item
│   ├── WeaponItem.gd              Resource: weapon (extends Item)
│   ├── Recipe.gd                  Resource: crafting recipe
│   ├── EnemyData.gd               Resource: enemy archetype
│   ├── Player.gd                  CharacterBody2D
│   ├── Enemy.gd                   CharacterBody2D (delegates AI to module)
│   ├── Prop.gd                    StaticBody2D base
│   ├── Container.gd               Lootable prop
│   ├── WorldGen.gd                Procedural world builder
│   ├── HUD.gd                     CanvasLayer
│   ├── DayNight.gd                CanvasModulate
│   ├── AI/
│   │   ├── SkeletonAI.gd
│   │   ├── WraithAI.gd
│   │   └── GhoulAI.gd
│   └── autoload/
│       ├── EventBus.gd            Signal hub
│       ├── GameState.gd           Time of day
│       ├── Inventory.gd           Pack + equipment + hotbar
│       └── Database.gd            Resource loader
└── resources/
    ├── items/
    │   ├── rusted_sword.tres
    │   ├── silver_dagger.tres
    │   ├── oak_staff.tres
    │   ├── service_pistol.tres
    │   ├── med_bandage.tres
    │   └── rag.tres
    ├── enemies/
    │   ├── skeleton.tres
    │   ├── wraith.tres
    │   └── ghoul.tres
    └── recipes/
        └── bandage.tres
```

## Cross-reference

The JS prototype lives one folder up (`../Humanity Contained.html`).
Open it side-by-side to see what each Godot script reproduces.

| Prototype file | Godot port |
|---|---|
| `iso.js`     | `scripts/IsoMath.gd` + TileMapLayer iso mode |
| `entities.js` | `scripts/Player.gd` + `scripts/Enemy.gd` + AI modules |
| `items.js`   | `scripts/Item.gd` + `Inventory.gd` autoload + `.tres` files |
| `ui.js`      | `scripts/HUD.gd` + scenes/ui/*.tscn |
| `game.js`    | `Main.gd` (you author this) + `GameState.gd` autoload |
| `render.js`  | Godot's y_sort_enabled + z_index per node |

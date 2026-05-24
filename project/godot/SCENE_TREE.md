# Main.tscn — Scene tree blueprint
#
# Build this in the Godot editor. The script paths and node names match
# the @onready references in HUD.gd / WorldGen.gd / Player.gd.
#
# (You can also auto-generate this once via a tool script — but it's cleaner
#  to build in the editor so .tscn UIDs are properly assigned.)

Main (Node2D)                          # script: optional Main.gd for hotbar/UI input
├── World (Node2D)
│   ├── Ground (TileMapLayer)          # iso mode, 64×32 tile size
│   │   └── TileSet                    # 11 source atlases matching enum Tile in WorldGen.gd
│   ├── Structures (Node2D)            # houses get instanced here
│   ├── Props (Node2D)                 # trees / cars / barrels / crates / chest
│   ├── Drops (Node2D)                 # ground-drop pickups
│   └── Enemies (Node2D)               # spawned skeletons / wraiths / ghouls
├── WorldGen (Node2D)                  # script: WorldGen.gd
│                                      # @export refs point at the nodes above + .tres
│                                      # add_to_group("world_gen")
├── Player (CharacterBody2D)           # scene instance: Player.tscn
│   ├── Sprite (AnimatedSprite2D)      # 8-direction silhouette
│   ├── WeaponSprite (Sprite2D)
│   ├── Collision (CollisionShape2D)   # capsule
│   ├── AimIndicator (Node2D)
│   │   └── Line2D                     # subtle facing line
│   └── Camera (Camera2D)              # current=true, drag margins enabled
├── CanvasModulate                     # script: DayNight.gd
└── HUD (CanvasLayer)                  # script: HUD.gd
    ├── StatsTL (VBoxContainer)        # top-left, anchored
    │   ├── HP (HBoxContainer)
    │   │   ├── Label "VITAE"
    │   │   ├── Bar (PanelContainer)
    │   │   │   └── Fill (ColorRect, anchor_right driven by HUD.gd)
    │   │   └── Value (Label)
    │   ├── Stam (... same shape)
    │   ├── Mana (visibility toggled)
    │   ├── Hunger (visibility toggled)
    │   └── Thirst (visibility toggled)
    ├── Clock (VBoxContainer)          # top-right
    │   ├── Time (Label)
    │   ├── Day  (Label)
    │   └── Phase (Label)
    ├── Minimap (TextureRect or SubViewportContainer)
    ├── Hotbar (HBoxContainer)         # bottom-center
    │   ├── Slot1 (PanelContainer)
    │   │   ├── Key (Label "1")
    │   │   ├── ItemName (Label)
    │   │   └── Qty (Label)
    │   └── Slot2..Slot5
    ├── Prompt (Label)                 # "Open chest · [E]"
    ├── Log    (RichTextLabel)         # bottom-left, BBCode enabled
    ├── HurtFlash (ColorRect)          # full-screen, fade in/out on hurt
    ├── Cursor (Control)               # custom crosshair
    └── Panels (Control)               # inventory / loot / crafting overlays
        ├── InventoryPanel.tscn
        ├── LootPanel.tscn
        └── CraftingPanel.tscn

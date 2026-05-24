# HUD.gd — Top-level HUD CanvasLayer script. Refreshes bars on signals.
# Attach to a CanvasLayer in Main.tscn (or its own HUD.tscn).
#
# Expected children (all paths relative to this CanvasLayer):
#   StatsTL/HP/Fill         (ColorRect with anchor_right driven)
#   StatsTL/Stam/Fill
#   StatsTL/Hunger/Fill     (visibility toggled)
#   StatsTL/Thirst/Fill
#   StatsTL/Mana/Fill
#   Clock/Time              (Label)
#   Clock/Day               (Label)
#   Clock/Phase             (Label)
#   Hotbar/Slot1..Slot5     (each has /Name, /Qty Labels and a /Frame)
#   Log                     (RichTextLabel or VBoxContainer)
#   Prompt                  (Label)
#   Minimap                 (SubViewport or TextureRect rendering minimap)

extends CanvasLayer

@onready var hp_bar:      ProgressBar = $StatsTL/HP/Fill
@onready var stam_bar:    ProgressBar = $StatsTL/Stam/Fill
@onready var hunger_row:  Control = $StatsTL/Hunger
@onready var thirst_row:  Control = $StatsTL/Thirst
@onready var mana_row:    Control = $StatsTL/Mana
@onready var hunger_bar:  ProgressBar = $StatsTL/Hunger/Fill
@onready var thirst_bar:  ProgressBar = $StatsTL/Thirst/Fill
@onready var mana_bar:    ProgressBar = $StatsTL/Mana/Fill

@onready var time_label:  Label = $Clock/Time
@onready var day_label:   Label = $Clock/Day
@onready var phase_label: Label = $Clock/Phase

@onready var prompt:      Label = $Prompt
@onready var log_box:     RichTextLabel = $Log

var player: Player

func _ready() -> void:
	player = get_tree().get_first_node_in_group("player") as Player
	EventBus.stats_changed.connect(_refresh_stats)
	EventBus.time_changed.connect(_refresh_clock)
	EventBus.log_message.connect(_append_log)
	EventBus.prompt_show.connect(_show_prompt)
	EventBus.prompt_hide.connect(_hide_prompt)
	EventBus.player_hurt.connect(_on_hurt)

func _refresh_stats() -> void:
	if player == null: return
	_set_bar(hp_bar,   player.hp / player.max_hp)
	_set_bar(stam_bar, player.stamina / player.max_stamina)
	hunger_row.visible = player.hunger < 70.0
	thirst_row.visible = player.thirst < 70.0
	mana_row.visible = player.mana < player.max_mana - 0.5 \
		or (Inventory.equipped_weapon() != null and Inventory.equipped_weapon().ammo_id == &"mana")
	_set_bar(hunger_bar, player.hunger / player.max_hunger)
	_set_bar(thirst_bar, player.thirst / player.max_thirst)
	_set_bar(mana_bar,   player.mana   / player.max_mana)

func _set_bar(node: ProgressBar, pct: float) -> void:
	node.value = clampf(pct, 0.0, 1.0) * 100.0

func _refresh_clock(_minutes: float) -> void:
	var h: int = int(GameState.hour())
	var m: int = int(fposmod(GameState.minutes, 60.0))
	time_label.text = "%02d:%02d" % [h, m]
	day_label.text = "DAY %d" % GameState.day()
	phase_label.text = String(GameState.phase()).to_upper().replace("_", " ")

func _append_log(text: String, severity: StringName) -> void:
	var col: String = {
		&"warn": "[color=#dd5544]",
		&"good": "[color=#88dd99]",
		&"dim":  "[color=#7a7a7a][i]",
		&"info": "[color=#dddddd]"
	}.get(severity, "[color=#cccccc]")
	log_box.append_text(col + text + "[/color][/i]\n")

func _show_prompt(text: String) -> void:
	prompt.text = text
	prompt.visible = true

func _hide_prompt() -> void:
	prompt.visible = false

func _on_hurt(_amount: float, _src: Node) -> void:
	# Trigger a hurt-flash shader on the screen. Cheap version:
	$HurtFlash.modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property($HurtFlash, "modulate:a", 0.8, 0.05)
	tween.tween_property($HurtFlash, "modulate:a", 0.0, 0.35)

# HUD.gd — Complete HUD: stat bars, clock, log, hotbar, inventory, loot, crafting, death screen.
extends CanvasLayer

# ── Existing stat/clock nodes ─────────────────────────────────────────────────
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

# ── Built-in panel nodes ──────────────────────────────────────────────────────
var _hotbar_slots: Array = []          # 5 Panel nodes

var _inv_bg: ColorRect
var _inv_panel: Panel
var _inv_list: VBoxContainer
var _inv_equip_labels: Dictionary = {}  # StringName → Label

var _loot_panel: Panel
var _loot_list: VBoxContainer
var _loot_source: Container = null

var _craft_panel: Panel
var _craft_list: VBoxContainer

var _death_screen: ColorRect

var _pause_bg: ColorRect

# ── Ready ─────────────────────────────────────────────────────────────────────

func _ready() -> void:
	player = get_tree().get_first_node_in_group("player") as Player

	EventBus.stats_changed.connect(_refresh_stats)
	EventBus.time_changed.connect(_refresh_clock)
	EventBus.log_message.connect(_append_log)
	EventBus.prompt_show.connect(_show_prompt)
	EventBus.prompt_hide.connect(_hide_prompt)
	EventBus.player_hurt.connect(_on_hurt)
	EventBus.player_healed.connect(_on_healed)
	EventBus.inventory_changed.connect(_refresh_hotbar)
	EventBus.inventory_changed.connect(func():
		if _inv_panel != null and _inv_panel.visible:
			_refresh_inventory_list()
	)
	EventBus.container_opened.connect(_on_container_opened)
	EventBus.player_died.connect(_on_player_died)

	_build_hotbar()
	_build_inventory_panel()
	_build_loot_panel()
	_build_crafting_panel()
	_build_death_screen()
	_build_pause_screen()

# ── Input ─────────────────────────────────────────────────────────────────────

func _input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	if event.is_action("inventory"):
		_toggle_inventory()
		get_viewport().set_input_as_handled()
	elif event.is_action("crafting"):
		_toggle_crafting()
		get_viewport().set_input_as_handled()
	elif event.is_action("ui_cancel"):
		_handle_escape()
		get_viewport().set_input_as_handled()

func _handle_escape() -> void:
	if _loot_panel != null and _loot_panel.visible:
		_close_loot(); return
	if _inv_panel != null and _inv_panel.visible:
		_close_inventory(); return
	if _craft_panel != null and _craft_panel.visible:
		_close_crafting(); return
	if _pause_bg != null and _pause_bg.visible:
		_close_pause(); return
	_open_pause()

# ── Existing stat / clock helpers ─────────────────────────────────────────────

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
	$HurtFlash.modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property($HurtFlash, "modulate:a", 0.8, 0.05)
	tween.tween_property($HurtFlash, "modulate:a", 0.0, 0.35)

func _on_healed(amount: float) -> void:
	_append_log("+%d HP" % int(amount), &"good")

# ── Style helper ──────────────────────────────────────────────────────────────

func _panel_style(bg: Color = Color(0.07, 0.07, 0.09, 0.96)) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = Color(0.30, 0.25, 0.18, 0.85)
	s.set_border_width_all(1)
	s.set_corner_radius_all(3)
	s.content_margin_left = 8; s.content_margin_right = 8
	s.content_margin_top = 6;  s.content_margin_bottom = 6
	return s

func _title_label(text: String, parent: Control, x: float, y: float) -> Label:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_color_override("font_color", Color(0.88, 0.68, 0.28))
	lbl.add_theme_font_size_override("font_size", 13)
	lbl.position = Vector2(x, y)
	parent.add_child(lbl)
	return lbl

func _close_btn(parent: Control, callback: Callable) -> Button:
	var btn := Button.new()
	btn.text = "✕"
	btn.anchor_left = 1.0; btn.anchor_right = 1.0
	btn.anchor_top = 0.0;  btn.anchor_bottom = 0.0
	btn.offset_left = -30.0; btn.offset_right = -4.0
	btn.offset_top = 4.0;    btn.offset_bottom = 26.0
	btn.add_theme_stylebox_override("normal", _panel_style(Color(0.25, 0.08, 0.06, 0.9)))
	btn.pressed.connect(callback)
	parent.add_child(btn)
	return btn

# ── HOTBAR ────────────────────────────────────────────────────────────────────

func _build_hotbar() -> void:
	var hbox := HBoxContainer.new()
	hbox.anchor_left = 0.5; hbox.anchor_right = 0.5
	hbox.anchor_top = 1.0;  hbox.anchor_bottom = 1.0
	hbox.offset_left = -135.0; hbox.offset_right = 135.0
	hbox.offset_top  = -62.0;  hbox.offset_bottom = -8.0
	hbox.add_theme_constant_override("separation", 4)
	add_child(hbox)

	for i in 5:
		var slot := Panel.new()
		slot.custom_minimum_size = Vector2(50, 50)
		slot.add_theme_stylebox_override("panel", _panel_style(Color(0.10, 0.09, 0.07, 0.92)))

		var key_l := Label.new()
		key_l.text = str(i + 1)
		key_l.add_theme_font_size_override("font_size", 9)
		key_l.add_theme_color_override("font_color", Color(0.48, 0.44, 0.36))
		key_l.position = Vector2(2, 1)
		slot.add_child(key_l)

		var name_l := Label.new()
		name_l.name = "ItemName"
		name_l.add_theme_font_size_override("font_size", 9)
		name_l.add_theme_color_override("font_color", Color(0.88, 0.83, 0.72))
		name_l.position = Vector2(2, 15); name_l.size = Vector2(46, 20)
		name_l.clip_text = true; name_l.text = ""
		slot.add_child(name_l)

		var qty_l := Label.new()
		qty_l.name = "Qty"
		qty_l.add_theme_font_size_override("font_size", 10)
		qty_l.add_theme_color_override("font_color", Color(0.58, 0.72, 0.48))
		qty_l.position = Vector2(2, 34); qty_l.text = ""
		slot.add_child(qty_l)

		hbox.add_child(slot)
		_hotbar_slots.append(slot)
	_refresh_hotbar()

func _refresh_hotbar() -> void:
	for i in 5:
		if i >= _hotbar_slots.size(): break
		var slot: Panel = _hotbar_slots[i]
		var name_l: Label = slot.get_node("ItemName")
		var qty_l:  Label = slot.get_node("Qty")
		var ref = Inventory.hotbar[i]
		if ref == null:
			name_l.text = ""; qty_l.text = ""
		elif ref == -1:
			var w := Inventory.equipped_weapon()
			name_l.text = w.display_name if w != null else ""
			qty_l.text = ""
		else:
			var s = Inventory.slots[ref] if ref < Inventory.MAX_SLOTS else null
			if s != null:
				name_l.text = s.item.display_name
				qty_l.text = "x%d" % s.qty if s.qty > 1 else ""
			else:
				name_l.text = ""; qty_l.text = ""
		# Highlight active weapon slot
		var is_weapon_slot: bool = (ref == -1 and Inventory.equipped_weapon() != null)
		var bg: Color = Color(0.18, 0.15, 0.08, 0.95) if is_weapon_slot else Color(0.10, 0.09, 0.07, 0.92)
		slot.add_theme_stylebox_override("panel", _panel_style(bg))

# ── INVENTORY PANEL ───────────────────────────────────────────────────────────

func _build_inventory_panel() -> void:
	_inv_bg = ColorRect.new()
	_inv_bg.color = Color(0, 0, 0, 0.55)
	_inv_bg.anchor_right = 1.0; _inv_bg.anchor_bottom = 1.0
	_inv_bg.visible = false
	_inv_bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_inv_bg)

	_inv_panel = Panel.new()
	_inv_panel.visible = false
	_inv_panel.anchor_left = 0.5; _inv_panel.anchor_right = 0.5
	_inv_panel.anchor_top = 0.5;  _inv_panel.anchor_bottom = 0.5
	_inv_panel.offset_left = -310.0; _inv_panel.offset_right = 310.0
	_inv_panel.offset_top = -215.0;  _inv_panel.offset_bottom = 215.0
	_inv_panel.add_theme_stylebox_override("panel", _panel_style())
	_inv_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_inv_panel)

	_title_label("INVENTORY", _inv_panel, 10, 8)
	_close_btn(_inv_panel, _close_inventory)

	# Equipment strip
	var eq_row := HBoxContainer.new()
	eq_row.position = Vector2(10, 34)
	eq_row.add_theme_constant_override("separation", 8)
	_inv_panel.add_child(eq_row)

	for sk in [&"weapon", &"armor", &"shield", &"accessory"]:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 2)
		eq_row.add_child(col)

		var key_l := Label.new()
		key_l.text = (sk as String).to_upper()
		key_l.add_theme_font_size_override("font_size", 9)
		key_l.add_theme_color_override("font_color", Color(0.55, 0.50, 0.40))
		col.add_child(key_l)

		var eq_lbl := Label.new()
		eq_lbl.name = "EqLabel_" + sk
		eq_lbl.text = "—"
		eq_lbl.custom_minimum_size = Vector2(138, 28)
		eq_lbl.add_theme_font_size_override("font_size", 10)
		eq_lbl.add_theme_color_override("font_color", Color(0.82, 0.76, 0.58))
		col.add_child(eq_lbl)
		_inv_equip_labels[sk] = eq_lbl

		var unequip_btn := Button.new()
		unequip_btn.text = "Unequip"
		unequip_btn.add_theme_font_size_override("font_size", 9)
		var capture_sk: StringName = sk
		unequip_btn.pressed.connect(func():
			Inventory.unequip(capture_sk)
			_refresh_inventory_list()
		)
		col.add_child(unequip_btn)

	# Scroll + item list
	var sep := HSeparator.new()
	sep.position = Vector2(10, 116)
	sep.size = Vector2(598, 2)
	_inv_panel.add_child(sep)

	var scroll := ScrollContainer.new()
	scroll.position = Vector2(10, 122)
	scroll.size = Vector2(598, 258)
	_inv_panel.add_child(scroll)

	_inv_list = VBoxContainer.new()
	_inv_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_inv_list.add_theme_constant_override("separation", 3)
	scroll.add_child(_inv_list)

	# Hint
	var hint := Label.new()
	hint.text = "[TAB] Close"
	hint.anchor_left = 0.0; hint.anchor_right = 0.0
	hint.anchor_top = 1.0;  hint.anchor_bottom = 1.0
	hint.offset_left = 10;  hint.offset_top = -24
	hint.add_theme_font_size_override("font_size", 9)
	hint.add_theme_color_override("font_color", Color(0.45, 0.42, 0.36))
	_inv_panel.add_child(hint)

func _toggle_inventory() -> void:
	if _inv_panel.visible:
		_close_inventory()
	else:
		_close_crafting(); _close_loot()
		_open_inventory()

func _open_inventory() -> void:
	_inv_panel.visible = true
	_inv_bg.visible = true
	GameState.paused = true
	_refresh_inventory_list()

func _close_inventory() -> void:
	_inv_panel.visible = false
	_inv_bg.visible = false
	if not _craft_panel.visible and not _loot_panel.visible:
		GameState.paused = false

func _refresh_inventory_list() -> void:
	for c in _inv_list.get_children():
		c.queue_free()

	# Update equipment labels
	for sk in _inv_equip_labels:
		var lbl: Label = _inv_equip_labels[sk]
		var eq = Inventory.equipment[sk]
		lbl.text = eq.item.display_name if eq != null else "—"

	# Item rows
	var found := false
	for i in Inventory.MAX_SLOTS:
		var s = Inventory.slots[i]
		if s == null: continue
		found = true

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		_inv_list.add_child(row)

		var name_l := Label.new()
		name_l.text = s.item.display_name + (" x%d" % s.qty if s.qty > 1 else "")
		name_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_l.add_theme_font_size_override("font_size", 11)
		name_l.add_theme_color_override("font_color", Color(0.85, 0.80, 0.68))
		row.add_child(name_l)

		var kind_l := Label.new()
		kind_l.text = Item.Kind.keys()[s.item.kind]
		kind_l.add_theme_font_size_override("font_size", 9)
		kind_l.add_theme_color_override("font_color", Color(0.50, 0.48, 0.40))
		kind_l.custom_minimum_size = Vector2(70, 0)
		row.add_child(kind_l)

		match s.item.kind:
			Item.Kind.WEAPON, Item.Kind.ARMOR, Item.Kind.SHIELD, Item.Kind.ACCESSORY:
				var btn := Button.new()
				btn.text = "Equip"
				btn.custom_minimum_size = Vector2(58, 22)
				btn.add_theme_font_size_override("font_size", 10)
				var idx: int = i
				btn.pressed.connect(func():
					Inventory.equip(idx)
					_refresh_inventory_list()
					_refresh_hotbar()
				)
				row.add_child(btn)
			Item.Kind.CONSUMABLE:
				var btn := Button.new()
				btn.text = "Use"
				btn.custom_minimum_size = Vector2(58, 22)
				btn.add_theme_font_size_override("font_size", 10)
				var idx: int = i
				btn.pressed.connect(func():
					if player != null:
						player.use_item(idx)
					_refresh_inventory_list()
				)
				row.add_child(btn)
			_:
				var spacer := Control.new()
				spacer.custom_minimum_size = Vector2(58, 22)
				row.add_child(spacer)

		# Assign to hotbar
		var hot_btn := Button.new()
		hot_btn.text = "→Hbr"
		hot_btn.custom_minimum_size = Vector2(48, 22)
		hot_btn.add_theme_font_size_override("font_size", 9)
		var idx2: int = i
		hot_btn.pressed.connect(func():
			# Assign to first empty hotbar slot
			for h in 5:
				if Inventory.hotbar[h] == null:
					Inventory.set_hotbar(h, idx2)
					_refresh_hotbar()
					break
		)
		row.add_child(hot_btn)

	if not found:
		var empty_l := Label.new()
		empty_l.text = "Inventory is empty."
		empty_l.add_theme_color_override("font_color", Color(0.50, 0.48, 0.40))
		_inv_list.add_child(empty_l)

# ── LOOT PANEL ────────────────────────────────────────────────────────────────

func _build_loot_panel() -> void:
	_loot_panel = Panel.new()
	_loot_panel.visible = false
	_loot_panel.anchor_left = 1.0; _loot_panel.anchor_right = 1.0
	_loot_panel.anchor_top = 0.5;  _loot_panel.anchor_bottom = 0.5
	_loot_panel.offset_left = -280.0; _loot_panel.offset_right = -12.0
	_loot_panel.offset_top = -160.0;  _loot_panel.offset_bottom = 160.0
	_loot_panel.add_theme_stylebox_override("panel", _panel_style())
	_loot_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_loot_panel)

	_title_label("LOOT", _loot_panel, 10, 8)
	_close_btn(_loot_panel, _close_loot)

	var scroll := ScrollContainer.new()
	scroll.position = Vector2(10, 38)
	scroll.size = Vector2(246, 240)
	_loot_panel.add_child(scroll)

	_loot_list = VBoxContainer.new()
	_loot_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_loot_list.add_theme_constant_override("separation", 4)
	scroll.add_child(_loot_list)

	var take_all := Button.new()
	take_all.text = "Take All"
	take_all.anchor_top = 1.0; take_all.anchor_bottom = 1.0
	take_all.anchor_left = 0.0; take_all.anchor_right = 1.0
	take_all.offset_top = -30.0; take_all.offset_bottom = -4.0
	take_all.offset_left = 10.0; take_all.offset_right = -10.0
	take_all.pressed.connect(_loot_take_all)
	_loot_panel.add_child(take_all)

func _on_container_opened(container: Container) -> void:
	_loot_source = container
	_close_inventory(); _close_crafting()
	_loot_panel.visible = true
	GameState.paused = true
	_refresh_loot_list()

func _close_loot() -> void:
	_loot_panel.visible = false
	_loot_source = null
	if not _inv_panel.visible and not _craft_panel.visible:
		GameState.paused = false

func _refresh_loot_list() -> void:
	for c in _loot_list.get_children():
		c.queue_free()
	if _loot_source == null or _loot_source.loot.size() == 0:
		var empty_l := Label.new()
		empty_l.text = "Empty."
		empty_l.add_theme_color_override("font_color", Color(0.50, 0.48, 0.40))
		_loot_list.add_child(empty_l)
		return
	for i in _loot_source.loot.size():
		var row := HBoxContainer.new()
		_loot_list.add_child(row)
		var name_l := Label.new()
		name_l.text = _loot_source.loot[i].display_name + " x%d" % _loot_source.loot_qty[i]
		name_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_l.add_theme_font_size_override("font_size", 11)
		row.add_child(name_l)
		var btn := Button.new()
		btn.text = "Take"
		btn.custom_minimum_size = Vector2(52, 22)
		btn.add_theme_font_size_override("font_size", 10)
		var idx: int = i
		btn.pressed.connect(func():
			if _loot_source == null or not is_instance_valid(_loot_source): return
			var taken := _loot_source.take(idx)
			if not taken.is_empty():
				Inventory.add(taken.item, taken.qty)
				EventBus.emit_signal("log_message", "Picked up %s." % taken.item.display_name, &"good")
			_refresh_loot_list()
		)
		row.add_child(btn)

func _loot_take_all() -> void:
	if _loot_source == null or not is_instance_valid(_loot_source): return
	while _loot_source.loot.size() > 0:
		var taken := _loot_source.take(0)
		if taken.is_empty(): break
		Inventory.add(taken.item, taken.qty)
		EventBus.emit_signal("log_message", "Picked up %s." % taken.item.display_name, &"good")
	_refresh_loot_list()

# ── CRAFTING PANEL ────────────────────────────────────────────────────────────

func _build_crafting_panel() -> void:
	var craft_bg := ColorRect.new()
	craft_bg.name = "CraftBG"
	craft_bg.color = Color(0, 0, 0, 0.55)
	craft_bg.anchor_right = 1.0; craft_bg.anchor_bottom = 1.0
	craft_bg.visible = false
	craft_bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(craft_bg)

	_craft_panel = Panel.new()
	_craft_panel.visible = false
	_craft_panel.anchor_left = 0.5; _craft_panel.anchor_right = 0.5
	_craft_panel.anchor_top = 0.5;  _craft_panel.anchor_bottom = 0.5
	_craft_panel.offset_left = -255.0; _craft_panel.offset_right = 255.0
	_craft_panel.offset_top = -195.0;  _craft_panel.offset_bottom = 195.0
	_craft_panel.add_theme_stylebox_override("panel", _panel_style())
	_craft_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_craft_panel)

	_title_label("CRAFTING", _craft_panel, 10, 8)
	_close_btn(_craft_panel, _close_crafting)

	var scroll := ScrollContainer.new()
	scroll.position = Vector2(10, 38)
	scroll.size = Vector2(490, 340)
	_craft_panel.add_child(scroll)

	_craft_list = VBoxContainer.new()
	_craft_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_craft_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_craft_list)

	var hint := Label.new()
	hint.text = "[C] Close"
	hint.anchor_top = 1.0; hint.anchor_bottom = 1.0
	hint.offset_left = 10;  hint.offset_top = -24
	hint.add_theme_font_size_override("font_size", 9)
	hint.add_theme_color_override("font_color", Color(0.45, 0.42, 0.36))
	_craft_panel.add_child(hint)

func _toggle_crafting() -> void:
	if _craft_panel.visible:
		_close_crafting()
	else:
		_close_inventory(); _close_loot()
		_open_crafting()

func _open_crafting() -> void:
	get_node("CraftBG").visible = true
	_craft_panel.visible = true
	GameState.paused = true
	_refresh_crafting_list()

func _close_crafting() -> void:
	get_node("CraftBG").visible = false
	_craft_panel.visible = false
	if not _inv_panel.visible and not _loot_panel.visible:
		GameState.paused = false

func _refresh_crafting_list() -> void:
	for c in _craft_list.get_children():
		c.queue_free()
	if Database.recipes.is_empty():
		var lbl := Label.new()
		lbl.text = "No recipes available."
		lbl.add_theme_color_override("font_color", Color(0.5, 0.48, 0.40))
		_craft_list.add_child(lbl)
		return
	for recipe in Database.recipes:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		_craft_list.add_child(row)

		var info_col := VBoxContainer.new()
		info_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info_col)

		var out_l := Label.new()
		out_l.text = "%s x%d" % [recipe.output_item.display_name, recipe.output_qty]
		out_l.add_theme_font_size_override("font_size", 12)
		out_l.add_theme_color_override("font_color", Color(0.90, 0.82, 0.60))
		info_col.add_child(out_l)

		var req_parts: Array[String] = []
		for j in recipe.input_items.size():
			var have: int = Inventory.count(recipe.input_items[j].id)
			var need: int = recipe.input_qty[j]
			req_parts.append("%s %d/%d" % [recipe.input_items[j].display_name, have, need])
		var req_l := Label.new()
		req_l.text = "Needs: " + ", ".join(req_parts)
		req_l.add_theme_font_size_override("font_size", 9)
		req_l.add_theme_color_override("font_color", Color(0.58, 0.55, 0.48))
		info_col.add_child(req_l)

		var can: bool = recipe.can_craft()
		var craft_btn := Button.new()
		craft_btn.text = "Craft"
		craft_btn.disabled = not can
		craft_btn.custom_minimum_size = Vector2(58, 36)
		var r := recipe
		craft_btn.pressed.connect(func():
			if r.craft():
				EventBus.emit_signal("log_message", "Crafted %s." % r.output_item.display_name, &"good")
				_refresh_crafting_list()
		)
		row.add_child(craft_btn)

# ── DEATH SCREEN ──────────────────────────────────────────────────────────────

func _build_death_screen() -> void:
	_death_screen = ColorRect.new()
	_death_screen.color = Color(0.05, 0.0, 0.0, 0.0)
	_death_screen.anchor_right = 1.0; _death_screen.anchor_bottom = 1.0
	_death_screen.visible = false
	_death_screen.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_death_screen)

	var vbox := VBoxContainer.new()
	vbox.anchor_left = 0.5; vbox.anchor_right = 0.5
	vbox.anchor_top = 0.5;  vbox.anchor_bottom = 0.5
	vbox.offset_left = -120.0; vbox.offset_right = 120.0
	vbox.offset_top = -60.0;   vbox.offset_bottom = 60.0
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 16)
	_death_screen.add_child(vbox)

	var title := Label.new()
	title.text = "YOU DIED"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", Color(0.85, 0.12, 0.08))
	title.add_theme_font_size_override("font_size", 36)
	vbox.add_child(title)

	var respawn_btn := Button.new()
	respawn_btn.text = "Respawn"
	respawn_btn.custom_minimum_size = Vector2(140, 40)
	respawn_btn.pressed.connect(func():
		get_tree().reload_current_scene()
	)
	vbox.add_child(respawn_btn)

func _on_player_died() -> void:
	_death_screen.visible = true
	GameState.paused = true
	var tw := create_tween()
	tw.tween_property(_death_screen, "color:a", 0.85, 1.5)

# ── PAUSE SCREEN ──────────────────────────────────────────────────────────────

func _build_pause_screen() -> void:
	_pause_bg = ColorRect.new()
	_pause_bg.name = "PauseBG"
	_pause_bg.color = Color(0, 0, 0, 0.0)
	_pause_bg.anchor_right = 1.0; _pause_bg.anchor_bottom = 1.0
	_pause_bg.visible = false
	_pause_bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_pause_bg)

	var vbox := VBoxContainer.new()
	vbox.anchor_left = 0.5; vbox.anchor_right = 0.5
	vbox.anchor_top = 0.5;  vbox.anchor_bottom = 0.5
	vbox.offset_left = -90.0; vbox.offset_right = 90.0
	vbox.offset_top = -60.0;  vbox.offset_bottom = 60.0
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 12)
	_pause_bg.add_child(vbox)

	var title := Label.new()
	title.text = "PAUSED"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", Color(0.88, 0.82, 0.60))
	title.add_theme_font_size_override("font_size", 22)
	vbox.add_child(title)

	var resume_btn := Button.new()
	resume_btn.text = "Resume"
	resume_btn.custom_minimum_size = Vector2(140, 36)
	resume_btn.pressed.connect(_close_pause)
	vbox.add_child(resume_btn)

func _open_pause() -> void:
	_pause_bg.visible = true
	GameState.paused = true
	var tw := create_tween()
	tw.tween_property(_pause_bg, "color:a", 0.65, 0.25)

func _close_pause() -> void:
	var tw := create_tween()
	tw.tween_property(_pause_bg, "color:a", 0.0, 0.2)
	tw.tween_callback(func(): _pause_bg.visible = false)
	GameState.paused = false

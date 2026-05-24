# GameState.gd — Autoload singleton. World time + day count + global flags.
# The day/night system advances `minutes` and emits time_changed every frame.

extends Node

@export var minutes_per_real_second: float = 6.0  # 4 min IRL = full 24h
const MINUTES_PER_DAY: int = 24 * 60

var minutes: float = 17.0 * 60.0                  # start at dusk, day 1
var paused: bool = false
var illuminate_until_ms: int = 0                  # scroll-of-light effect

func _process(delta: float) -> void:
	if paused:
		return
	minutes += minutes_per_real_second * delta
	EventBus.emit_signal("time_changed", minutes)
	var p := phase()
	if p != _last_phase:
		_last_phase = p
		EventBus.emit_signal("phase_changed", p)

var _last_phase: StringName = &""

func day() -> int:
	return int(minutes) / MINUTES_PER_DAY + 1

func hour() -> float:
	return fposmod(minutes, MINUTES_PER_DAY) / 60.0

func phase() -> StringName:
	var h: float = hour()
	if h < 5.0: return &"dead_of_night"
	if h < 7.0: return &"dawn"
	if h < 17.0: return &"day"
	if h < 19.0: return &"dusk"
	if h < 22.0: return &"night"
	return &"witching_hour"

# Darkness 0..1 for the night-overlay shader/CanvasModulate.
func darkness() -> float:
	var h: float = hour()
	var d: float
	if h >= 7.0 and h < 17.0: d = 0.0
	elif h >= 5.0 and h < 7.0: d = (7.0 - h) * 0.5 * 0.6
	elif h >= 17.0 and h < 19.0: d = (h - 17.0) * 0.5 * 0.75
	elif h >= 19.0 and h < 22.0: d = 0.75 + ((h - 19.0) / 3.0) * 0.2
	else: d = 0.95
	if Time.get_ticks_msec() < illuminate_until_ms:
		d *= 0.2
	return d

func illuminate_for(seconds: float) -> void:
	illuminate_until_ms = Time.get_ticks_msec() + int(seconds * 1000.0)

# Dialogue.gd — Resource describing one civilian's speech.
# Multi-line, advanced one line at a time. No branching for now —
# extend to branches by changing `lines: PackedStringArray` to an array
# of dialogue node Resources later.

class_name Dialogue
extends Resource

@export var npc_name: String = "Stranger"
@export var role: String = "wanderer"
@export var lines: PackedStringArray = PackedStringArray()

# Optional: a portrait shown alongside the text.
@export var portrait: Texture2D

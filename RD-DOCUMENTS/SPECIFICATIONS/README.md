# SPECIFICATIONS

The written half of a drawing set.

A plan says how big the hole is. The specification says who confirms it, what
product satisfies it, and what happens when the drawing and the real world
disagree. Both go out with the set; only one of them is currently in this repo.

This folder holds two kinds of thing, and the second one turns into the first:

- **Specifications** — the full written spec, by division, as it gets written.
- **Standard notes** — the notes that go on a sheet. Every one of them is a
  spec clause that has not been written out yet. When a note grows past a
  sentence, it moves into a spec section and the note points at it.

## Why the notes live here rather than in the app

A standard note is an office standard in the same way a layer name is. It says
something true about how this office draws, it is the same on every job, and it
is currently retyped from memory. Written down, it can eventually be a note
block the sheet carries automatically instead of something the drafter
remembers.

## Why notes exist at all

Most standard notes exist because **the drawing knows less than the builder
will.** A window's clear opening depends on a product nobody has bought; a
rough opening depends on that same order. The plan cannot state those as
facts, so the note moves the check to whoever holds the information at the
moment it matters. A note is not a disclaimer — it is a handoff.

That is the test for whether something belongs here: if the drawing cannot
guarantee it, the spec has to say who does.

## Code references

Clauses cited in this folder come from the codes in `BUILDING-CODES/`. Cite the
article number, not a remembered value — the values move between editions and
provincial amendments, the article numbers mostly do not.

## Contents

- `notes-windows-and-doors.md` — window and door standard notes.

---
title: "toeesh.network"
date: 2026-06-24
description: "This site — a personal home built as a Vignelli-style transit map."
status: "building"
repo: "https://github.com/toeesh"
---

The site you're on. A minimal personal home built with **Astro**, styled after
the NYC subway / Massimo Vignelli design language: Helvetica, a hard grid,
colored route bullets, and a homepage that's an actual transit diagram you
navigate.

## what's under the hood

- **Astro** static site — Markdown for posts, near-zero JavaScript shipped.
- A hand-drawn **SVG map** where every station is a real link. On a phone it
  folds down into a vertical line strip, the kind printed inside the train.
- A single `lines.ts` is the source of truth for every route's color, bullet,
  and blurb — the map, the nav, and the page headers all read from it.
- Light "Vignelli paper" theme by default, dark theme to match my desktop.
  No animations anywhere, on purpose.

## status

Under construction — and probably always will be. That's half the fun.

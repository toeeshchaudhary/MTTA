# MTTA — the Ministry of Toeesh Transport Association

> This isn't a résumé, it's a network — take it slow, ride a line, or jump in anywhere.

A personal site built as a **transit map of a person**. Instead of a résumé, it's a living network: each **line** is a thread of who I am, each **station** is something I made or can't stop thinking about, and little **trains** run the lines so the whole thing feels alive. Pan, zoom, ride a line, or tap any stop to read it.

🚇 **Live:** https://toeeshnetwork.vercel.app

**Authoring:** launch **MTTA Studio** (the local desktop app — `bun run studio`), edit the map, hit **Publish** — it commits + pushes and Vercel redeploys. Or from the CLI: `bun run daily <photo>` for a daily note, `bun run publish` to push pending content.

---

## What's in it

**The map**
- Hand-editable transit lines (rounded ribbons), stations, interchanges/joint stops, terrain and pinned notes/photos — all on an infinite pan/zoom canvas.
- One **train per line** that shuttles end-to-end, pausing at every stop. Three rolling-stock designs (capsule / bullet / tram) so the network feels varied. Click a moving train to **board** at the nearest stop.
- A **departures board** — amber-LED station display with a live clock, track numbers, "DUE / N min" countdowns and a split-flap flip. Click a row to jump; minimise it by clicking the header.
- **Ride-the-line tours**, fuzzy **search index** (`⌘K`), keyboard stop-to-stop navigation, and **back/forward** history (each stop is a real shareable URL).
- Per-stop **boarding-pass share card** — the Open Graph image is a transit ticket, previewable in-app.

**Playful extras** (all toggleable from the admin)
- 🐀 a subway **rat** that scurries the tracks now and then (rare pizza-rat)
- 📍 stations **pulse** when a train pulls in; a rare **express** blows through non-stop
- 📟 the board flashes witty **service messages** (editable)
- 🔊 optional subway **door chime** / MetroCard swipe sounds (off by default)
- 🦉 a Konami-code **night-owl** neon mode

Everything ambient respects `prefers-reduced-motion` and an in-app **MOTION: OFF** switch.

**The admin** (`/admin`)
- A Figma-style editor: left tool rail · map canvas · contextual inspector, with a Bauhaus identity and dark mode.
- Lay track, place/paint stops, draw terrain, drop notes/photos, edit the About card, and flip the playful toggles — all directly on the map. Undo/redo covers every layer.
- Writes are **dev-only**: in production the content APIs are read-only, so the deployed `/admin` is safe to leave public (you just can't save).

## Tech

- **Next.js 16** (App Router, Turbopack) + **React 19** + TypeScript
- **react-zoom-pan-pinch** for the canvas, **framer-motion** for transitions, SVG for the map
- Content is flat files in `content/` (`lines.json`, `terrain.json`, `pins.json`, `site.json`, `stations/*.md` with gray-matter frontmatter) — no database
- WebAudio (synthesised, no asset files) for the sound kit
- Per-stop OG images via `next/og`

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  (the map)
                     # http://localhost:3000/admin  (the editor)
npm run build        # production build
```

Edit content live at `/admin`, or hand-edit the files under `content/`.

## Layout

```
app/            routes — / (map), /s/[id] (stop + OG), /admin (editor), api/* (dev-only writes)
components/     map/* (TransitMap, Trains, Critters, DepartureBoard…), StationDrawer, admin/*
content/        the data: lines, stations (.md), terrain, pins, site config (incl. play settings)
lib/            content readers, play settings, sound kit
```

---

Built by [toeesh](https://github.com/toeeshchaudhary) · MIT licensed

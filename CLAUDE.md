# MTTA — toeesh.network

A personal portfolio drawn as a **NYC-subway-style transit map**. "The network" is a person:
each line is a thread of toeesh, each station is something he made or thinks about. Public repo:
`toeeshchaudhary/MTTA`. Live on Vercel: `https://toeeshnetwork.vercel.app` (brand name is
"toeesh.network" even though the domain isn't wired yet).

## Stack & running
- **Next.js (App Router) + React 19 + TypeScript**, framer-motion, `react-zoom-pan-pinch`, `next/og`.
- **Use `bun`, not npm.** Dev: `bunx next dev` (port 3000). Build: `bunx next build`. Typecheck: `bunx tsc --noEmit`.
- **Not a static export** (`next.config.mjs`) — a standard Next server, so the `/admin` content APIs can write files. Those write routes are **dev-only** (blocked in production), so the deployed `/admin` is safe-but-read-only.

## Content model (the single source of truth)
Everything renders from `content/`:
- `content/lines.json` — threads. Each: `{ id, label, color, text, shape, blurb, pts: [[x,y]…], under?: number[], d? }`.
  `pts` are waypoints; `d` (rounded SVG path) is **derived from `pts` on read** via `lineD()` (so `d` in the file is advisory). `under` lists segment indices that run underground (tunnels); segment `i` = `pts[i]→pts[i+1]`.
- `content/stations/<id>.md` — one stop per file; frontmatter `{ title, line, lines: [...], date, shape, x, y, media }` + markdown body. Filename = id. `line` is primary (colour/shape); `lines[]` is every thread it sits on (joint/interchange stops).
- `content/terrain.json` — **water bodies only** (Mini-Metro style). Each: `{ id, kind:"water", x,y,w,h, points?: [[x,y]…], label? }`. `points` is the polygon (source of truth); `x/y/w/h` is its derived bbox.
- `content/pins.json` — moodboard tiles (notes/photos). `content/site.json` — `origin: [x,y]`, origin pill text, `about`, and `play` (toggles for trains/critters/express/quips/sounds/night-owl).
- `lib/content.ts` reads all of it server-side (`getLines/getStations/getTerrain/getPins/getSite`).

## The map (public render)
`components/Experience.tsx` is the page shell (zoom/pan, intro, drawer, index, departure board, trip planner). It renders `components/map/TransitMap.tsx`, which draws, in order: dot grid → **Terrain** → **Bridges** → lines (masked for tunnels) → **tunnel** dot-trails → **Trains/Critters** → Pins → origin → stations → terminus bullets.
- **Terrain** (`Terrain.tsx`, `terrain-kinds.ts`, `terrain-shape.ts`): flat light-blue water with a lighter inner "current line"; organic polygons smoothed with closed Catmull-Rom. There is intentionally **only one kind: water**.
- **Bridges** (`Bridges.tsx`): auto-placed wherever a line segment crosses a water polygon (skips underground segments). Drawn as a railway trestle (concrete deck + cross-ties).
- **Tunnels**: a line's `under` segments are masked out of the solid ribbon (water shows through); the ribbon ends in a clean rounded cap, a faint dot trail traces the buried path, and the **train fades out underground and back in at the far end**. Authored in `/admin` via per-segment toggles on a selected thread.
- **Trains** (`Trains.tsx`): rAF beads riding each line's path; held until the intro lines finish drawing, then fade in. Interchange/joint stations render as a segmented colour ring around a raised hub.
- **Intro choreography**: `started` begins **false** and flips true when the `Intro` splash clears, so the origin→notes→terrain→lines→stops cascade is actually seen (don't set it back to `true`).

## Domain rule: lines need two termini
**A line must begin and end at a station — or the origin** ("the damn origin" is a first-class terminus).
- In `/admin`, finishing a track **auto-anchors** each end to the nearest station/origin (≤46u); if nothing's close, a terminus stop is auto-created. Ending on an existing stop adds the line to that stop's `lines[]` (so lines can terminate at **grand interchanges**).
- **Deleting a terminus stop shrinks** its line back to the next stop inward (`arcAt`/`sliceByArc` in `admin/lib/geometry.ts`); if none remains, the line is dropped.
- Dragging the **origin** carries along any line endpoint sitting on it.

## The editor (`/admin`)
`app/admin/page.tsx` holds all state + mutations; `components/admin/Canvas.tsx` is the pan/zoom SVG surface; `components/admin/Inspector.tsx` is the right panel. Tools: select, place stop, lay track, paint, **terrain pen** (tap points → close to make a water polygon), note, bulldoze. Mutations POST to `app/api/{lines,stations,terrain,pins,site,upload}`. History via snapshot stack. Geometry helpers live in `components/admin/lib/geometry.ts`.

## Social embeds (`next/og`)
- `app/layout.tsx` sets `metadataBase` from `VERCEL_PROJECT_PRODUCTION_URL` (falls back to the vercel URL) — keep this pointed at the real host or embeds break.
- `app/opengraph-image.tsx` = home card, a **"SYSTEM PASS"** ticket (whole network). `app/s/[id]/opengraph-image.tsx` = per-stop **boarding pass**. Both are `next/og` and use **system fonts only** (no font fetching).

## Conventions
- **Verify visually** — run the app and screenshot with headless chromium (`/usr/bin/chromium --screenshot` or puppeteer-core driving `localhost:3000`); don't guess at UI. The harness blocks foreground `sleep`, and a long-lived dev server may already be running on another port — reuse it.
- **Commit + push incrementally** to `toeeshchaudhary/MTTA` (`main`) as coherent units land — the owner expects steady commits, not one dump. Leave their unrelated working-tree edits unstaged.
- When testing `/admin` writes (which mutate `content/`), **back up `content/` first and restore after** so tests don't pollute the real map.

# Visitor map — ideas to make the landing better

Ideas for the public page (`/` → `components/Experience.tsx` + `components/map/*`), the screen a
first-time visitor drops into. Framed around the transit-map metaphor. Ordered roughly by
impact-to-effort. Not admin-dashboard work.

## Shipped
- **Per-line train** — one train per thread shuttles end-to-end, pausing ~0.7s at every station
  and both termini, then runs back. Auto-created for any new line. (`components/map/Trains.tsx`)
  - Note: trains are gated by the **motion toggle** only, not `prefers-reduced-motion`, so they
    show by default even on motion-averse setups. Flip the default in `Experience.tsx` (`trains`)
    if you'd rather respect reduced-motion out of the box.

## High value
1. **Departure board** — a corner split-flap / LED panel: `NEXT STOP — <station> · <line>`, synced
   to a train. Pure on-theme delight; doubles as a "what's here" teaser. *(medium)*
2. **"Ride the line" guided tour** — click a thread in the legend → the camera follows its train
   stop-to-stop, briefly opening each station card. A self-playing tour for first-timers.
   *(medium–big, high wow; a `rideTheLine` camera glide already exists to build on)*
3. **Board the train** — clicking a moving train opens its next stop; makes the animation
   interactive, not just decorative. *(small)*

## Usability / accessibility
4. **Keyboard navigation** — arrow keys step stop-to-stop along the focused line, Enter opens.
   Big a11y + power-user win for an SVG map. *(small–medium)*
5. **Fuzzy search / jump-to-stop** — extend the index panel into a type-to-fly command (⌘K style).
   *(small–medium)*
6. **Mobile pass** — bigger tap targets for stops, confirm pinch-zoom/drag feel, collapse the
   legend + onboarding cleanly on small screens. *(medium)*

## Charm / theme
7. **Service-status strip** — playful "all lines running · slowly living · last updated …". Cheap,
   reinforces the metaphor. *(small)*
8. **Shareable "boarding pass"** — theme the per-station OG image (`app/s/[id]/opengraph-image.tsx`)
   as a transit ticket so shared links look like a boarding pass. *(small; OG infra exists)*
9. **Ambient time-of-day** — auto-shift the canvas toward the dark "cosmos" palette by the
   visitor's local time. *(small)*

## Top picks
**#1 Departure board + #2 ride-the-line tour** — together they turn the map from "a picture" into
"a system you watch and ride," which is the whole concept.

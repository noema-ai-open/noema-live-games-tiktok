# Visual System

Original art direction for NOEMA Ascent. Every asset is generated at runtime
from Phaser primitives or Canvas gradients — the repository contains no
third-party images, icons, fonts or sounds.

## Canvas

- Logical resolution 720 × 1280 (9:16), `Phaser.Scale.FIT`.
- Two scenes: `AscentScene` (world) and `HudScene` (overlay). The HUD has its
  own camera, so camera shake never moves the readouts.
- The whole level fits on screen, so there is no scrolling camera to fight with
  in a browser/link source. Depth comes from parallax layers, not from camera movement.

## Layers (back to front)

| Depth | Content |
| --- | --- |
| −40 … −39 | Sky gradient, horizon glow, film grain |
| −30 / −20 | Two parallax skyline layers (factor 26 / 52) |
| −10 … −8 | Megastructure shaft, ribs, bracing, flank pipes |
| 2 … 5 | Routes (safe = cyan, risky = amber/red), decks with edge light |
| 6 … 15 | Energy lines, zones, checkpoints, exit gate, structures |
| 20 | Robot workers |
| 36 … 41 | Particles: wind, dust, sparks, smoke, debris, repair, rescue |
| 58 … 72 | ZAR-BOMBE sequence |

Parallax is driven by the average worker progress, smoothed with a lerp, so it
never jerks — and it is unaffected by reduced motion because it does not move
the camera.

## Palette

Defined in `src/render/palette.ts`.

- World: cold blues (`#0a1b33` → `#03080f`) with `#2b6c88` structural edges.
- Support: cyan `#3fe8ff`, green `#5dffa8`.
- Sabotage: amber `#ffb43a`, red `#ff4d5e`.
- Catastrophe: magenta-red `#ff2f6d`, used only for the ZAR-BOMBE.

Contrast rule: anything a viewer must read on a phone (robots, deck edges, HUD
numbers) is drawn with an additive light strip or glow against the dark shaft.

## Robots

Four original variants, chosen by worker id:

| Variant | Role | Accent | Distinguishing feature |
| --- | --- | --- | --- |
| 0 | Technician | cyan | antenna with signal tip |
| 1 | Hauler | amber | shoulder plate, carry frame |
| 2 | Scout | green | dome head, sensor fin |
| 3 | Engineer | violet | welding arm with hot tip |

Each has head, body with chest light, two arms, two legs and glowing eyes.
Animation is procedural (no sprite sheets, no skeleton) and covers spawn,
walking, waiting/blocked, jumping, falling, shield, startled reaction during a
catastrophe warning, and blinking. Rescued and lost workers are hidden by the
simulation state, not by the renderer.

The simulation remains the only source of position and state; `WorkerSprite`
reads and never writes.

## Structures

- **Bridge** — six segments extend left to right with sparks and an online
  label showing its health.
- **Jump field** — glowing floor plate with rising particles and a pulse when
  used.
- **Lift** — shaft, cabin with window, door and running light strip; the strip
  speeds up in overdrive.
- **Team shield** — large translucent dome with a breathing ring.
- **Damage** — broken temporary structures are drawn as gaps with debris marks.
- **Hazard** — timed beam with an additive glow.

## Effects

`EffectLayer` owns five pooled emitters (sparks, smoke, debris, repair,
rescue) plus wind lines and floating low-gravity dust. Every emitter has a hard
`maxAliveParticles` cap, so a long round cannot grow the particle count without
bound. Nothing is created per event.

## ZAR-BOMBE

Viewer-facing name is always exactly `ZAR-BOMBE`; the internal command stays
`tsar_bomb`, and NOEMA is never part of the effect name.

Sequence: alarm wash → large title with `[NAME] HAT DIE ZAR-BOMBE AKTIVIERT` →
countdown → descending stylized reactor payload with spark trail → flash →
expanding shockwave ring → camera shake → smoke column and debris → `TEAM
REBUILD` banner with progress bar, remaining time and repair multiplier.

It is a stylized science-fiction effect: no war imagery, no blood, no
casualties. Workers are scattered, protected workers visibly survive,
checkpoints are kept and the level is rebuilt.

Accessibility:

- **Reduced motion** — flash alpha drops from 0.95 to 0.28, shake from 700 ms /
  0.014 to 180 ms / 0.002, countdown scale-pop and payload wobble are disabled,
  and world animation speeds are damped to ~35 %.
- **Safe mode** — the effect is blocked in the simulation, so nothing is
  rendered at all.

## HUD

Top plate: rescued count with target bar, round timer, team energy bar. It ends
above the exit gate so the goal is never covered.

Bottom: gift feedback toasts on the left (four reusable slots, no allocation per
event), the gift legend on the right — generated from the active mapping, never
hard-coded — and a status chip row (shield, lift, hazard, environment) along the
very bottom edge. A vertical progress rail on the right shows overall ascent.

Icons are geometric glyphs (`+ = ↑ ↕ ◆ ★ ≈ ○ ▼ ~ ●`) that exist in every common
UI font, so nothing renders as a placeholder box in TikTok LIVE Studio or OBS.

Operator-only information (logs, diagnostics, connection details) never appears
in the stream view.

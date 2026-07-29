# Codex handoff: Adventure visual pass

Branch: `feat/adventure-visual-pass`

Base: `feat/noema-adventure-runner` at commit `2d1b521d353343153a3421b036bc33b37cb5b2a2`

## What changed

- `HeroView.ts`: NURI is now a readable procedural explorer with hood, face, goggles, scarf, backpack and animated energy core instead of a simple geometric robot.
- `EnvironmentRenderer.ts`: richer deterministic cyber-mountain world with layered sky, stars, moon glow, clouds, mountains, trees, ruins, chasm glow, checkpoints and a stronger summit beacon.
- `AdventureHudScene.ts`: stream-safe 720x760 HUD. Gift cards sit at the bottom of the compact game block, obstacle prompts remain large, and the game can align with the camera width in TikTok LIVE Studio.

## Verification task

Do not redesign the game again. Only verify and repair this visual pass.

Run:

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Then start the game and inspect both views:

```powershell
pnpm --filter @noema/live-game dev
```

- Operator: `http://127.0.0.1:5173/?view=operator`
- Stream: `http://127.0.0.1:5173/?view=stream&autostart=1`

Check specifically:

1. NURI renders without missing or displaced body parts in idle, run, jump, climb, fall, celebrate and bomb reaction.
2. Camera movement and obstacle interaction remain unchanged.
3. Gift cards do not cover the hero or the active obstacle.
4. Obstacle prompt stays inside the 720x760 canvas.
5. Route vote, gift feedback and result panels do not overlap critically.
6. Reduced Motion still reduces animation.
7. No gameplay, Bridge, Replay or Operator logic was changed accidentally.
8. Replace the five fallback files only when the supplied transparent PNGs are available:
   - `apps/game/public/assets/gifts/fallback/rose.png`
   - `apps/game/public/assets/gifts/fallback/doughnut.png`
   - `apps/game/public/assets/gifts/fallback/hand-heart.png`
   - `apps/game/public/assets/gifts/fallback/corgi.png`
   - `apps/game/public/assets/gifts/fallback/galaxy.png`

Do not claim success without actually running the commands. Commit only necessary fixes and report the exact command results and final commit SHA.

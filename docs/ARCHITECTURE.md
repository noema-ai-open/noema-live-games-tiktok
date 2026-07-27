# Architecture

## Scope

NOEMA Live Games for TikTok is a public, modular game platform for interactive TikTok LIVE streams. It consumes normalized events from the NOEMA TikTok Live Bridge and converts them into deterministic game commands.

## Data flow

```text
TikTok LIVE
  -> NOEMA TikTok Live Bridge
  -> Game Gateway
  -> Rules Engine
  -> WebSocket event stream
  -> Phaser game runtime
  -> OBS browser source
```

## Core boundaries

### NOEMA TikTok Live Bridge

Responsible for receiving and normalizing platform events. It must not expose passwords, session cookies or implementation details that would require process injection or DLL hooking.

### Game Gateway

Responsible for schema validation, rate limiting, deduplication, rule evaluation and distribution of trusted game commands.

### Game Runtime

Responsible only for rendering, simulation and local audiovisual feedback. It must not connect directly to TikTok.

### Control Panel

Responsible for configuring mappings, cooldowns, difficulty, accessibility options and emergency controls such as pause, mute and reset.

## Event classes

- Free engagement: likes, follows, shares and selected chat commands
- Paid engagement: gifts and subscriptions
- System events: connection state, round start, checkpoint and reset
- Operator events: pause, resume, force checkpoint and safe mode

## Fairness model

Free engagement must remain relevant. Gifts may amplify or modify the game, but the base loop must not become unusable without payment.

## Security model

- Validate every inbound event against a versioned schema.
- Never trust usernames, display names or gift metadata as executable content.
- Enforce cooldowns and per-source rate limits.
- Keep secrets out of browser bundles.
- Bind local development services to loopback by default.
- Require explicit configuration before exposing a gateway beyond the local host.

## Initial technology choices

- TypeScript across the monorepo
- Phaser 3 and Vite for the game runtime
- Node.js and WebSocket for the gateway
- pnpm workspaces
- Docker after the local development path is stable

## First playable target

A vertical cooperative climb with checkpoints, hazards and community energy:

- Likes charge team energy.
- Follows and shares trigger controlled boosts.
- Gifts trigger configurable abilities or hazards.
- Viewer names appear only for meaningful actions.
- The game can run with automated text and sound feedback so the streamer does not need to speak continuously.

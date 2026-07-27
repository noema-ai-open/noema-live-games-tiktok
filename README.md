# NOEMA Live Games for TikTok

Interactive TikTok LIVE gaming platform powered by NOEMA.

This public repository contains the game runtime, control panel, event protocol and gateway used to turn TikTok LIVE events into transparent, configurable game actions.

## Goals

- Free interaction remains meaningful through likes, follows, shares and chat events.
- Gifts can amplify, accelerate or sabotage without reducing the stream to a payment wall.
- Runs as an OBS browser source without a proprietary launcher.
- Integrates with the existing NOEMA TikTok Live Bridge.
- Keeps game rules, event mappings and overlays under the streamer's control.
- Supports automated commentary and accessibility-friendly operation with minimal speaking.

## Planned architecture

```text
TikTok LIVE
    ↓
NOEMA TikTok Live Bridge
    ↓
Game Gateway / Rules Engine
    ↓ WebSocket
Game Runtime + Control Panel
    ↓
OBS Browser Source
```

## Repository layout

```text
apps/game             Browser-based game runtime
apps/control-panel    Streamer configuration and live control
packages/game-engine  Reusable game mechanics and state handling
packages/event-protocol Shared TikTok/NOEMA game event contracts
packages/shared       Shared utilities and types
services/game-gateway Event validation, rules and WebSocket distribution
docs                  Architecture and protocol documentation
```

## Initial stack

- TypeScript
- Phaser 3
- Vite
- WebSocket
- Node.js
- pnpm workspaces
- Docker

## Status

Early public development scaffold. APIs and file structure may change before the first stable release.

## Principles

Practical AI. Human control.

No process injection, DLL hooking, password collection or session-cookie harvesting. The platform is an integration layer, not a complete TikTok client.

## License

MIT

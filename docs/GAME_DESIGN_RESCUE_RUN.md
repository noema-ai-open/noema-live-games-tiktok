# NOEMA Rescue Run

## Product concept

NOEMA Rescue Run is an original interactive swarm-rescue game for TikTok LIVE. A group of small autonomous runners moves through a hazardous level while the audience cooperates, votes, protects, redirects or sabotages them through normalized live events.

The game is inspired by the general genre of crowd-routing puzzle games, not by any specific protected characters, artwork, sounds, names or level designs.

## Stream goals

- Understandable within seconds on a vertical mobile screen
- Continuous motion without requiring the streamer to control every character
- Strong free interaction through likes, chat, follows and shares
- Paid interaction that adds drama without making free viewers irrelevant
- Automated text and sound feedback for low-speech operation
- Short rounds with a visible result and immediate restart potential

## Initial round model

- Round duration: 4 minutes
- Starting runners: 30
- Rescue target: 70 percent
- Checkpoints: 2
- Maximum active viewer labels: 3
- Default operator mode: observe
- Emergency controls: pause, safe mode, reset, force checkpoint

## Core simulation

Each runner has a deterministic state:

- walking
- falling
- jumping
- blocked
- protected
- rescued
- lost

The simulation must be deterministic for the same seed and command sequence. The gateway assigns a sequence number to every accepted command so the game can log and replay a round.

## Audience interaction

### Likes

Likes fill a shared team-energy meter in batches. A configurable threshold converts accumulated likes into one support charge. Directly applying every individual like would make balancing impossible in larger streams.

### Chat

Chat commands vote for the next tool. Initial commands:

- `bridge`
- `block`
- `jump`
- `shield`
- `portal`

Votes are counted within a short window. The winning valid command is applied only when enough team energy is available.

### Follows and shares

Follows can grant a small shield charge. Shares can slow hazards briefly or reveal the safest route. Both effects need cooldowns.

### Gifts

Gift mappings are configurable and must not be hard coded into the game runtime. Suggested effect classes:

- support
- protection
- movement
- environment
- sabotage
- recovery

Sabotage must be capped so one viewer cannot make a round permanently unwinnable.

## Fairness rules

- The base level must be winnable using only free interactions and operator support.
- Gift effects may improve odds, speed or spectacle, but not unlock the only viable route.
- Sabotage has global and per-viewer cooldowns.
- Paid effects are visible and attributable without overwhelming the screen.
- The streamer can disable negative effects before or during a round.

## Accessibility and streamer load

- Automated event captions
- Optional local TTS commentary
- Adjustable sound density
- High-contrast HUD mode
- Reduced-motion mode for overlays and camera effects
- One-button safe mode that blocks hazards and continues the round
- No requirement for continuous speech

## Visual direction

Use an original bright science-fiction workshop or rescue-lab world. Characters should be small modular worker creatures or robots with simple silhouettes and expressive movement. Avoid visual resemblance to known puzzle-game characters.

The mobile composition should reserve:

- top area for camera or title
- center for the active level
- lower area for team energy, rescue count and timer
- edge space for temporary viewer attribution

## MVP levels

### Level 1: Broken Workshop

Teaches bridge, block and jump mechanics with one pit and one moving platform.

### Level 2: Cooling Core

Adds timed hazards and shield use.

### Level 3: Portal Failure

Adds route voting and temporary portals.

## Technical acceptance criteria

- Runs locally as an OBS browser source
- Accepts mock events without TikTok connectivity
- Replays a logged round from seed plus ordered commands
- Handles event bursts without frame-rate dependent behavior
- Supports 30 runners at 60 frames per second on a normal streaming PC
- Can pause and resume without losing deterministic state
- Contains no TikTok credentials or secrets in the browser bundle

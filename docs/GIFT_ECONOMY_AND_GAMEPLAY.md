# Gift Economy and Gameplay Concept

## Product direction

The first public game mode should be an original NOEMA construction-and-rescue game for vertical TikTok LIVE streams.

Working title: **NOEMA Ascent**

A swarm of small autonomous NOEMA workers must reach the top of a damaged megastructure. They walk automatically. The community builds routes, protects workers, changes direction, opens portals and repairs damage. Other viewers may trigger increasingly expensive hazards.

The broad genre is crowd-routing and construction strategy. Characters, world, UI, names, sounds, tools, level layouts and visual identity must be original.

Public mark:

**Powered by NOEMA AI**

## Core commercial rule

Helpful actions are intentionally cheaper than destructive actions.

A viewer who helps should receive visible impact at low cost. A viewer who wants to damage the run must spend substantially more. This creates three useful loops:

1. free viewers remain relevant through likes and chat votes
2. supporters can help often with low- and mid-tier gifts
3. sabotage becomes a premium spectacle rather than cheap spam

The default balancing target is:

- minor sabotage costs at least 3 times the comparable helpful effect
- major sabotage costs at least 5 times the comparable helpful effect
- catastrophic effects are reserved for the highest configurable gift tier

## Do not hard-code gift names

TikTok gift catalogs and coin values can change by region and over time. The game must therefore map effects by current coin value and gift ID, not by assumptions about a permanent global catalog.

The control panel should display the gifts currently observed by the connector and allow the operator to assign each gift to an effect. A gift name such as Galaxy may be used when available, but the rule is defined by its current coin tier.

## Interaction tiers

The following bands are initial balancing values, not fixed platform prices.

### Free engagement

Triggers:

- likes
- follows
- shares
- chat votes

Effects:

- charge community build energy
- vote for the next construction tool
- reveal safe paths
- grant small timed protection

Free interaction must be able to complete the base level, although less efficiently than coordinated gifting.

### Tier 1: Micro support

Suggested band: 1 to 9 coins

Examples:

- add one build-energy unit
- repair one small tile
- give one worker a parachute
- light the next safe platform

These effects should be visible but not interrupt the round.

### Tier 2: Standard support

Suggested band: 10 to 99 coins

Examples:

- place a short bridge
- create a jump pad
- shield a small group
- reverse one worker group safely
- rescue one falling worker

### Tier 3: Strong support

Suggested band: 100 to 499 coins

Examples:

- place an elevator segment
- create a temporary portal pair
- repair a damaged zone
- freeze hazards for several seconds
- rescue every worker inside one marked area

### Tier 4: Premium support

Suggested band: 500 to 1,999 coins

Examples:

- rebuild one complete route section
- activate a team-wide shield
- move all active workers to the last checkpoint
- deploy an AI construction drone for a limited time

### Tier 5: Minor sabotage

Suggested band: 300 to 999 coins

Examples:

- reverse one group
- disable one platform briefly
- add wind or low gravity
- spawn a temporary obstacle

Minor sabotage must never remove a checkpoint or make the level permanently unwinnable.

### Tier 6: Major sabotage

Suggested band: 2,000 to 9,999 coins

Examples:

- collapse part of the current route
- activate a short blackout
- trigger an earthquake
- split the worker group into two paths
- disable community tools for a few seconds

A recovery window starts immediately after major sabotage. Helpful gifts during that window gain a configurable repair multiplier.

### Tier 7: Cataclysm

Suggested band: 10,000 coins or the highest locally available premium gift tier

Working effect name: **NOEMA Cataclysm**

Visual sequence:

1. warning siren and sender attribution
2. camera pulls back
3. orbital strike, singularity, reactor overload or equivalent original effect
4. large visible destruction across the current screen
5. workers are scattered, protected workers survive
6. a 20 to 30 second emergency rebuild phase begins

The cataclysm should destroy approximately 50 to 70 percent of temporary construction, not permanently erase the entire session. A full hard reset is bad game design because one spender could terminate the content instead of creating more content.

The effect requires:

- global cooldown
- one cataclysm at a time
- operator kill switch
- reduced-motion alternative
- automatic recovery phase
- replay-safe deterministic execution

## Counterplay economy

Destruction creates a temporary comeback window rather than a dead end.

Example:

- major sabotage costs 5,000 coins
- for the next 20 seconds, supportive effects receive double repair strength
- several lower-cost supporters can visibly fight back
- the HUD shows `TEAM REBUILD` and the remaining recovery time

This makes the expensive destructive gift spectacular while preserving agency for the community.

## Round structure

Initial target:

- vertical 9:16 layout
- 30 autonomous workers
- 4 to 6 minute rounds
- 3 construction zones
- 2 checkpoints
- success when at least 70 percent reach the exit
- immediate next-round button for the operator

Each level should contain:

- one obvious safe route
- one faster risky route
- one gift-amplified shortcut
- hazards that can be understood on a phone screen

## Mobile viewer experience

The video overlay is not directly tappable. Viewers interact through TikTok's native controls.

The stream HUD should therefore show a compact rotating legend such as:

```text
Rose -> Repair
Current 99-coin gift -> Bridge
Current 500-coin gift -> Team Shield
Current premium gift -> Cataclysm
```

The displayed legend must be generated from the active mapping configuration. It must never pretend that an overlay element itself is a tappable mobile button.

## Connector architecture

The game must not depend on one event supplier.

```text
TikTok LIVE
    -> Connector adapter
        -> NOEMA TikTok Live Bridge adapter
        -> TikFinity WebSocket adapter
        -> Mock/replay adapter
    -> Event normalizer
    -> Gift catalog and mapping service
    -> Rules engine
    -> Ordered game commands
    -> Phaser runtime
    -> OBS or LIVE Studio browser source
```

TikFinity can be used as an early fallback because it exposes a local WebSocket stream for TikTok LIVE events. The long-term primary path should remain the NOEMA bridge so the project controls validation, event history, mappings and product behavior.

The term "Livewitch" is not used as a hard dependency in this design. Any live-event tool is integrated through an adapter so it can be replaced without rewriting the game.

## Required event fields

Normalized gift events need at least:

- event ID
- gift ID
- gift name
- current coin value
- repeat count
- sender ID
- sender username and display name
- timestamp
- source connector

The final effective coin value is:

```text
coins * repeatCount
```

Combo gifts must be finalized correctly so one streak is not executed twice.

## Rules engine

The rules engine converts normalized live events into deterministic game commands.

Responsibilities:

- validate event schema
- deduplicate repeated connector events
- finalize gift streaks
- apply per-user and global cooldowns
- map current gifts to effects
- scale effects within safe bounds
- assign command sequence numbers
- log commands for replay
- reject effects while safe mode is active

The Phaser game runtime must never receive raw TikTok events.

## Control panel

The streamer needs a simple operator interface with:

- current connection state
- observed gift catalog
- drag-and-drop gift-to-effect mapping
- positive and negative effect filters
- safe mode
- pause and resume
- reset round
- trigger test event
- per-effect cooldowns
- maximum sabotage strength
- reduced-motion mode
- local TTS enable and disable
- session income statistics based on received coin events

No passwords, cookies or TikTok secrets belong in the browser bundle.

## Ethical and platform boundaries

The game provides deterministic entertainment effects inside the livestream. It must not promise cash, prizes, refunds, financial returns or random winnings in exchange for gifts.

Avoid:

- fake tappable gift buttons
- misleading claims about what a gift does
- hidden probabilities
- gambling mechanics
- cash-equivalent rewards
- pressure targeting minors
- effects that expose private viewer data

All active gift mappings should be visible before or during the round.

## MVP build order

### Phase 1: Offline vertical prototype

- Phaser scene
- autonomous workers
- platforms and hazards
- bridge, block, jump, shield and collapse commands
- fixed-step deterministic simulation
- mock event panel

### Phase 2: Gateway and protocol

- Node.js WebSocket gateway
- normalized event schema
- ordered command stream
- cooldown and deduplication logic
- replay log

### Phase 3: TikFinity adapter

- local WebSocket connection
- gift, like, follow, share and chat normalization
- gift catalog observation
- combo finalization

### Phase 4: NOEMA bridge adapter

- connect the existing NOEMA TikTok Live Bridge
- use the same normalized event contract
- remove any game-specific logic from the bridge

### Phase 5: Operator panel

- gift mapping editor
- test triggers
- safe mode and reset
- session counters

### Phase 6: Presentation

- original NOEMA world and workers
- effects and sound design
- mobile gift legend
- automated captions and optional TTS
- Powered by NOEMA AI branding

## First acceptance test

A complete local demo is accepted when:

1. 30 workers climb through one vertical level
2. likes charge build energy through mock events
3. one cheap positive gift builds a bridge
4. one expensive negative gift collapses part of the route
5. one premium test gift triggers NOEMA Cataclysm
6. the recovery phase allows the team to rebuild
7. the round can be replayed from the stored command log
8. the scene runs as a browser source at 60 frames per second

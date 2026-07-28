# Gift Event Pipeline

From a live event to a deterministic game command.

```text
Live event
  → Connector (MockConnector | NoemaLiveBridgeConnector)
  → NormalizedLiveEvent
  → RulesEngine
      ├─ deduplication (event id)
      ├─ streak aggregation (combo)
      ├─ catalog mapping (gift id → action)
      ├─ cooldowns
      └─ feedback (render only, immediate)
  → PriorityInbox  (critical → normal → low)
  → LiveSession.dispatch()
  → Simulation.submit() → CommandQueue (monotonic sequence)
  → Simulation.step()
  → Phaser renderer
```

The renderer never receives events, and the simulation never receives raw
payloads. `LiveSession.dispatch()` runs once per rendered frame, before the
fixed simulation steps.

## Deduplication

`GiftStreakTracker` remembers every `eventId` it has seen (TTL 5 minutes,
capped at 4000 entries). A repeated id is dropped and counted; the operator view
shows the counter.

## Streaks

A streak is keyed by `comboId` when the connector supplies one, otherwise by
`sender id + gift id`.

- `repeatCount` is treated as a **running total**. Late or out-of-order frames
  can raise it, never lower it.
- While the streak runs, only the visible counter is updated — the effect does
  not fire yet.
- The effect fires exactly once, at finalization:
  - immediately when the connector reports `repeat_end` / `combo_final`, or
  - after 2.5 s without a new frame (`RulesEngine.tick()` collects those). The
    NOEMA bridge does not report combo markers, so this window is the normal
    path.

`Rose ×1 … ×15` is therefore one streak and one repair command. A ZAR-BOMBE gift
can fire at most once per streak, and its 60 s cooldown blocks a second one
regardless of sender.

## Priority

| Lane | Contents |
| --- | --- |
| `critical` | ZAR-BOMBE, team shield, large-area rescue, earthquake |
| `normal` | bridge, lift, jump field, repair, standard gifts |
| `low` | likes, follows, shares, small energy pulses |

`PriorityInbox.drain()` returns critical first, then normal, then low, each lane
in arrival order. Sequence numbers are assigned afterwards by `CommandQueue`, so
they stay monotonic and the round remains replayable. Priority changes *when* a
command is queued, never *whether* it is deterministic.

## Mapping

`src/gifts/giftCatalog.ts` holds the local mapping:

```text
giftId → displayName, coinValue, action, strength, cooldownSeconds, enabled
```

- Gift id wins; the lowercase gift name is only a fallback.
- Unknown gifts are logged, shown in the operator view and can be adopted with
  one click. They never trigger a random effect.
- Galaxy is a normal, editable row — not a hard-coded global truth.
- Stored in `localStorage` under `noema-ascent.gift-catalog` with a version and
  a migration that merges old rows onto current defaults.

Effect strength is clamped inside each action builder. Only continuous effects
(repair, team energy) scale with the repeat count; structures do not.

## Feedback

`FeedbackBus` is a render-only channel. The HUD receives the acknowledgement in
the same task in which the event arrived, so internal latency is a frame, not a
poll interval. There is no polling anywhere in the gift path.

Feedback contains sender, gift label, action icon, repeat count and whether the
effect has already been applied:

```text
+  NeonBuilder            ×15
   REPARATUR
```

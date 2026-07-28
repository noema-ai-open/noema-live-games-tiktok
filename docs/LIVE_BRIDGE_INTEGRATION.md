# NOEMA Live Bridge Integration

How `apps/game` consumes events from the locally running
[NOEMA TikTok Live Bridge](https://github.com/noema-ai-open/noema-tiktok-live-bridge).

## Endpoints actually used

The bridge binds to `127.0.0.1` and exposes its routes at the server root
(default port `8765`, configurable via `NOEMA_PORT`). Only these are used:

| Endpoint | Method | Purpose in the game |
| --- | --- | --- |
| `/ws/events` | WebSocket | Push stream of all events. Primary and authoritative source. |
| `/status` | GET | Optional probe: bridge `mode` and `connector_status`. |
| `/connection` | GET | Optional probe: the public `tiktok_username` the bridge is configured for. |

No other endpoint is called. The game never writes to the bridge, never posts
settings and never requests `/connection/keys`.

## Frame shapes on `/ws/events`

The socket carries three shapes:

1. An event payload (`app/events/models.py::Event.json_payload`):

```json
{
  "platform": "tiktok",
  "event_type": "gift",
  "event_id": "tiktok-123",
  "timestamp": "2026-07-28T08:00:00+00:00",
  "user": { "display_name": "NeonBuilder", "user_id": "tt:4711",
            "is_moderator": false, "is_subscriber": true },
  "message": null,
  "metadata": { "gift_name": "Rose", "repeat_count": 3, "diamond_count": 1 }
}
```

2. `{ "type": "blocked", "reason": "...", "event": { ... } }` — filtered by the
   bridge, counted but not played.
3. `{ "type": "system", "text": "..." }` — bridge notice, ignored by the game.

`event_type` is one of `status`, `join`, `chat_message`, `like`, `follow`,
`share`, `gift`, `subscribe`.

## Normalization

`src/connectors/bridgeNormalizer.ts` converts a raw frame into the
`NormalizedLiveEvent` contract from `@noema/event-protocol`. Anything else is
reported as `ignored` and never forwarded — the game runtime never sees a raw
bridge or TikTok payload.

Gift metadata mapping:

| Normalized field | Bridge source | Fallback |
| --- | --- | --- |
| `giftName` | `metadata.gift_name` | `"Unbekanntes Geschenk"` |
| `giftId` | `metadata.gift_id` | `name:<slug of gift name>` |
| `repeatCount` | `metadata.repeat_count` / `metadata.count` | `1` |
| `coinValue` | `metadata.diamond_count` | `0` |
| `comboId` | `metadata.combo_id` | absent |
| `comboFinal` | `metadata.repeat_end` / `metadata.combo_final` | absent |

**The current bridge reports only `gift_name`, `repeat_count` and
`diamond_count`.** The id, combo id and combo-final fields are read when
present so a future bridge version works without a game change, but the game
must not assume them. Because of that, streaks are finalized by a time window
(see `docs/GIFT_EVENT_PIPELINE.md`).

## Connection behaviour

- Default address `http://127.0.0.1:8765`, editable in the start screen and in
  the operator view; stored in `localStorage` under `noema-ascent.settings`.
- The WebSocket URL is derived from the address (`ws://host:port/ws/events`).
- Reconnect uses capped exponential backoff: 1 s, 2 s, 4 s … up to 30 s. A
  successful handshake resets the backoff. There is no tight retry loop.
- On close the socket handlers are detached immediately, so a replaced socket
  can never deliver a second copy of an event.
- An explicit disconnect stops all reconnect timers.

## Known limitation: CORS

The bridge ships no CORS headers. A browser therefore blocks the *reading* of
`/status` and `/connection` responses when the game is served from a different
origin (e.g. the Vite dev server on port 4173).

- WebSockets are **not** subject to CORS, so the event stream works regardless.
- "Verbindung testen" reports this honestly: a failed HTTP probe is not treated
  as a failed connection, and the profile field simply stays empty.
- To get the HTTP probes as well, serve the game from the same origin as the
  bridge or put a local reverse proxy in front of both.

Because the bridge binds hard to `127.0.0.1`, it cannot be reached from another
host at all. The game page, the bridge and the streaming software (TikTok LIVE
Studio or OBS) therefore have to run on the same machine.

## Credentials

The game asks for no TikTok password, cookie, session id, QR login or access
token, and it holds no NOEMA account. The public TikTok user name is configured
inside the bridge; the game only displays it when the bridge reports it.

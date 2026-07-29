# NOEMA Live Bridge

Die lokale Bridge bleibt über die Connector-Abstraktion angebunden. Die
Standardadresse ist `http://127.0.0.1:8765`; WebSocket- und REST-Prüfung bleiben
im Startscreen verfügbar.

## Normalisierte Ereignisse

- Gift: `giftId`, exakter Name, Coinwert, Repeat Count, Combo-Ende, optionale Icon-URL
- Chat: Nachricht und Viewer, niemals als Geschenk interpretiert
- Like: Team-Energie
- Follow: Zeitbonus
- Share: Team-Energie

Giftauflösung:

1. exakte `giftId`
2. normalisierter exakter Geschenkname
3. unbekannt und wirkungslos

Die Bridge darf aktuelle TikTok-Icon-URLs liefern. Nur HTTP(S)-URLs werden
geladen. Bei fehlender oder fehlerhafter URL verwendet das Spiel lokale PNGs
unter `apps/game/public/assets/gifts/fallback`.

Reconnect, Eventnormalisierung, Operatorstatus und die Trennung von Transport
und Gameplay bleiben Aufgabe der vorhandenen Connector-Schicht.


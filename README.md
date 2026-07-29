# NOEMA Ascent

NOEMA Ascent ist ein interaktiver 2D-Adventure-Runner für TikTok LIVE. NURI
trägt einen Energiekern durch eine futuristische Bergwelt zum
Himmelsleuchtfeuer. Die Figur läuft automatisch, hält vor kontrollierten
Hindernissen an und reagiert sichtbar auf Geschenke und Chatabstimmungen.

Die Spielfläche ist als kompakter Hochkant-Block in **720 × 760** ausgelegt. Damit
passt sie unter ein Kamerabild in einem vertikalen TikTok-Layout. Die Welt
scrollt seitlich innerhalb dieses Blocks.

## Drei-Level-Kampagne

Die handgebaute Kampagne enthält:

1. **DER WEG ZUM HIMMELSLEUCHTFEUER** – Tal, Wald, Ruinen und Gipfeltor
2. **DIE NEONHÖHLEN** – Kristallhöhlen und verlassene Maschinen
3. **DER STURMPASS** – Gewitterpfad, Himmelsruinen und finales Leuchtfeuer

Jedes Level besitzt Sprünge, Bauteile, Chatabzweigung, Schlucht, Checkpoints
und Helfertor. Am Levelende läuft eine eigene Feuerwerksanimation. Danach
beginnt automatisch das nächste Level mit einer frischen Zeit von 4:30.

Nach dem dritten Level bleibt der Kampagnenerfolg 12 Sekunden, ein Fehlschlag
8 Sekunden sichtbar; der Automodus startet anschließend eine neue Seed-Runde.

## Geschenkaktionen

| Geschenk | Wirkung |
| --- | --- |
| Rose | Springen |
| Doughnut | drei sichtbare Bauteile |
| Hand Heart | vollständige Energiebrücke |
| Corgi | Helfer, Reparatur oder Rettung |
| Galaxy | ZAR-BOMBE |

Die Zuordnung erfolgt zuerst über `giftId`, dann über den normalisierten
exakten Namen. Coinwerte entscheiden niemals über eine Wirkung. Unbekannte
Geschenke werden angezeigt und protokolliert, bleiben aber inert.

## Lokale Entwicklung

Voraussetzung: Node.js und pnpm.

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Lokaler Entwicklungsmodus:

```powershell
pnpm --filter @noema/live-game dev
```

- Operator View: `http://127.0.0.1:5173/?view=operator`
- Stream View: `http://127.0.0.1:5173/?view=stream&autostart=1`

Der Offline-Test verwendet denselben normalisierten Eventpfad wie die Live
Bridge. Die Standardadresse der lokalen Bridge ist
`http://127.0.0.1:8765`.

## Erhaltene Infrastruktur

- Connector-Abstraktion mit Mock Connector und NOEMA Live Bridge Connector
- getrennte GiftEvents und ChatEvents
- Eventnormalisierung und Streak-Finalisierung
- Prioritätswarteschlange und deterministische Command Queue
- Replay-Grundlage
- Operatoransicht, Startscreen und Einstellungen
- AudioSystem mit Mute und Lautstärke
- lokale Verbindung über `127.0.0.1`
- Windows-Packaging und Release-Workflow

## Struktur

```text
apps/game/src/adventure    Simulation, Level, Hero, Hindernisse, Votes, Checkpoints
apps/game/src/render       Phaser-Szene, Figur, Welt, HUD, Brücken, Helfer, Bombe
apps/game/src/assets       Geschenk- und Spritesheet-Verträge
apps/game/src/connectors   Mock- und Live-Bridge-Connectoren
apps/game/src/gifts        Mapping, Streaks, Regeln, Prioritäten
apps/game/src/ui           Startscreen und Operatoransicht
apps/game/tests            Adventure-, Bridge-, Replay- und Systemtests
packages/event-protocol    normalisierte Live-Events und GameCommands
packaging                  Windows-Paketierung und lokaler Static Server
docs                       Design- und Betriebsdokumentation
```

Weitere Dokumentation:

- [Adventure Game Design](docs/ADVENTURE_GAME_DESIGN.md)
- [Adventure Architecture](docs/ADVENTURE_ARCHITECTURE.md)
- [Gift Actions](docs/GIFT_ACTIONS.md)
- [Level Authoring](docs/LEVEL_AUTHORING.md)
- [Live Bridge Integration](docs/LIVE_BRIDGE_INTEGRATION.md)

## Rechte und Eigenständigkeit

NOEMA Ascent verwendet eine eigenständige NOEMA-Welt, eigene Figuren,
Mechaniken und Texte. Es werden keine Figuren, Namen, Grafiken, Sounds, Level
oder konkreten Szenen bestehender Adventure-Spiele übernommen.


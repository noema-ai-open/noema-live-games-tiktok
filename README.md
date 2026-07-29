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
2. **DIE KRISTALLHÖHLEN** – Kristallhöhlen und verlassene Maschinen
3. **DER STURMGIPFEL** – Gewitterpfad, Himmelsruinen und finales Leuchtfeuer

Jedes Level besitzt mindestens elf Segmente (Sprünge, Bauteile,
Chatabzweigung, Schlucht, Checkpoints, Helfertor) mit eigener Farbpalette und
eigenen Landmarken je Region. Am Levelende läuft eine eigene, regionsabhängige
Feuerwerksanimation mit Leuchtfeuer-Lichtstrahl; das Finale von Level 3 fällt
deutlich größer aus. Jedes Level startet mit einer eigenen, frischen Zeit von
4:30 – ein Levelwechsel verbraucht nie die Zeit des nächsten Levels.

Nach dem dritten Level bleibt der Kampagnenerfolg 12 Sekunden, ein Fehlschlag
8 Sekunden sichtbar; der Automodus startet anschließend eine neue Seed-Runde.

### NURI-Sprechblase

Wartet NURI mindestens drei Sekunden unbeantwortet vor einem Hindernis
(`heroState === "blocked"`), erscheint über der Figur eine Sprechblase mit
„Help me, please!“. Sie verschwindet sofort, sobald eine Aktion beginnt, und
erscheint frühestens zwölf Sekunden nach dem letzten Verschwinden erneut. Die
Logik steckt deterministisch in `AdventureSimulation` (`state.speechBubble`),
die Darstellung in `apps/game/src/render/HeroSpeechBubble.ts` – vorbereitet
für weitere Sätze, ohne den bestehenden State-Machine-Fluss zu verändern.

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


# Architektur

Die aktuelle Architektur ist der Adventure Runner. Das frühere
30-Worker-Turmspiel ist keine aktive oder unterstützte Spiellogik mehr.

```text
Bridge/Mock
  -> normalisierte Gift-, Chat-, Like-, Follow- und Share-Events
  -> RulesEngine + GiftStreakTracker
  -> PriorityInbox
  -> LiveSession
  -> deterministische CommandQueue
  -> AdventureSimulation
  -> Phaser AdventureScene + AdventureHudScene
```

`AdventureSimulation` ist die einzige Gameplay-Autorität. Phaser visualisiert
Snapshots und löst keine Regeln aus. Dadurch bleiben Replays deterministisch
und Bridge-, Mock- sowie Operatorevents verwenden denselben Pfad.

Die Live-Bridge-Infrastruktur, Einstellungen, Replay-Grundlage, Audio,
Startscreen, Operatorpanel und Windows-Packaging wurden aus dem vorherigen
Stand erhalten. Details stehen in
[ADVENTURE_ARCHITECTURE.md](ADVENTURE_ARCHITECTURE.md).


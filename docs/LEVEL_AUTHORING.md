# Level Authoring

Level sind deterministische Folgen aus datengetriebenen Segmenten. Unterstützt
werden `intro`, `run`, `small_gap`, `high_ledge`, `broken_bridge`, `ravine`,
`rock_block`, `repair_gate`, `route_fork`, `checkpoint` und `finish`.

```ts
{
  id: "ravine-1",
  section: 4,
  type: "ravine",
  length: 840,
  startX: 3120,
  endX: 3960,
  groundY: 610,
  visualTheme: "ancient_ravine",
  obstacleType: "ravine",
  requiredAction: "build_bridge",
  requiredAmount: 1,
  alternatives: [{ action: "build_blocks", amount: 6 }],
  checkpointAfter: true,
  next: ["summit-climb"],
  camera: "wide",
  successCriterion: "All six bridge segments are solid"
}
```

Jedes Segment definiert Länge, Koordinaten, Theme, Hindernis, Aktionen,
Checkpoint, Nachfolger, Kameraverhalten und Erfolgskriterium. Sprunglandungen
und Wartepunkte sind fest; Hindernisse sind keine Zufallsphysik.

Neue Level werden als `AdventureLevel`-Template angelegt und über einen Seed
instanziiert. Route und Segmentfolge müssen bei gleichem Seed und gleichen
Commands identisch bleiben. Neue Visuals werden anhand von `visualTheme` in der
Render-Schicht ergänzt, nicht in der Simulation.


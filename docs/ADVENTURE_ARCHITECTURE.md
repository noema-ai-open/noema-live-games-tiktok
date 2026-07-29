# Adventure-Architektur

## Gameplay

- `AdventureSimulation`: deterministischer 30-Hz-Rundenkern
- `HeroStateMachine`: gültige Zustände und Doppelauslösungsschutz
- `HeroController`: feste Lauf-, Sprung-, Kletter-, Fall- und Aktionskurven
- `LevelDirector`: Segmentfolge und gewählte Route
- `ObstacleController`: reale Bauteile, Fertigstellung und Zerstörung
- `RouteVoteController`: Zehnsekundenfenster und Deduplizierung
- `CheckpointSystem`: Snapshot und lokale Wiederherstellung
- `GiftActionRouter`: Brücke zwischen GameCommands und Adventure-Aktionen

## Rendering

`AdventureScene` folgt NURI weich in einer horizontalen Welt. Das
`AdventureHudScene` bleibt kamerafest. `HeroView` rendert die artikulierte
Platzhalterfigur; `EnvironmentRenderer`, `ObstacleView`, `BridgeView`,
`BlockBuilderView`, `HelperView` und `TsarBombRenderer` visualisieren nur den
Simulationszustand.

## Zustandsmaschine

`boot`, `intro`, `running`, `approaching_obstacle`, `blocked`, `route_vote`,
`performing_action`, `jumping`, `climbing`, `falling`, `helper_active`,
`checkpoint`, `bomb_warning`, `bomb_impact`, `resetting`, `success`, `failure`
und `paused`.

Aktionen werden nur in passenden Zuständen akzeptiert. Eine zweite Rose
während eines Sprungs, eine zweite fertige Brücke oder Galaxy während einer
Bombensequenz hat keine doppelte Wirkung.

## Spritesheet-Austausch

`src/assets/heroAssetConfig.ts` dokumentiert 256×256-Frames und die
Animationsframefolgen. Ein späteres Spritesheet kann denselben Vertrag
implementieren, ohne Simulation oder Eventpipeline zu ändern.


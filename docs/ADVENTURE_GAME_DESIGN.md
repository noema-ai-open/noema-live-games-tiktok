# Adventure Game Design

## Ziel

NURI bringt einen leuchtenden Energiekern durch drei aufeinanderfolgende Level
zum Himmelsleuchtfeuer. Pro Level stehen 4:30 Minuten zur Verfügung. Die
einzelne Figur läuft automatisch, reagiert animiert auf Hindernisse und wartet
auf klar benannte Zuschauerhilfe.

## Kernschleife

Laufen → Hindernis erkennen → anhalten und zeigen → Geschenkaktion sichtbar
ausführen → weiterlaufen. An einer Abzweigung stimmt der Chat zehn Sekunden mit
`links`, `rechts`, `1` oder `2` ab.

## Darstellung

Das MVP ist eine kontrollierte Phaser-2D-Seitenansicht in einem 720×760
Hochkant-Block. Parallax-Berge, Waldsilhouetten, definierte Plattformen,
Brücken, Bausteine und Tore sind prozedurale saubere Platzhalter. Es gibt keine
3D-Geometrie und kein Versprechen fertiger Concept Art.

NURI besteht aus separat bewegten Kopf-, Körper-, Arm- und Beinteilen. Sichtbar
unterstützte Animationen: idle, run, wait, point, jump, fall, land, climb,
push, celebrate, scared und bomb_reaction.

## Rundenende

Jedes Level endet mit vier Sekunden Feuerwerk und wechselt automatisch weiter.
Am Ende des Sturmpasses setzt NURI den Kern ein und aktiviert das
Leuchtfeuer. Die letzte entscheidende Hilfe wird gewürdigt. Erfolg bleibt 12
Sekunden, Fehlschlag 8 Sekunden sichtbar; anschließend startet der Automodus
eine neue Seed-Runde.

Die drei Regionen sind Tal/Waldruinen, Neonhöhlen/Maschinendecks und
Sturmpass/Himmelsruinen. Ihre Segmentfolgen sind deterministisch.


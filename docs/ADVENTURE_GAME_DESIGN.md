# Adventure Game Design

## Ziel

NURI bringt einen leuchtenden Energiekern zum Himmelsleuchtfeuer, bevor 4:30
Minuten ablaufen. Die einzelne Figur läuft automatisch, reagiert animiert auf
Hindernisse und wartet auf klar benannte Zuschauerhilfe.

## Kernschleife

Laufen → Hindernis erkennen → anhalten und zeigen → Geschenkaktion sichtbar
ausführen → weiterlaufen. An einer Abzweigung stimmt der Chat zehn Sekunden mit
`links`, `rechts`, `1` oder `2` ab.

## Darstellung

Das MVP ist eine kontrollierte Phaser-2D-Seitenansicht in einem 720×960
Hochkant-Block. Parallax-Berge, Waldsilhouetten, definierte Plattformen,
Brücken, Bausteine und Tore sind prozedurale saubere Platzhalter. Es gibt keine
3D-Geometrie und kein Versprechen fertiger Concept Art.

NURI besteht aus separat bewegten Kopf-, Körper-, Arm- und Beinteilen. Sichtbar
unterstützte Animationen: idle, run, wait, point, jump, fall, land, climb,
push, celebrate, scared und bomb_reaction.

## Rundenende

Am Gipfel setzt NURI den Kern ein und aktiviert das Leuchtfeuer. Die letzte
entscheidende Hilfe wird gewürdigt. Erfolg bleibt 12 Sekunden, Fehlschlag 8
Sekunden sichtbar; anschließend startet der Automodus eine neue Seed-Runde.


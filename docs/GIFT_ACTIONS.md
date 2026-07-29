# Geschenkaktionen

| Geschenk | Interne Aktion | Sichtbare Wirkung |
| --- | --- | --- |
| Rose | `jump` | ein kontrollierter Sprung |
| Doughnut | `build_blocks_3` | drei Bauteile nacheinander |
| Hand Heart | `build_bridge` | vollständige Energiebrücke |
| Corgi | `helper` | Helfer repariert oder rettet |
| Galaxy | `tsar_bomb` | **ZAR-BOMBE** |

Nur die Bezeichnung **ZAR-BOMBE** ist zulässig. Galaxy startet
Absenderanzeige, Warnung, drei Sekunden Countdown, Fall, Einschlag und
`TEAM REBUILD`. Die Bombe hat 60 Sekunden Cooldown, läuft pro Transaktion
höchstens einmal und wird in Intro, Ergebnis, laufender Bombensequenz oder Safe
Mode blockiert.

Likes füllen Team-Energie. Bei 100 Prozent gibt es eine kleine kostenlose
passende Hilfe. Follows geben drei Sekunden Zeit; Shares geben größere
Team-Energie. Keine freie Interaktion kann die ZAR-BOMBE auslösen.

Fallback-Icons:

```text
/assets/gifts/fallback/rose.png
/assets/gifts/fallback/doughnut.png
/assets/gifts/fallback/hand-heart.png
/assets/gifts/fallback/corgi.png
/assets/gifts/fallback/galaxy.png
```

Der Renderer verwendet `contain`-ähnliche unverzerrte Bildskalierung. Slots
sind mindestens 64×64, der aktuelle Bedarf mindestens 96×96 Pixel.


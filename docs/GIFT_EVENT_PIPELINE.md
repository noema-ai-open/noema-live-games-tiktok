# Gift-Event-Pipeline

GiftEvents und ChatEvents sind strikt getrennt. Geschenkaktionen werden nie
aus normalem Chattext geraten.

1. Connector normalisiert das Event.
2. `GiftStreakTracker` dedupliziert Event-IDs und finalisiert Streaks.
3. `RulesEngine` löst `giftId`, danach den exakten normalisierten Namen auf.
4. Unbekannte Geschenke werden protokolliert und bleiben inert.
5. `PriorityInbox` priorisiert Galaxy vor Support und freien Interaktionen.
6. `LiveSession` übergibt Befehle an die deterministische Command Queue.
7. `AdventureSimulation` prüft Zustand und aktuelles Hindernis.

Eine Gifttransaktion erzeugt höchstens eine finale Wirkung. Coinwerte werden
für Diagnose und Feedback mitgeführt, aber niemals für die Aktionswahl benutzt.
Aktuelle Bridge-Icon-URLs werden bevorzugt; der HUD-Loader fällt bei Fehlern
auf lokale transparente PNGs zurück.


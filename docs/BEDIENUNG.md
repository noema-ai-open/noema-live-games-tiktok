# NOEMA-AI Ascent — Bedienung

Anleitung für den Betrieb im Stream. Keine Programmierkenntnisse nötig.

## Das Spielprinzip in vier Sätzen

Rund 30 kleine Roboter laufen von unten nach oben durch einen beschädigten
Turm. Sie laufen von allein — niemand steuert sie direkt. Eine Runde dauert
vier Minuten, und das Team hat gewonnen, wenn mindestens 21 von 30 oben
ankommen. Die Zuschauer helfen oder sabotieren mit Likes und Geschenken.

Es gibt zwei Wege nach oben:

- **Blau = sicherer Weg.** Langsamer, aber mit Aufzug und Kontrollpunkten.
- **Rot = riskanter Weg.** Schneller, führt aber über eine Lücke. Ohne Brücke
  fallen die Roboter dort hinunter.

Jeder fünfte Roboter nimmt den riskanten Weg. Deshalb ist die Brücke früh im
Stream meistens das Wichtigste.

## Ein Stream von Anfang bis Ende

1. **NOEMA TikTok Live Bridge starten** und dort den öffentlichen TikTok-Namen
   eintragen. Ohne Bridge kommen keine echten Geschenke an.
2. **NOEMA-AI Ascent starten** — Startmenü, Verknüpfung anklicken. Ein
   schwarzes Fenster geht auf. Das ist der Server, es muss offen bleiben.
   Zusätzlich öffnet sich der Browser mit der Steuerung.
3. Im Startbildschirm auf **Live Bridge verbinden** → **Verbinden & Runde
   starten**.
4. Im schwarzen Fenster steht die **Stream-Adresse**. Die kommt in TikTok LIVE
   Studio unter *Quelle hinzufügen → Link*, Größe **720 × 1280**.
5. Das **Operator-Fenster** im Browser daneben offen lassen. Da steuerst du.

Zum Testen ohne Zuschauer: im Startbildschirm auf **Offline testen**. Dann
erzeugt das Spiel selbst Ereignisse.

## Was die Zuschauer sehen und tun

Wichtig zu verstehen: **Das Spielbild ist nicht antippbar.** Es ist ein Video.
Die Zuschauer benutzen den normalen Geschenk-Knopf von TikTok. Deshalb steht
unten rechts im Bild eine Legende, welches Geschenk was bewirkt.

Diese Legende wird automatisch aus deiner Zuordnung erzeugt. Änderst du die
Zuordnung, ändert sich auch die Legende.

Wenn jemand etwas schickt, erscheint links unten sofort eine Meldung mit
seinem Namen, dem Geschenk und der ausgelösten Wirkung. Das ist die Belohnung
für den Absender — er sieht schwarz auf weiß, dass sein Geschenk angekommen
ist.

## Wer was auslöst (Standardeinstellung)

| Geschenk | Wirkung |
| --- | --- |
| Rose | Reparatur — baut Beschädigtes wieder auf, auch die Brücke |
| Finger Heart | Team-Energie |
| Bridge Crate | Brücke über die Lücke |
| Jump Pad | Sprungfeld, ersetzt die Brücke vorübergehend |
| Lift Core | Lift-Overdrive, der Aufzug fährt doppelt so schnell |
| Rescue Drone | Rettet einen fallenden Roboter |
| Team Aegis | Team-Schild, alle Roboter sind kurz unverwundbar |
| Crosswind | Sturm — Sabotage, drückt die Roboter zur Seite |
| Fault Line | Erdbeben — Sabotage, wirft Roboter vom riskanten Weg |
| Galaxy | **ZAR-BOMBE** |

**Kostenlos und trotzdem wichtig:** Likes, Follows und Shares laden die
Team-Energie auf. Ohne einen einzigen Cent kann die Runde gewonnen werden — nur
langsamer. Das ist Absicht.

Grundregel der Balance: Helfen ist billig, Zerstören ist teuer. Sabotage
kostet ein Vielfaches der vergleichbaren Hilfe.

## Die ZAR-BOMBE

Das große Spektakel für das teuerste Geschenk. Ablauf:

1. Alarm, der Name des Absenders erscheint groß: *„[NAME] HAT DIE ZAR-BOMBE
   AKTIVIERT"*
2. Countdown, dann sinkt die Bombe herab
3. Blitz, Druckwelle, Kamerawackeln, Trümmer
4. Ungefähr die Hälfte der gebauten Sachen wird zerstört, Roboter werden
   zurückgeworfen
5. **Geschützte Roboter überleben sichtbar** — wer vorher ein Team-Schild
   geschickt hat, sieht seinen Beitrag wirken
6. Danach läuft die **TEAM-REBUILD-Phase**: 25 Sekunden lang zählt jede
   Reparatur doppelt

Die Runde ist danach **nicht** vorbei. Kontrollpunkte bleiben erhalten. Das ist
bewusst so: Ein einzelner Spender soll nicht den Stream beenden können, sondern
für mehr Aufregung sorgen.

Danach 60 Sekunden Abklingzeit — in der Zeit geht keine zweite.

## Das Operator-Fenster

Das siehst nur du, nie die Zuschauer.

**Verbindung** — welche Quelle läuft, wie viele Ereignisse pro Sekunde
ankommen, welches Ereignis zuletzt kam. Steht dort *Live verbunden*, ist alles
in Ordnung.

**Runde** — Starten, Pause, Weiter, Zurücksetzen. Das Feld *Seed* legt den
Zufall fest; gleicher Seed heißt gleicher Rundenverlauf.

**Die drei Schalter:**

- **Safe Mode** — blockiert alles Zerstörerische, auch die ZAR-BOMBE. Der
  Notaus, wenn eine Runde entgleist.
- **Reduced Motion** — deutlich weniger Blitze und Kamerawackeln. Wenn dir vom
  Bild schlecht wird oder du einen ruhigen Stream willst.
- **Stumm** — Ton aus. Daneben der Lautstärkeregler.

**Testereignisse** — löst Geschenke aus, ohne dass jemand etwas schicken muss.
Zum Ausprobieren vor dem Stream. „Rose-Serie ×5 senden" testet, ob eine
Geschenkserie richtig als *eine* zusammengefasst wird.

**Geschenk → Wirkung** — die Zuordnungstabelle. Hier kannst du jedem Geschenk
eine andere Wirkung geben, die Stärke ändern, eine Abklingzeit setzen oder es
ganz abschalten. Wird sofort gespeichert.

**Unbekannte Geschenke** — TikTok ändert seinen Geschenkkatalog. Kommt ein
Geschenk an, das du noch nicht zugeordnet hast, passiert im Spiel **nichts**
(kein Zufallseffekt!), aber es landet hier in der Liste. Ein Klick auf
*Übernehmen*, dann kannst du ihm eine Wirkung geben.

**Replay** — spielt die letzte Runde noch einmal exakt nach. Nützlich, wenn
etwas komisch aussah und du wissen willst, ob es an dir oder am Spiel lag.

## Wenn etwas nicht stimmt

**Keine Ereignisse, obwohl Zuschauer da sind**
Läuft die Bridge? Sie muss auf demselben Rechner laufen. Steht im Operator
*Live verbunden* oder *Reconnect*?

**Ein Geschenk bewirkt nichts**
Wahrscheinlich unbekannt. Schau unter *Unbekannte Geschenke* nach.

**Das schwarze Fenster ist zu**
Dann läuft der Server nicht mehr und das Stream-Bild bleibt stehen.
Verknüpfung neu anklicken. Im Protokoll unter
`%LOCALAPPDATA%\NOEMA\Ascent\start.log` steht, was passiert ist.

**Die Runde ist vorbei und es geht nicht weiter**
Im Operator auf *Runde starten*. Eine neue Runde beginnt sofort.

## Was du im Stream nie sagen solltest

Keine Versprechen über Geld, Preise, Gewinne oder Rückzahlungen für Geschenke.
Das Spiel liefert Unterhaltung, sonst nichts. Und keine Behauptung, man könne
im Bild etwas antippen — das geht technisch nicht.

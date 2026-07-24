# Feature: Timer und Defi-Steuerung am Trainee-Monitor

## Why

Im Training bedienen die Teilnehmenden einen echten corpuls1. Der Simulator zeigt
bisher nur den Patientenmonitor an – die Defi-Bedienung (Laden/Schock) und der
Reanimationszeit-Timer liegen allein beim Instructor. Damit Teilnehmende den
kompletten Ablauf am eigenen Gerät üben (Zeit nehmen, Laden, Schock abgeben),
bekommt der Trainee-Monitor eine eigene, gerätenahe Bedienung. Die neue Bedienung
läuft rein lokal im Browser des jeweiligen Endgeräts – ohne Server, ohne Auswirkung
auf andere Monitore oder den Admin. Im selben Zug entfällt die bisherige,
admin-getriggerte Spike-Auslösung (der „Schock-Spike"-Button im Admin und das
zugehörige SSE-`spike`-Event samt Command), da die Defibrillation nun am Endgerät
stattfindet.

## Success criteria

- Auf dem Trainee-Monitor (`mode="MONITOR"`) gibt es einen Timer mit Start/Stop
  sowie einen Laden → Schock-Ablauf (mit „Abbrechen" als Alternative zum Schock),
  erreichbar auch im Vollbildmodus.
- Ein lokal ausgelöster Schock erzeugt exakt dasselbe Spike-Artefakt auf den Kurven
  wie das bisher vom Server ausgelöste `spike`-Event (unveränderte Rendering-Logik).
- Timer, Laden, Schock und Töne funktionieren vollständig ohne Netzwerk und
  verändern weder `SessionState`, das Auth-Modell noch andere Geräte in der Sitzung.
- Der Admin-Mirror und die Monitore anderer Teilnehmender bleiben von der Bedienung
  eines Endgeräts unberührt.
- Der „Schock-Spike"-Button ist aus dem Admin verschwunden; `spike` ist keine
  gültige Command mehr und wird nicht mehr über die SSE-Verbindung gesendet.

## Non-goals

- Keine Synchronisation: der Timer ist pro Gerät, ein Schock spiked nur den eigenen
  Monitor. (Bewusste Produktentscheidung, siehe Implementation decisions.)
- Keine Energiewahl (Joule), kein AED-Modus, kein Schrittmacher, keine Analyse-Taste.
- Kein Einfluss des Schocks auf den Rhythmus (der Rhythmus bleibt instructor-gesteuert;
  der Spike ist wie bisher rein kosmetisch).
- Keine Bedienung im Admin-Mirror.
- Kein separater „Schock-abgegeben"-Ton; die laufenden Töne enden bei Schock/Abbrechen.

## Constraints

- Die Bedienung darf die bestehende Sweep-Renderschleife in `Waveforms` nicht stören:
  der lokale Schock löst den Spike ausschließlich über den vorhandenen
  `spikeNonce`-Mechanismus aus (Wert ändern → `spikeStart` wird neu gesetzt). Der
  `spikeNonce` wird nach dem Umbau rein lokal auf dem Monitor erzeugt.
- Audio darf erst nach einer Nutzergeste starten (Browser-Autoplay-Policy). Der
  `AudioContext` wird konkret beim Laden-Tap erzeugt/`resume()`d – kein früheres
  Freischalten (z. B. beim Timer-Start) nötig.
- Animationen (pulsierende Schock-Taste, Ladespinner) respektieren
  `prefers-reduced-motion`.

## Preconditions

- Bestehender geteilter `DeviceScreen` (gerendert von `MonitorView` und dem
  Admin-Mirror), bestehendes `Waveforms` mit `spikeNonce`-Prop und die bestehende
  Spike-Artefakt-Abtastung in `waveform.ts` (`ekgFrameSample`/`secondsSinceSpike`) –
  diese Rendering-Bausteine bleiben und werden weiterverwendet.

## Domain

### Ubiquitous language

- **Endgerät** – der Trainee-Monitor (`MonitorView`/`DeviceScreen` in `mode="MONITOR"`),
  ein Browser auf dem Gerät eines Teilnehmenden. Träger der neuen Bedienung.
- **Timer** – lokale Stoppuhr für die Reanimationszeit, zählt ab `00:00` hoch.
- **Laden** – startet den 5,5-Sekunden-Ladevorgang des Defis.
- **Schockbereit / geladen** – Zustand nach abgeschlossenem Laden, in dem der Schock
  ausgelöst werden kann.
- **Schock** – löst lokal den Defi-Spike auf den Kurven des eigenen Monitors aus.
- **Abbrechen (Entladen)** – verwirft den geladenen Zustand ohne Schock.
- **Spike** – der einmalige Defi-Ausschlag auf der Kurve; bestehendes Rendering-Konzept,
  nach dem Umbau ausschließlich lokal vom Endgerät ausgelöst (die frühere Server-/
  Admin-Auslösung entfällt).

### Roles

- **Teilnehmende:r (Trainee)** – bedient am eigenen Endgerät Timer und Defi. Hält
  keinen Admin-Token; alle Aktionen sind rein lokal und erreichen den Server nicht.

### Work objects

- **Timer-Zustand** – `{ running: boolean, elapsedSeconds: number }`. Lokal, flüchtig.
  Stop setzt `elapsedSeconds` auf `0` zurück (zwei Zustände, kein separater Reset).
- **Defi-Zustand** – Zustandsautomat mit den Zuständen `idle → charging → armed` und
  aus `armed` zurück nach `idle` (per Schock oder Abbrechen). Lokal, flüchtig.
  Invarianten: Laden nur aus `idle`; `charging` läuft immer bis `armed` durch (kein
  Abbruch während des Ladens); Schock und Abbrechen nur in `armed`.

## User Stories

- **US-1 · Als** Teilnehmende:r **möchte ich** am Endgerät einen Timer starten und
  stoppen, **damit** ich die Reanimationszeit selbst nehmen kann.
  - given der Timer ist gestoppt (Anzeige `00:00`, Taste „Start"), when ich „Start"
    drücke, then zählt die Anzeige sekündlich hoch und die Taste zeigt „Stop".
  - given der Timer läuft (z. B. `01:47`), when ich „Stop" drücke, then stoppt der
    Timer und die Anzeige springt sofort auf `00:00` zurück; die Taste zeigt „Start".
  - given der Timer läuft über 60 s hinaus, then zählt die Minutenstelle im stets
    gleichen `mm:ss`-Format weiter (z. B. `01:03`), ohne Minuten-Obergrenze.
  - _Why: „Stop = Reset auf 0" ist eine bewusste Nutzerentscheidung, kein Default._

- **US-2 · Als** Teilnehmende:r **möchte ich** den Defi laden, **damit** ich ihn für
  einen Schock vorbereite.
  - given `idle`, when ich „Laden" drücke, then wechselt der Defi nach `charging`,
    zeigt 5,5 s lang eine Ladeanzeige (Spinner mit „Lädt…", ohne Sekunden-Countdown)
    und die Schock-Taste ist deaktiviert.
  - given `charging`, when die 5,5 s abgelaufen sind, then wechselt der Defi nach
    `armed` und die Schock-Taste wird aktiv.
  - given `charging`, then ist „Laden" nicht erneut auslösbar (durch die Ladeanzeige
    ersetzt).

- **US-3 · Als** Teilnehmende:r **möchte ich** im geladenen Zustand einen Schock
  abgeben, **damit** derselbe Defi-Ausschlag auf meinem Monitor erscheint wie beim
  echten Gerät.
  - given `armed`, when ich „Schock" drücke, then erscheint das Spike-Artefakt auf
    den Kurven meines Monitors (dasselbe Artefakt wie beim bisherigen Server-`spike`)
    und der Defi kehrt nach `idle` zurück (für den nächsten Schock muss erneut geladen
    werden).
  - given `idle` oder `charging`, then ist die Schock-Taste deaktiviert und ein
    Schock nicht auslösbar.
  - given ein Schock, then wird der Spike ausschließlich lokal ausgelöst und erreicht
    weder den Server noch andere Geräte.

- **US-4 · Als** Teilnehmende:r **möchte ich** einen geladenen Defi wieder entladen,
  **damit** ich einen vorbereiteten Schock verwerfen kann.
  - given `armed`, when ich „Abbrechen" drücke, then kehrt der Defi ohne Spike nach
    `idle` zurück.
  - given `armed` und es wird nicht geschockt/abgebrochen, then bleibt der Defi
    unbegrenzt `armed` (kein automatisches Entladen).

- **US-5 · Als** Teilnehmende:r **möchte ich** Lade- und Bereit-Töne hören, **damit**
  sich der Ablauf wie am echten Defi anfühlt.
  - given ich drücke „Laden", when der Ladevorgang läuft, then ertönt 5,5 s lang ein
    ansteigender Ladeton.
  - given der Defi ist `armed`, then ertönt ein durchgehender Bereit-Ton.
  - given ich drücke „Schock" oder „Abbrechen", then enden alle Töne sofort (kein
    separater Schock-Ton).
  - _Why: die Töne wurden ausdrücklich gewünscht (Trainingsrealismus); die Laden-Geste
    schaltet Audio browserseitig frei._

- **US-6 · Als** Teilnehmende:r **möchte ich** die Bedienung auch im Vollbildmodus
  nutzen, **damit** ich das Gerät wie im Einsatz bediene.
  - given der Monitor ist im Vollbildmodus, then sind Timer und Therapie-Spalte
    weiterhin sichtbar und bedienbar (sie liegen innerhalb des `DeviceScreen`).

- **US-7 · Als** Instructor **möchte ich**, dass der Admin-Mirror unverändert bleibt,
  **damit** die Endgeräte-Bedienung meine Steuerung nicht stört.
  - given ein Endgerät bedient Timer/Laden/Schock, then zeigt der Admin-Mirror weder
    diese Bedienelemente noch den lokalen Spike; `SessionState` ändert sich nicht.
  - given `mode="ADMIN"`, then werden Timer und Therapie-Spalte nicht gerendert.

- **US-8 · Als** Instructor **möchte ich**, dass der überflüssige „Schock-Spike"-Weg
  vollständig entfernt wird, **damit** die Defibrillation eindeutig am Endgerät liegt
  und keine tote Steuerung zurückbleibt.
  - given das Admin-Panel, then existiert kein „Schock-Spike"-Button mehr (Block
    „Reanimation" enthält nur noch „Drückt").
  - given ein Control-Request mit `{ type: "spike" }`, when er `parseCommand`/den
    Control-Endpunkt erreicht, then wird er als ungültig abgewiesen (kein Broadcast).
  - given eine offene SSE-Verbindung, then wird nie ein `spike`-Event gesendet; die
    verbleibenden Events (`state`, `ended`, Keepalive-`touch`) bleiben unverändert.
  - given `useSessionStream`, then liefert es kein `spikeNonce` mehr aus Server-Events;
    das Interface wird entsprechend bereinigt.
  - _Why: Nutzerentscheidung – die admin-getriggerte Spike-Auslösung wird durch die
    lokale Endgeräte-Bedienung ersetzt und im selben Zug ausgebaut._

## Design

Bedienung sitzt im geteilten `DeviceScreen`, gerendert nur bei `mode="MONITOR"`.
Verbindliche Referenz für Layout und Zustände ist der abgestimmte Mockup
(corpuls1-nahe Variante, rechte Therapie-Spalte). Farb- und Größensystem folgt den
bestehenden Monitor-Tokens (`globals.css`) und den Container-Query-Einheiten des
`DeviceScreen`.

- **Timer** – in der oberen Statusleiste (`.topbar`), zwischen `II`/Uhr eingeordnet,
  wie die Ereigniszeit am corpuls1. Bestandteile: Start/Stop-Taste (Label wechselt
  „Start"/„Stop") plus `mm:ss`-Anzeige (`Barlow Condensed`, tabular-nums, grün wenn
  laufend). Neue kleine Komponente; die bestehende `Clock` bleibt daneben unverändert.
- **Therapie-Spalte** – neue dritte Spalte rechts im `.body`-Grid
  (`Kurven | Zahlen | Therapie`); die Vitalwerte bleiben an ihrer Stelle. Als
  abgesetztes Panel (heller Bezel, `border-left`) mit den Zuständen:
  - `idle`: Taste „Laden" (bernstein) + deaktivierte „Schock"-Taste (rot, Herz-Symbol).
  - `charging`: Ladeanzeige (Spinner mit „Lädt…") + weiterhin deaktivierte „Schock".
  - `armed`: aktive „Schock"-Taste (rot, pulsierend, Herz) + „Abbrechen" (Ghost).
  - _Why: „rechts neben den Kurven" entspricht der Therapietasten-Spalte des echten
    corpuls1 und maximiert den Trainingstransfer – Nutzerentscheidung._
- **Zustände/Feedback** – Ladespinner und Puls-Animation der Schock-Taste
  respektieren `prefers-reduced-motion`. Schock-Taste nutzt echtes `disabled` außer in
  `armed`; Zustandswechsel per `aria`/sichtbarem Label kommunizieren.
- Mockup-Datei ist ein Wegwerf-Artefakt (Scratch) und wird nicht eingecheckt; diese
  Design-Sektion ist die verbindliche Beschreibung.

## Implementation decisions

- **Neue Bedienung rein lokal.** Timer und Defi leben ausschließlich im Client des
  Endgeräts – kein neuer Command, kein neues SSE-Event, keine Änderung an
  `SessionState` oder am Auth-Modell zur Laufzeit. _Why: Nutzerentscheidung („Alles
  lokal") – bewahrt das Kernprinzip „der Code allein kann keinen State pushen"._
- **Schock über den bestehenden `spikeNonce`-Pfad, nun rein lokal.** Der lokale Schock
  erzeugt das Artefakt, indem der an `Waveforms` übergebene `spikeNonce` fortgezählt
  wird. Nach dem Ausbau des Server-`spike` kommt dieser Nonce ausschließlich aus der
  lokalen Defi-Steuerung (in `MonitorView`); der Admin-Mirror übergibt keinen
  `spikeNonce` mehr. _Why: ein einziger Renderpfad; „gleicher Spike-Effekt" ist per
  Konstruktion garantiert._
- **Ausbau des admin-getriggerten Spikes (US-8).** Entfernt wird: der `spike`-Zweig in
  `Command`/`parseCommand` (`commands.ts`), die Spike-Behandlung/-Broadcast in
  `store.ts` und der `applyControl`-Zweig, die `spike`-Event-Ausgabe in der
  SSE-Route (`stream/route.ts`) samt Serialisierung in `sse.ts`, der `spike`-Listener
  und das `spikeNonce`-Feld in `useSessionStream`, sowie der „Schock-Spike"-Button in
  `AdminView` (inkl. zugehöriger CSS-Klassen). Die betroffenen Tests
  (`commands.test.ts`, `store.test.ts`, `sse.test.ts`, `control/route.test.ts`,
  `useSessionStream.test.tsx`, `AdminView.test.tsx`, `MonitorView.test.tsx`) werden im
  Zuge des TDD angepasst bzw. entrümpelt. `waveform.ts`/`Waveforms` und deren Spike-
  Rendering bleiben unangetastet.
- **Reine Logikmodule mit injizierter Zeit.** Timer-Logik und Defi-Zustandsautomat
  (`idle → charging → armed → idle`) kommen als reine Module nach `src/lib/` mit
  injizierten Zeit-Dependencies – analog zu `createStore(deps)` in `store.ts` – und
  werden dort direkt unit-getestet (TDD, `test()`). Die React-Anbindung (Hook +
  Darstellung im `DeviceScreen`) bleibt dünn. _Why: bestehende Projektkonvention –
  pure Logik in `src/lib`, testbar ohne DOM/Canvas._
- **Ladezeit als Konstante 5,5 s.** _Why: entspricht dem Datenblatt des echten
  corpuls1 (Ladezeit ca. 5,5 s) – Nutzerentscheidung für Gerätetreue._
- **Töne synthetisiert per Web Audio.** Ansteigender Ladeton (Oszillator, Frequenz
  rampt über die 5,5 s) und durchgehender Bereit-Ton; keine Audiodateien.
  `AudioContext` wird beim Laden-Tap erzeugt/`resume()`d; alle Töne werden bei
  Schock/Abbrechen sowie beim Unmount gestoppt. _Why: erfüllt den Ton-Wunsch ohne
  Assets/CSP-Themen und ohne Autoplay-Verstoß._
- **Nur `mode="MONITOR"`.** Bedienung wird im Admin-Mirror nicht gerendert. _Why: es
  ist ein Endgeräte-Feature; der Mirror spiegelt synchronisierten State, diese
  Bedienung ist lokal._
- **Kein automatisches Entladen, kein separater Schock-Ton.** Defensible Defaults im
  Rahmen der bestätigten Nutzerentscheidungen (armed bleibt bis Schock/Abbrechen).

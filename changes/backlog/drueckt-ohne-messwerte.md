---
effort: XS
value: M
---

# Während „Drückt“: keine HF, kein SpO2, kein Puls

Solange „Drückt“ läuft, soll der Monitor keine HF, kein SpO2 und keinen Puls anzeigen.

Heute zeigt er dabei weiter die Werte des Rhythmus aus dem Katalog, zum Beispiel HF 150 bei einer Kammertachykardie. Die Werte kommen aus `monitorReadout` (`src/lib/readout.ts:17`). Diese Funktion beachtet nur die Module und den Rhythmus, `state.drueckt` liest sie nicht. Monitor und Admin-Spiegel nutzen dieselbe Funktion (`src/components/DeviceScreen.tsx:28`).

Die EKG-Kurve wechselt während „Drückt“ schon zum Kompressionsartefakt (`ekgFrameSample`, `src/lib/waveform.ts:126`). Die Pleth-Kurve beachtet `drueckt` nicht (`plethFrameSample`, `src/lib/waveform.ts:131`).

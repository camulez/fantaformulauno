# Direzione artistica — FantaFormula1

## Cos'è

Fantacampionato di Formula 1 fra sei amici, attivo da vent'anni. Si consulta a raffica nel
weekend di gara e quasi mai fra un GP e l'altro: sessioni brevi, uso volontario, errori che
non costano nulla. Web app Next.js + Tailwind, mobile-first, dietro PIN.

## Tesi

> **Il muretto dei box a fine gara: telemetria su carbonio, numeri che si accendono come una
> torre dei tempi.**

Ogni decisione qui sotto discende da questa frase. Se una scelta non si giustifica con essa,
è decorazione e va tolta.

## Registri per schermata

| Schermata | Registro | Perché |
|---|---|---|
| `/report/[n]` | **vetrina · IL MOMENTO** | com'è andata la tua gara: è ciò che si mostra agli altri |
| `/classifica`, `/asta` | vetrina | graduatoria e tabellone: si guardano insieme, cambiano poco |
| `/login` | vetrina | prima impressione, zero dati |
| `/`, `/round/[n]`, `/squadra/*`, `/storico*`, `/statistiche`, `/bacheca`, `/profilo`, `/report` | quotidiana | identità, non decorazione |
| `/inserisci`, `/valori`, `/impostazioni` | **strumento** | inserimento dati denso: il budget va sulla leggibilità |
| `/simulatore` | linguaggio proprio | scena 3D: si allineano solo i contorni (griglia, HUD, schermate) |

**Un solo momento**: `/report/[n]`. Le altre vetrine sono ricche, ma il trattamento pieno
(composizione non lineare + movimento firma completo) sta lì.

## Tipografia

- **Display**: Chakra Petch — condensata, tecnica, da cartello di circuito. Titoli, etichette
  in maiuscolo con `tracking` largo.
- **Numeri**: JetBrains Mono **sempre**, con `font-variant-numeric: tabular-nums`. In una
  torre dei tempi le cifre devono incolonnarsi: è la regola tipografica non negoziabile di
  questa app.
- Scala fluida `--text-*` da `2xs` a `7xl`. Rapporto h1/corpo: 3× nelle quotidiane, ≥ 4× sul
  momento e sulle vetrine.

## Colore

Palette esistente, confermata (era la parte già fatta bene):

- **carbonio** `#08090a → #171c21` — quattro livelli di superficie, non uno.
- **acid lime** `#c6ff3a` — il LED. Si usa per *un solo* dato per volta: il valore che conta.
  Se è ovunque non significa più niente.
- **osso** `#eef3f1` / `#8a969c` — testo e testo secondario.
- **ambra** `#ffb020` e **rosso** `#ff2e43` — solo stati (attenzione, penalità, freno).

## Forma

- **Angolo tagliato in alto a destra** (`--chamfer`) sulle superfici primarie: è la firma
  formale, richiama un pannello di cronometraggio. Non su tutto: solo sulle card principali.
- Raggi contenuti (`--radius-*`), niente pillole tonde tranne i chip di stato.
- **Filo acid a sinistra** (`.accent-bar`) sulle superfici che portano il dato principale.

## Materia

Elevazione in tema scuro = **superficie più chiara + luce dal bordo alto**, non ombre nere
(su un fondo quasi nero un'ombra non si vede — errore già commesso in questo progetto).
Tre livelli: `--elev-1` piano, `--elev-2` card, `--elev-3` overlay.

## Movimento

- **Firma: l'accensione a cascata.** Righe e valori entrano in sequenza con 40 ms di passo,
  come una torre dei tempi che si popola. Ricorre in classifica, nel report e nella lista
  round. È l'unico movimento firma dell'app.
- Movimento funzionale (non firma): `.tile-snap` quando un pezzo si incastra nel garage
  all'asta — è una conferma d'azione, non decorazione.
- Durate da token: `--dur-1` 140 ms (stati), `--dur-2` 260 ms (entrate), `--dur-3` 420 ms
  (momento). Easing `--ease-out` e `--ease-spring`.
- `prefers-reduced-motion`: le animazioni si annullano **mantenendo il contenuto visibile**
  (opacità finale 1, nessuna traslazione).

## Icone

Nessuna libreria: SVG a mano in `components/icons.tsx`, tratto 1.6, stile lineare coerente.
Le emoji non si usano come icone. Scelta deliberata: evita una dipendenza e mantiene lo stile
già stabilito.

## Regole che non si discutono

1. I numeri sono sempre monospaziati e tabulari.
2. L'acid lime marca un solo dato per schermata.
3. Nessuna nuova dipendenza per il design.
4. Server Components di default; il movimento è CSS, non JavaScript.
5. Il contenuto esiste anche senza JavaScript e con movimento ridotto.

## Misure prima / dopo

| | prima | dopo |
|---|---|---|
| token colore | 11 | 11 (invariati, erano già buoni) |
| token spaziatura | **0** | 8 |
| token tipografia | **0** | 10 |
| token elevazione | **0** | 3 |
| token durate / easing | **0 / 0** | 4 / 3 |
| token forma | **0** | 8 |
| rapporto tipografico massimo | 3.00× | 5.60× (vetrina) |
| copertura stati loading / error | 0 / 20 | **20 / 20** |
| `not-found` / `global-error` | assenti | presenti |
| emoji usate come icone | 14 | **0** |
| stringhe di classi duplicate ≥ 3× | 26 | 24 |

## Verifica finale (misurata a schermo, non dichiarata)

| Controllo | Come | Esito |
|---|---|---|
| Contrasto sul DOM **renderizzato** | luminanza relativa calcolata su 167 nodi di testo, sfondo risalito nell'albero, soglia 4.5 (3 per il testo grande) | **0 sotto soglia** |
| Overflow orizzontale a 390 / 768 / 1280 px | `scrollWidth > clientWidth` + nodi oltre il bordo | **0 a tutti e tre** |
| Movimento ridotto | animazioni annullate a runtime, poi misurata opacità e trasform dei 10 elementi animati | **0 invisibili** — il contenuto resta leggibile |
| Console | `read_console_messages(onlyErrors)` | **pulita** |
| Peso | dipendenze invariate (`next, react, react-dom, three`), nessun JS aggiunto; **CSS globale 8,1 KB gzip** in totale | ben dentro +15 KB |
| Motore di punteggio | `gate.check.ts` 778 / 634 / 558 / 285 · `report.check.ts` 102 test · simulatore 33 test + 24/24 circuiti | **verdi** |

**Nota onesta sulle stringhe duplicate**: la duplicazione è scesa poco perché solo tre schermate
(home, classifica, report del round) sono state riscritte sulle primitive di `components/ui.tsx`.
Le altre ereditano token, materia e tipografia — cambiano aspetto — ma conservano il loro
markup. Convertirle è lavoro meccanico rimasto in coda, non un difetto di direzione.

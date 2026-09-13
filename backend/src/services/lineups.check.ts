// Test della formazione di gara. Esegui: cd backend && npx tsx src/services/lineups.check.ts
//
// Il test che conta è il primo: modificare UNA scuderia non deve svuotare le altre.
// Era il difetto vero — bastava una riga scritta perché tutte le altre restassero senza
// piloti e senza punti costruttore, senza che nulla lo segnalasse.
import {
  mergeLineups,
  validaFormazione,
  scuderieModificate,
  cambiScuderia,
  catenaSostituzioni,
  sostitutoSpettante,
  assentiDalRound,
  organicoDiAnagrafica,
  formazioneEffettiva,
  formazioneEreditata,
  puntiSenzaScuderia,
  RigaScritta,
  Lineup,
  LineupRow,
} from './lineups';

let pass = 0;
let fail = 0;
function check(nome: string, cond: boolean, extra?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error('  ✗ ' + nome + (extra ? '  → ' + extra : ''));
  }
}

// Anagrafica semplificata (i nomi al posto degli id, per leggibilità del test).
const anagrafica: Lineup = {
  redbull: ['verstappen', 'hadjar'],
  racingbulls: ['lawson', 'lindblad'],
  ferrari: ['leclerc', 'hamilton'],
  mclaren: ['piastri', 'norris'],
};

// ── 1. Nessuna modifica: si resta all'anagrafica ──
{
  const m = mergeLineups(anagrafica, []);
  check('senza righe scritte vale l\'anagrafica', JSON.stringify(m) === JSON.stringify(anagrafica));
}

// ── 2. IL DIFETTO: modificarne una non deve toccare le altre ──
{
  const soloRedBull: LineupRow[] = [
    { fia_team_id: 'redbull', driver_id: 'verstappen' },
    { fia_team_id: 'redbull', driver_id: 'lawson' },
  ];
  const m = mergeLineups(anagrafica, soloRedBull);
  check('la scuderia modificata cambia', m.redbull.join() === 'verstappen,lawson', m.redbull?.join());
  check('Ferrari resta intatta', m.ferrari?.join() === 'leclerc,hamilton', String(m.ferrari));
  check('McLaren resta intatta', m.mclaren?.join() === 'piastri,norris', String(m.mclaren));
  check('Racing Bulls resta intatta', m.racingbulls?.join() === 'lawson,lindblad', String(m.racingbulls));
  check('nessuna scuderia sparisce', Object.keys(m).length === Object.keys(anagrafica).length, `${Object.keys(m).length}`);
}

// ── 3. IL CASO VERO: GP d'Olanda 2026 ──
// Hadjar fuori, Lawson in Red Bull; al posto di Lawson entra Tsunoda in Racing Bulls.
{
  const olanda: LineupRow[] = [
    { fia_team_id: 'redbull', driver_id: 'verstappen' },
    { fia_team_id: 'redbull', driver_id: 'lawson' },
    { fia_team_id: 'racingbulls', driver_id: 'lindblad' },
    { fia_team_id: 'racingbulls', driver_id: 'tsunoda' },
  ];
  check('formazione valida', validaFormazione(olanda) === null);

  const m = mergeLineups(anagrafica, olanda);
  check('Lawson corre per Red Bull', m.redbull.includes('lawson'));
  check('Lawson NON è più fra i piloti Racing Bulls', !m.racingbulls.includes('lawson'), m.racingbulls.join());
  check('Hadjar non corre', !Object.values(m).flat().includes('hadjar'));
  check('Tsunoda corre per Racing Bulls', m.racingbulls.includes('tsunoda'));
  check('le altre due scuderie non si muovono', m.ferrari.join() === 'leclerc,hamilton' && m.mclaren.join() === 'piastri,norris');

  const mod = scuderieModificate(anagrafica, m);
  check('risultano modificate esattamente 2 scuderie', mod.length === 2, mod.join());
}

// ── 4. L'invariante che protegge il punteggio ──
{
  const doppio: LineupRow[] = [
    { fia_team_id: 'redbull', driver_id: 'lawson' },
    { fia_team_id: 'racingbulls', driver_id: 'lawson' },
  ];
  const p = validaFormazione(doppio);
  check('un pilota in due scuderie viene respinto', p?.tipo === 'pilota-doppio', String(p?.tipo));

  const troppi: LineupRow[] = [
    { fia_team_id: 'redbull', driver_id: 'a' },
    { fia_team_id: 'redbull', driver_id: 'b' },
    { fia_team_id: 'redbull', driver_id: 'c' },
  ];
  check('tre piloti in una scuderia vengono respinti', validaFormazione(troppi)?.tipo === 'troppi-piloti');
}

// ── 5. Tornare all'anagrafica ──
{
  const identica: LineupRow[] = [
    { fia_team_id: 'redbull', driver_id: 'verstappen' },
    { fia_team_id: 'redbull', driver_id: 'hadjar' },
  ];
  const m = mergeLineups(anagrafica, identica);
  check('scrivere l\'organico abituale non conta come modifica', scuderieModificate(anagrafica, m).length === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Art. II — la catena delle sostituzioni
// ─────────────────────────────────────────────────────────────────────────────

// Proprietà: Hadjar è di zippo, Lawson è di Pio, gli altri di nessuno.
const proprietari: Record<string, string> = { hadjar: 'zippo', lawson: 'pio', verstappen: 'staiv' };
const proprietarioDi = (d: string) => proprietari[d] ?? null;

// ── 6. Il caso vero: Olanda e Monza 2026 ──
{
  const effettivi = mergeLineups(anagrafica, [
    { fia_team_id: 'redbull', driver_id: 'verstappen' },
    { fia_team_id: 'redbull', driver_id: 'lawson' },
    { fia_team_id: 'racingbulls', driver_id: 'lindblad' },
    { fia_team_id: 'racingbulls', driver_id: 'tsunoda' },
  ]);

  const cambi = cambiScuderia(anagrafica, effettivi);
  check('due sole scuderie cambiate', cambi.length === 2, String(cambi.length));

  const anelli = catenaSostituzioni(anagrafica, effettivi);
  const hadjar = anelli.find((a) => a.assente === 'hadjar');
  check('Hadjar risulta sostituito da Lawson', hadjar?.sostituto === 'lawson', String(hadjar?.sostituto));
  const lawson = anelli.find((a) => a.assente === 'lawson');
  check('Lawson risulta sostituito da Tsunoda', lawson?.sostituto === 'tsunoda', String(lawson?.sostituto));

  // IL TEST CHE INCARNA L'ARTICOLO: zippo non prende Lawson (è di Pio), prende Tsunoda.
  const esito = sostitutoSpettante(anelli, 'hadjar', proprietarioDi);
  check('caso riconosciuto come Art. II.d', esito.caso === 'II.d', esito.caso);
  check('IL SOSTITUTO DEL SOSTITUTO: spetta Tsunoda', esito.spettante === 'tsunoda', String(esito.spettante));
  check('NON si prende Lawson, che è di un altro Team', esito.spettante !== 'lawson');
  check('la catena mostrata è Hadjar → Lawson → Tsunoda',
    esito.percorso.join(' → ') === 'hadjar → lawson → tsunoda', esito.percorso.join(' → '));
  check('dice chi lo blocca', esito.bloccatoDa === 'pio', String(esito.bloccatoDa));
}

// ── 7. Sostituto libero al primo colpo: Art. II.b/II.c ──
{
  const effettivi = mergeLineups(anagrafica, [
    { fia_team_id: 'redbull', driver_id: 'verstappen' },
    { fia_team_id: 'redbull', driver_id: 'bortoleto' },
  ]);
  const esito = sostitutoSpettante(catenaSostituzioni(anagrafica, effettivi), 'hadjar', proprietarioDi);
  check('sostituto di nessuno → Art. II.b/II.c', esito.caso === 'II.bc', esito.caso);
  check('entra subito in squadra', esito.spettante === 'bortoleto', String(esito.spettante));
  check('nessuno lo blocca', esito.bloccatoDa === null);
}

// ── 8. Nessuno lo sostituisce: Art. II.e ──
{
  const effettivi = mergeLineups(anagrafica, [{ fia_team_id: 'redbull', driver_id: 'verstappen' }]);
  const esito = sostitutoSpettante(catenaSostituzioni(anagrafica, effettivi), 'hadjar', proprietarioDi);
  check('nessun sostituto → Art. II.e', esito.caso === 'II.e', esito.caso);
  check('non spetta nessuno', esito.spettante === null);
}

// ── 9. Ambiguità: due fuori e due dentro nella stessa scuderia, l'app NON indovina ──
{
  const effettivi = mergeLineups(anagrafica, [
    { fia_team_id: 'ferrari', driver_id: 'bearman' },
    { fia_team_id: 'ferrari', driver_id: 'bortoleto' },
  ]);
  const anelli = catenaSostituzioni(anagrafica, effettivi);
  const leclerc = anelli.find((a) => a.assente === 'leclerc');
  check('due uscite dalla stessa scuderia = ambiguo', leclerc?.ambiguo === true);
  check('non inventa l\'abbinamento', leclerc?.sostituto === null, String(leclerc?.sostituto));
  const esito = sostitutoSpettante(anelli, 'leclerc', proprietarioDi);
  check('l\'esito è marcato ambiguo', esito.ambiguo === true);
  check('propone i due candidati', esito.candidati.sort().join() === 'bearman,bortoleto', esito.candidati.join());
}

// ── 10. Un ciclo non deve far girare a vuoto ──
{
  const ciclo: Lineup = { a: ['x'], b: ['y'] };
  const scambiati: Lineup = { a: ['y'], b: ['x'] };
  const esito = sostitutoSpettante(
    catenaSostituzioni(ciclo, scambiati),
    'x',
    (d) => (d === 'y' ? 'altroteam' : null)
  );
  check('il ciclo si chiude senza spettante', esito.spettante === null);
  check('la catena resta corta', esito.percorso.length <= 3, esito.percorso.join(' → '));
}

// ── 11. Il sostituto è già un TUO pilota: non lo puoi avere due volte ──
{
  const effettivi = mergeLineups(anagrafica, [
    { fia_team_id: 'redbull', driver_id: 'verstappen' },
    { fia_team_id: 'redbull', driver_id: 'lawson' },
    { fia_team_id: 'racingbulls', driver_id: 'lindblad' },
    { fia_team_id: 'racingbulls', driver_id: 'tsunoda' },
  ]);
  // Se Tsunoda fosse già di zippo, zippo non può metterlo in due slot: non spetta niente.
  const esito = sostitutoSpettante(
    catenaSostituzioni(anagrafica, effettivi),
    'hadjar',
    (d) => ({ lawson: 'pio', tsunoda: 'zippo' } as Record<string, string>)[d] ?? null
  );
  check('un pilota già posseduto non è disponibile come sostituto', esito.spettante === null, String(esito.spettante));
}

// ── 12. CHI CAMBIA MACCHINA NON È ASSENTE ──
// Lawson lascia Racing Bulls ma corre per Red Bull: il suo Team non ha perso niente e non
// deve ricevere nessuna proposta di risarcimento. Trovato provando la rotta sui dati veri:
// senza questo filtro l'app offriva Tsunoda anche a Pio, che aveva già i punti di Lawson.
{
  const effettivi = mergeLineups(anagrafica, [
    { fia_team_id: 'redbull', driver_id: 'verstappen' },
    { fia_team_id: 'redbull', driver_id: 'lawson' },
    { fia_team_id: 'racingbulls', driver_id: 'lindblad' },
    { fia_team_id: 'racingbulls', driver_id: 'tsunoda' },
  ]);
  const assenti = assentiDalRound(anagrafica, effettivi);
  check('Hadjar è assente', assenti.includes('hadjar'));
  check('LAWSON NON È ASSENTE: ha solo cambiato macchina', !assenti.includes('lawson'), assenti.join());
  check('nessun altro risulta assente', assenti.length === 1, assenti.join());

  // La catena continua comunque a passare da Lawson: serve per arrivare a Tsunoda.
  const anelli = catenaSostituzioni(anagrafica, effettivi);
  check('la catena conosce comunque il posto lasciato da Lawson',
    anelli.some((a) => a.assente === 'lawson' && a.sostituto === 'tsunoda'));
}

// ─────────────────────────────────────────────────────────────────────────────
// La formazione si porta avanti — il baco di Madrid (R16, 2026)
// ─────────────────────────────────────────────────────────────────────────────

// Formazioni scritte a Olanda (R14) e Monza (R15), NON a Madrid (R16).
const scambio = (round_no: number): RigaScritta[] => [
  { round_no, fia_team_id: 'redbull', driver_id: 'verstappen' },
  { round_no, fia_team_id: 'redbull', driver_id: 'lawson' },
  { round_no, fia_team_id: 'racingbulls', driver_id: 'lindblad' },
  { round_no, fia_team_id: 'racingbulls', driver_id: 'tsunoda' },
];
const scritte: RigaScritta[] = [...scambio(14), ...scambio(15)];

// ── 13. Le riserve non fanno parte dell'organico di base ──
{
  const org = organicoDiAnagrafica([
    { id: 'lawson', fia_team_id: 'racingbulls', is_reserve: false },
    { id: 'lindblad', fia_team_id: 'racingbulls', is_reserve: false },
    { id: 'tsunoda', fia_team_id: 'racingbulls', is_reserve: true },
    { id: 'senzascuderia', fia_team_id: null, is_reserve: false },
  ]);
  check('Racing Bulls ha DUE piloti di base, non tre', org.racingbulls?.length === 2, String(org.racingbulls));
  check('la riserva non è nell\'organico di base', !org.racingbulls.includes('tsunoda'));
}

// ── 14. IL BACO DI MADRID: R16 eredita la formazione di Monza ──
{
  const r16 = formazioneEffettiva(anagrafica, scritte, 16);
  check('MADRID: Lawson corre per Red Bull', r16.lineup.redbull?.sort().join() === 'lawson,verstappen', String(r16.lineup.redbull));
  check('MADRID: Racing Bulls = Lindblad + Tsunoda', r16.lineup.racingbulls?.sort().join() === 'lindblad,tsunoda', String(r16.lineup.racingbulls));
  check('la formazione dice da dove viene: R15', r16.da.redbull === 15, String(r16.da.redbull));
  check('le scuderie mai toccate restano all\'anagrafica', r16.lineup.ferrari?.join() === 'leclerc,hamilton');
  check('e non dicono di venire da una gara', r16.da.ferrari === undefined);
}

// ── 15. Le gare PRIMA dello scambio non cambiano ──
{
  const r13 = formazioneEffettiva(anagrafica, scritte, 13);
  check('R13 resta all\'anagrafica: Hadjar in Red Bull', r13.lineup.redbull?.join() === 'verstappen,hadjar', String(r13.lineup.redbull));
  check('R13 non eredita da gare successive', Object.keys(r13.da).length === 0);
}

// ── 16. Il rientro si scrive, e da lì si eredita il rientro ──
{
  const conRientro: RigaScritta[] = [
    ...scritte,
    { round_no: 20, fia_team_id: 'redbull', driver_id: 'verstappen' },
    { round_no: 20, fia_team_id: 'redbull', driver_id: 'hadjar' },
    { round_no: 20, fia_team_id: 'racingbulls', driver_id: 'lawson' },
    { round_no: 20, fia_team_id: 'racingbulls', driver_id: 'lindblad' },
  ];
  check('R19 ha ancora Lawson in Red Bull', formazioneEffettiva(anagrafica, conRientro, 19).lineup.redbull.includes('lawson'));
  check('R21 eredita il rientro di Hadjar', formazioneEffettiva(anagrafica, conRientro, 21).lineup.redbull.includes('hadjar'));
  check('R21 viene da R20', formazioneEffettiva(anagrafica, conRientro, 21).da.redbull === 20);
}

// ── 17. L'eredità è per scuderia: scrivere la Ferrari non azzera Red Bull ──
{
  const soloFerrari: RigaScritta[] = [
    ...scritte,
    { round_no: 18, fia_team_id: 'ferrari', driver_id: 'leclerc' },
    { round_no: 18, fia_team_id: 'ferrari', driver_id: 'bearman' },
  ];
  const r18 = formazioneEffettiva(anagrafica, soloFerrari, 18);
  check('a R18 Red Bull eredita ancora da R15', r18.da.redbull === 15 && r18.lineup.redbull.includes('lawson'));
  check('a R18 la Ferrari è quella scritta lì', r18.da.ferrari === 18 && r18.lineup.ferrari.includes('bearman'));
}

// ── 18. L'ereditata guarda SOLO le gare prima: è il confronto quando si salva ──
{
  check('R14 non eredita niente: prima c\'è solo l\'anagrafica',
    formazioneEreditata(anagrafica, scritte, 14).lineup.redbull.join() === 'verstappen,hadjar');
  check('R15 eredita da R14', formazioneEreditata(anagrafica, scritte, 15).da.redbull === 14);
  check('R16 eredita da R15', formazioneEreditata(anagrafica, scritte, 16).da.redbull === 15);
}

// ── 19. Il rischio opposto: il titolare rientra e nessuno aggiorna la formazione ──
{
  const r20 = formazioneEffettiva(anagrafica, scritte, 20).lineup; // eredita ancora Lawson in Red Bull
  const orfani = puntiSenzaScuderia(r20, ['verstappen', 'hadjar', 'lindblad']);
  check('HADJAR CON PUNTI MA IN NESSUNA SCUDERIA VIENE SEGNALATO', orfani.join() === 'hadjar', orfani.join());
  check('chi è schierato non viene segnalato', puntiSenzaScuderia(r20, ['verstappen', 'lawson']).length === 0);
}

console.log(`\nFormazione di gara e Art. II: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

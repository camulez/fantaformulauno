// Test della formazione di gara. Esegui: cd backend && npx tsx src/services/lineups.check.ts
//
// Il test che conta è il primo: modificare UNA scuderia non deve svuotare le altre.
// Era il difetto vero — bastava una riga scritta perché tutte le altre restassero senza
// piloti e senza punti costruttore, senza che nulla lo segnalasse.
import { mergeLineups, validaFormazione, scuderieModificate, Lineup, LineupRow } from './lineups';

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

console.log(`\nFormazione di gara: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

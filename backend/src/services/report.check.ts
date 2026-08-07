// Test del report. Esegui: cd backend && npx tsx src/services/report.check.ts
// Due invarianti forti:
//  1. la SPIEGAZIONE quadra: le parti spiegate sommano al numero dato dal motore;
//  2. la TABELLA quadra: le somme di riga/colonna coincidono con la classifica.
import 'dotenv/config';
import { DEFAULT_RULES, ScoringRules } from '../config/defaultRules';
import { explainTeamRound, RoundRaw, TeamRoster } from './scoring';
import { teamSeasonMatrix, teamRoundReport } from './report';
import { computeStandings } from './standings';
import { getCurrentSeasonId } from './currentSeason';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error('  ✗ ' + name + (extra ? '  → ' + extra : ''));
  }
}

// ─────────────── 1. La spiegazione quadra (puro, senza database) ───────────────
{
  const rules: ScoringRules = { ...DEFAULT_RULES };
  const raw: RoundRaw = {
    race: {
      d1: { points: 25 },
      d2: { points: 12, deduction: 'partial' },
      d3: { points: 18 },
      d4: { points: 0 },
      d5: { points: 8 },
      d6: { points: 6, deduction: 'total' },
    },
    sprint: { d1: { points: 8 }, d3: { points: 5 }, d5: { points: 2 } },
    poleDriverId: 'd1',
    lineup: { tA: ['d1', 'd2'], tB: ['d3', 'd4'], tC: ['d5', 'd6'] },
  };
  const roster: TeamRoster = {
    telaioTeamId: 'tA',
    motoreWorksTeamId: 'tB',
    p1DriverId: 'd1',
    p2DriverId: 'd3',
    sponsorTeamId: 'tC',
    benzinaTeamId: 'tA',
  };

  for (const drs of [undefined, 'telaio', 'pilota1', 'sponsor'] as const) {
    const ex = explainTeamRound(raw, roster, rules, drs);
    const tag = drs ?? 'senza DRS';

    for (const s of ex.slots) {
      if (s.slot === 'telaio' || s.slot === 'motore') {
        const sum = s.drivers.reduce((a, d) => a + d.counted, 0);
        check(`${tag}: ${s.slot} spiegato = calcolato`, sum === s.points, `${sum} vs ${s.points}`);
      } else if (s.slot === 'pilota1' || s.slot === 'pilota2') {
        check(`${tag}: ${s.slot} spiegato = calcolato`, s.race + s.sprint === s.points, `${s.race}+${s.sprint} vs ${s.points}`);
      } else if (s.slot === 'sponsor' || s.slot === 'benzina') {
        const sum = s.carsScored * s.perCar;
        check(`${tag}: ${s.slot} spiegato = calcolato`, sum === s.points, `${sum} vs ${s.points}`);
      }
    }

    const sumAll =
      ex.slots.reduce((a, s) => a + s.points, 0) + ex.pole.points + ex.teamManager.points + ex.drs.bonus;
    check(`${tag}: le voci sommano al totale del round`, sumAll === ex.breakdown.total, `${sumAll} vs ${ex.breakdown.total}`);
  }

  // Coerenza delle spiegazioni "logiche"
  const ex = explainTeamRound(raw, roster, rules);
  check('pole riconosciuta come posseduta', ex.pole.owned && ex.pole.points === rules.polePoints);
  check('team manager: entrambi i piloti a punti', ex.teamManager.p1Scored && ex.teamManager.p2Scored);
  for (const s of ex.slots) {
    if (s.slot === 'telaio') {
      const penalizzato = s.drivers.find((d) => d.raceDeduction === 'partial');
      check('la detrazione parziale azzera il contributo al costruttore', !!penalizzato && penalizzato.counted === 0);
    }
    if (s.slot === 'sponsor') {
      // tC = d5 (8 punti) + d6 (6 ma detrazione TOTALE → non conta)
      check('la detrazione totale esclude la monoposto dal conteggio sponsor', s.carsScored === 1, `${s.carsScored}`);
    }
  }
}

// ─────────────── 2. La tabella quadra con la classifica (usa il database) ───────────────
(async () => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    console.error('  ✗ nessuna stagione: test sul database saltati');
    fail++;
  } else {
    const standings = await computeStandings(seasonId);
    if (standings.teams.length === 0 || standings.rounds.length === 0) {
      console.log('  · nessun round disputato: confronto con la classifica saltato');
    } else {
      for (const t of standings.teams) {
        const m = await teamSeasonMatrix(seasonId, t.teamId);
        if ('error' in m) {
          check(`matrice disponibile per ${t.name}`, false, m.error);
          continue;
        }
        const nome = t.name.split(' ')[0];

        // colonne = punti per round della classifica
        const colOk = m.columnTotals.length === t.perRound.length && m.columnTotals.every((v, i) => v === t.perRound[i]);
        check(`${nome}: le colonne coincidono con i punti per round`, colOk);

        // totale generale = totale di stagione
        check(`${nome}: totale tabella = totale classifica`, m.grandTotal === t.total, `${m.grandTotal} vs ${t.total}`);

        // righe = voci del breakdown di stagione
        const rowOf = (k: string) => m.rows.find((r) => r.key === k)?.total ?? -1;
        const b = t.breakdown;
        const coppie: [string, number][] = [
          ['telaio', b.telaio],
          ['motore', b.motore],
          ['pilota1', b.pilota1],
          ['pilota2', b.pilota2],
          ['sponsor', b.sponsor],
          ['benzina', b.benzina],
          ['pole', b.pole],
          ['teamManager', b.teamManager],
          ['drsBonus', b.drsBonus],
        ];
        for (const [k, atteso] of coppie) {
          check(`${nome}: riga ${k} = stagione`, rowOf(k) === atteso, `${rowOf(k)} vs ${atteso}`);
        }
      }

      // Il report di un round deve dare lo stesso totale della classifica di quel round
      const t0 = standings.teams[0];
      const r0 = standings.rounds[0];
      const rep = await teamRoundReport(seasonId, t0.teamId, r0.round_no);
      if ('error' in rep) {
        check('report del primo round disponibile', false, rep.error);
      } else {
        check(
          `report R${r0.round_no} di ${t0.name.split(' ')[0]}: totale = classifica`,
          rep.total === t0.perRound[0],
          `${rep.total} vs ${t0.perRound[0]}`
        );
        const sommaRighe =
          rep.rows.reduce((a, r) => a + r.points, 0) +
          (rep.derived?.pole.points ?? 0) +
          (rep.derived?.teamManager.points ?? 0) +
          (rep.derived?.drs.bonus ?? 0);
        check('report: le voci sommano al totale del round', sommaRighe === rep.total, `${sommaRighe} vs ${rep.total}`);
        check('report: 6 pezzi elencati', rep.rows.length === 6, `${rep.rows.length}`);
        check('report: posizione nel round valida', rep.position >= 1 && rep.position <= standings.teams.length);
      }
    }
  }

  console.log(`\nReport: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();

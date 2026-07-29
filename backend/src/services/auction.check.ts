// Test puri del motore d'asta (nessun DB). Esegui: npx tsx src/services/auction.check.ts
import { AuctionState } from '../types/auction';
import { startCategoryRound, logSlip, resolveRound, getRestrictedComponentIds } from './auctionEngine';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error('  ✗ ' + name);
  }
}

function baseState(): AuctionState {
  return {
    seasonId: 'test',
    status: 'lobby',
    budgetInitial: 100,
    participants: [
      { teamId: 'A', teamName: 'A', personName: 'A', budget: 100, garage: {} },
      { teamId: 'B', teamName: 'B', personName: 'B', budget: 100, garage: {} },
      { teamId: 'C', teamName: 'C', personName: 'C', budget: 100, garage: {} },
    ],
    components: [
      { id: 'M1', kind: 'motore', name: 'M1', basePrice: 0, scuderiaId: 's1', assignedTo: null },
      { id: 'M2', kind: 'motore', name: 'M2', basePrice: 0, scuderiaId: 's2', assignedTo: null },
      { id: 'M3', kind: 'motore', name: 'M3', basePrice: 0, scuderiaId: 's3', assignedTo: null },
      { id: 'M4', kind: 'motore', name: 'M4', basePrice: 0, scuderiaId: 's1', assignedTo: null },
      { id: 'T1', kind: 'telaio', name: 'T1', basePrice: 0, scuderiaId: 's1', assignedTo: null },
      { id: 'T2', kind: 'telaio', name: 'T2', basePrice: 0, scuderiaId: 's2', assignedTo: null },
      { id: 'T3', kind: 'telaio', name: 'T3', basePrice: 0, scuderiaId: 's3', assignedTo: null },
    ],
    round: null,
    history: [],
    lastAssignments: [],
  };
}

// ── 1. Vincitore chiaro + sub-round per il non-vincitore ──────────────────
{
  const s = baseState();
  check('start motore ok', startCategoryRound(s, 'motore').ok);
  check('3 attivi', s.round!.activeTeamIds.length === 3);
  logSlip(s, 'A', 'M1', 10);
  logSlip(s, 'B', 'M1', 8); // stesso item di A, perde
  logSlip(s, 'C', 'M2', 5);
  const r = resolveRound(s);
  check('A vince M1', s.participants[0].garage.motore === 'M1');
  check('A budget 90', s.participants[0].budget === 90);
  check('C vince M2', s.participants[2].garage.motore === 'M2');
  check('C budget 95', s.participants[2].budget === 95);
  check('sub-round per B', r.subRound === true && s.round !== null);
  check('B ancora attivo', s.round!.activeTeamIds.length === 1 && s.round!.activeTeamIds[0] === 'B');
  // sub-round: B prende M3
  logSlip(s, 'B', 'M3', 3);
  const r2 = resolveRound(s);
  check('B vince M3', s.participants[1].garage.motore === 'M3');
  check('categoria completa', r2.categoryComplete === true && s.round === null);
}

// ── 2. Pareggio → ribattuta ───────────────────────────────────────────────
{
  const s = baseState();
  startCategoryRound(s, 'motore');
  logSlip(s, 'A', 'M1', 10);
  logSlip(s, 'B', 'M1', 10); // pari
  logSlip(s, 'C', 'M2', 4);
  const r = resolveRound(s);
  check('pareggio rilevato', !!r.tiebreak && r.tiebreak.componentId === 'M1');
  check('mode tiebreak', s.round!.mode === 'tiebreak');
  check('C ha già vinto M2', s.participants[2].garage.motore === 'M2');
  check('A e B non hanno ancora motore', !s.participants[0].garage.motore && !s.participants[1].garage.motore);
  // ribattuta
  logSlip(s, 'A', 'M1', 15);
  logSlip(s, 'B', 'M1', 12);
  const r2 = resolveRound(s);
  check('A vince la ribattuta', s.participants[0].garage.motore === 'M1' && s.participants[0].budget === 85);
  check('sub-round per B dopo ribattuta', r2.subRound === true);
}

// ── 3. Vincoli di scuderia (Telaio ≠ scuderia del Motore) ─────────────────
{
  const s = baseState();
  // A possiede M1 (scuderia s1)
  s.participants[0].garage.motore = 'M1';
  s.components.find((c) => c.id === 'M1')!.assignedTo = 'A';
  startCategoryRound(s, 'telaio');
  const restricted = getRestrictedComponentIds(s, 'A', 'telaio');
  check('T1 (s1) vietato ad A', restricted.includes('T1'));
  check('T2 (s2) permesso ad A', !restricted.includes('T2'));
  const bad = logSlip(s, 'A', 'T1', 5);
  check('logSlip T1 rifiutato', bad.ok === false);
  const good = logSlip(s, 'A', 'T2', 5);
  check('logSlip T2 accettato', good.ok === true);
}

// ── 4. Validazioni: budget e offerta minima ───────────────────────────────
{
  const s = baseState();
  s.components.forEach((c) => (c.basePrice = 5));
  startCategoryRound(s, 'motore');
  check('sotto base rifiutato', logSlip(s, 'A', 'M1', 5).ok === false); // minBid 6
  check('a base+1 accettato', logSlip(s, 'A', 'M1', 6).ok === true);
  check('over budget rifiutato', logSlip(s, 'B', 'M2', 999).ok === false);
}

console.log(`\nAuction engine: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

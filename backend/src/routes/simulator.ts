import { Router } from 'express';
import { supabase } from '../db/supabase';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';

export const simulatorRouter = Router();
simulatorRouter.use(requireAuth);

/** Tentativi concessi per circuito. Un tentativo = riscaldamento + giro cronometrato completato. */
export const MAX_ATTEMPTS = 3;

// Finestra di plausibilità dei tempi. NON è una difesa: il cronometro gira sul client e
// resta falsificabile da chi sa aprire la console (limite noto e dichiarato, coerente col
// modello di fiducia del resto dell'app). Serve a scartare errori grossolani.
const MIN_MS = 25_000;
const MAX_MS = 15 * 60_000;

interface LapRow {
  round_no: number;
  person_id: string;
  time_ms: number;
  raw_ms: number;
  penalty_ms: number;
  violations: number;
  brake_assist: boolean;
  people: { name: string } | null;
}

/**
 * Elenco dei circuiti con lo stato del simulatore.
 * Un circuito è APERTO finché il suo GP non è stato disputato: si gira in previsione della
 * gara, non dopo. Una sola chiamata copre tutta la pagina.
 */
simulatorRouter.get('/tracks', async (req: AuthedRequest, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione corrente' });
    return;
  }

  const [{ data: rounds }, { data: laps }] = await Promise.all([
    supabase
      .from('rounds')
      .select('round_no, code, name, status')
      .eq('season_id', seasonId)
      .order('round_no'),
    supabase
      .from('sim_laps')
      .select('round_no, person_id, time_ms, raw_ms, penalty_ms, violations, brake_assist, people(name)')
      .eq('season_id', seasonId)
      .order('time_ms'),
  ]);

  const rows = ((laps ?? []) as unknown as LapRow[]);
  const tracks = (rounds ?? []).map((r) => {
    const mine = rows.filter((l) => l.round_no === r.round_no && l.person_id === req.personId);
    const all = rows.filter((l) => l.round_no === r.round_no);
    // `all` è già ordinato per tempo crescente: il primo è il record.
    const record = all[0];
    return {
      roundNo: r.round_no,
      code: r.code,
      name: r.name,
      status: r.status,
      open: r.status !== 'scored',
      attemptsUsed: mine.length,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - mine.length),
      myBest: mine.length > 0 ? Math.min(...mine.map((l) => l.time_ms)) : null,
      record: record ? { timeMs: record.time_ms, person: record.people?.name ?? '—' } : null,
    };
  });

  res.json({ tracks, maxAttempts: MAX_ATTEMPTS });
});

/**
 * Registra un giro cronometrato. Il tentativo si consuma QUI, a giro completato:
 * abbandonare a metà non costa nulla (scelta esplicita dell'utente).
 */
simulatorRouter.post('/lap', async (req: AuthedRequest, res) => {
  const roundNo = Number(req.body?.roundNo);
  const rawMs = Math.round(Number(req.body?.rawMs));
  const penaltyMsIn = Math.round(Number(req.body?.penaltyMs ?? 0));
  const violations = Math.round(Number(req.body?.violations ?? 0));
  const brakeAssist = Boolean(req.body?.brakeAssist);

  if (!Number.isInteger(roundNo) || roundNo < 1) {
    res.status(400).json({ error: 'Round non valido' });
    return;
  }
  if (!Number.isFinite(rawMs) || !Number.isFinite(penaltyMsIn) || penaltyMsIn < 0 || violations < 0) {
    res.status(400).json({ error: 'Tempo non valido' });
    return;
  }
  const timeMs = rawMs + penaltyMsIn;
  if (rawMs < MIN_MS || timeMs > MAX_MS) {
    res.status(400).json({ error: 'Tempo fuori dai valori plausibili' });
    return;
  }

  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione corrente' });
    return;
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('round_no, status')
    .eq('season_id', seasonId)
    .eq('round_no', roundNo)
    .maybeSingle();
  if (!round) {
    res.status(404).json({ error: 'Circuito non in calendario' });
    return;
  }
  if (round.status === 'scored') {
    res.status(409).json({ error: 'Il GP è già stato disputato: il circuito è chiuso' });
    return;
  }

  const { data: mine } = await supabase
    .from('sim_laps')
    .select('time_ms')
    .eq('season_id', seasonId)
    .eq('round_no', roundNo)
    .eq('person_id', req.personId);
  const used = (mine ?? []).length;
  if (used >= MAX_ATTEMPTS) {
    res.status(409).json({ error: `Tentativi esauriti (${MAX_ATTEMPTS} su ${MAX_ATTEMPTS})` });
    return;
  }

  const { error } = await supabase.from('sim_laps').insert({
    season_id: seasonId,
    round_no: roundNo,
    person_id: req.personId,
    raw_ms: rawMs,
    penalty_ms: penaltyMsIn,
    time_ms: timeMs,
    violations,
    brake_assist: brakeAssist,
  });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const times = [...(mine ?? []).map((l) => l.time_ms), timeMs];
  const myBest = Math.min(...times);

  // Record del circuito: si guarda DOPO l'inserimento, così include il giro appena fatto.
  const { data: top } = await supabase
    .from('sim_laps')
    .select('time_ms, person_id')
    .eq('season_id', seasonId)
    .eq('round_no', roundNo)
    .order('time_ms')
    .limit(1);

  res.status(201).json({
    attemptsUsed: used + 1,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - used - 1),
    timeMs,
    myBest,
    isRecord: top?.[0]?.time_ms === timeMs && top?.[0]?.person_id === req.personId,
  });
});

/** Classifica di un circuito: il miglior tempo di ogni persona, dal più veloce. */
simulatorRouter.get('/leaderboard/:roundNo', async (req, res) => {
  const roundNo = Number(req.params.roundNo);
  if (!Number.isInteger(roundNo)) {
    res.status(400).json({ error: 'Round non valido' });
    return;
  }
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione corrente' });
    return;
  }

  const [{ data: laps }, { data: round }] = await Promise.all([
    supabase
      .from('sim_laps')
      .select('round_no, person_id, time_ms, raw_ms, penalty_ms, violations, brake_assist, people(name)')
      .eq('season_id', seasonId)
      .eq('round_no', roundNo)
      .order('time_ms'),
    supabase
      .from('rounds')
      .select('round_no, code, name, status')
      .eq('season_id', seasonId)
      .eq('round_no', roundNo)
      .maybeSingle(),
  ]);

  // Già ordinati per tempo: il primo che incontro per ogni persona è il suo migliore.
  const best = new Map<string, LapRow>();
  for (const l of (laps ?? []) as unknown as LapRow[]) {
    if (!best.has(l.person_id)) best.set(l.person_id, l);
  }
  const attempts = new Map<string, number>();
  for (const l of (laps ?? []) as unknown as LapRow[]) {
    attempts.set(l.person_id, (attempts.get(l.person_id) ?? 0) + 1);
  }

  res.json({
    round: round ?? null,
    open: round ? round.status !== 'scored' : false,
    rows: [...best.values()].map((l) => ({
      person: l.people?.name ?? '—',
      timeMs: l.time_ms,
      rawMs: l.raw_ms,
      penaltyMs: l.penalty_ms,
      violations: l.violations,
      brakeAssist: l.brake_assist,
      attempts: attempts.get(l.person_id) ?? 1,
    })),
  });
});

import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { DEFAULT_RULES, ScoringRules } from '../config/defaultRules';
import { AuthedRequest } from '../middleware/auth';

/**
 * Regole della stagione corrente. ⚠️ Prima qui si leggeva `DEFAULT_RULES` e basta: cambiare
 * il numero di DRS dalla matrice punteggi non aveva alcun effetto su questa pagina.
 */
async function regole(seasonId: string): Promise<ScoringRules> {
  const { data } = await supabase.from('season_rules').select('config').eq('season_id', seasonId).maybeSingle();
  return { ...DEFAULT_RULES, ...((data?.config as Partial<ScoringRules>) ?? {}) };
}

export const drsRouter = Router();
drsRouter.use(requireAuth);

const SLOTS = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];

// Dichiarazioni DRS di una squadra: roundNo → slot.
drsRouter.get('/team/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const [{ data: decls }, { data: rounds }] = await Promise.all([
    supabase.from('drs_declarations').select('round_id, slot').eq('fantasy_team_id', req.params.teamId),
    supabase.from('rounds').select('id, round_no').eq('season_id', seasonId),
  ]);
  const noById = new Map((rounds ?? []).map((r) => [r.id, r.round_no]));
  const current: Record<number, string> = {};
  for (const d of decls ?? []) {
    const rn = noById.get(d.round_id);
    if (rn != null) current[rn] = d.slot;
  }
  res.json({ current, max: (await regole(seasonId)).drsPerSeason });
});

// Sostituisce le dichiarazioni DRS della squadra (1 per round, 1 per componente, ≤ max stagione).
drsRouter.put('/team/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const rules = await regole(seasonId);
  const teamId = req.params.teamId;
  const body = req.body as { declarations?: { roundNo: number; slot: string }[] };
  const decls = (body.declarations ?? []).filter((d) => SLOTS.includes(d.slot) && Number.isInteger(d.roundNo));

  const slots = decls.map((d) => d.slot);
  const rns = decls.map((d) => d.roundNo);
  if (new Set(slots).size !== slots.length) {
    res.status(400).json({ error: 'Ogni componente può avere il DRS una sola volta' });
    return;
  }
  if (new Set(rns).size !== rns.length) {
    res.status(400).json({ error: 'Massimo 1 DRS per round' });
    return;
  }
  if (decls.length > rules.drsPerSeason) {
    res.status(400).json({ error: `Massimo ${rules.drsPerSeason} DRS a stagione` });
    return;
  }

  const { data: rounds } = await supabase.from('rounds').select('id, round_no').eq('season_id', seasonId);
  const idByNo = new Map((rounds ?? []).map((r) => [r.round_no, r.id]));
  const rows: { fantasy_team_id: string; round_id: string; slot: string }[] = [];
  for (const d of decls) {
    const rid = idByNo.get(d.roundNo);
    if (!rid) {
      res.status(400).json({ error: `Round ${d.roundNo} inesistente` });
      return;
    }
    rows.push({ fantasy_team_id: teamId, round_id: rid, slot: d.slot });
  }

  await supabase.from('drs_declarations').delete().eq('fantasy_team_id', teamId);
  if (rows.length) {
    const { error } = await supabase.from('drs_declarations').insert(rows);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }
  res.json({ ok: true, saved: rows.length });
});

/**
 * TABELLONE DRS della stagione: chi ha giocato cosa, e su quale gara. È pubblico di
 * proposito — il DRS altrui cambia la classifica di tutti, quindi deve essere visibile a
 * tutti, non un'informazione privata sepolta nella pagina della propria squadra.
 */
drsRouter.get('/season', async (req: AuthedRequest, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const rules = await regole(seasonId);

  const [{ data: teams }, { data: rounds }, { data: decls }] = await Promise.all([
    supabase.from('fantasy_teams').select('id, name, person_id, people(name)').eq('season_id', seasonId),
    supabase.from('rounds').select('id, round_no, code, name, status').eq('season_id', seasonId).order('round_no'),
    supabase.from('drs_declarations').select('fantasy_team_id, round_id, slot'),
  ]);

  const roundById = new Map((rounds ?? []).map((r) => [r.id, r]));
  // "Prossima gara" = il primo round non ancora disputato: è quello su cui si sta decidendo.
  const prossimo = (rounds ?? []).find((r) => r.status !== 'scored') ?? null;

  const squadre = (teams ?? []).map((t) => {
    const mie = (decls ?? [])
      .filter((d) => d.fantasy_team_id === t.id)
      .map((d) => {
        const r = roundById.get(d.round_id);
        return {
          slot: d.slot,
          roundNo: r?.round_no ?? 0,
          roundCode: r?.code ?? null,
          /** Gara già a referto: quel DRS ha già inciso sulla classifica. */
          scored: r?.status === 'scored',
        };
      })
      .sort((a, b) => a.roundNo - b.roundNo);

    return {
      teamId: t.id,
      name: t.name,
      person: (t as unknown as { people: { name: string } | null }).people?.name ?? '—',
      isMine: t.person_id === req.personId,
      used: mie,
      left: Math.max(0, rules.drsPerSeason - mie.length),
      /** Cosa gioca sulla prossima gara (null = ancora niente). */
      onNext: prossimo ? mie.find((m) => m.roundNo === prossimo.round_no)?.slot ?? null : null,
    };
  });

  res.json({
    maxPerSeason: rules.drsPerSeason,
    multiplier: rules.drsMultiplier,
    scope: rules.drsScope,
    slots: SLOTS,
    rounds: (rounds ?? []).map((r) => ({
      roundNo: r.round_no,
      code: r.code,
      name: r.name,
      scored: r.status === 'scored',
    })),
    prossimoRound: prossimo ? { roundNo: prossimo.round_no, code: prossimo.code, name: prossimo.name } : null,
    teams: squadre,
  });
});

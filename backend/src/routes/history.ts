import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';

export const historyRouter = Router();
historyRouter.use(requireAuth);

interface Entry {
  is_champion: boolean;
  is_tm_cup_winner: boolean;
  team_name: string | null;
  seasons: { year: number } | null;
  people: { id: string; name: string } | null;
}

// Storico: Albo d'oro (campione + Coppa TM per stagione) e Titoli per persona.
historyRouter.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('season_entries')
    .select('is_champion, is_tm_cup_winner, team_name, seasons(year), people(id, name)');
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const entries = (data ?? []) as unknown as Entry[];

  // Albo d'oro per stagione
  const byYear = new Map<number, { year: number; champion?: string; tmCup?: string }>();
  for (const e of entries) {
    const year = e.seasons?.year;
    if (year == null) continue;
    const row = byYear.get(year) ?? { year };
    if (e.is_champion) row.champion = e.people?.name ?? e.team_name ?? '—';
    if (e.is_tm_cup_winner) row.tmCup = e.people?.name ?? e.team_name ?? '—';
    byYear.set(year, row);
  }
  const albo = [...byYear.values()].sort((a, b) => b.year - a.year);

  // Titoli per persona
  const byPerson = new Map<string, { name: string; championships: number; tmCups: number; participations: number }>();
  for (const e of entries) {
    const pid = e.people?.id;
    if (!pid) continue;
    const row = byPerson.get(pid) ?? { name: e.people?.name ?? '—', championships: 0, tmCups: 0, participations: 0 };
    row.participations++;
    if (e.is_champion) row.championships++;
    if (e.is_tm_cup_winner) row.tmCups++;
    byPerson.set(pid, row);
  }
  const titoli = [...byPerson.values()].sort(
    (a, b) => b.championships - a.championships || b.tmCups - a.tmCups || b.participations - a.participations
  );

  res.json({ albo, titoli });
});

interface SeasonRow {
  id: string;
  year: number;
  mode: string;
  status: string;
}
interface FlagEntry {
  season_id: string;
  is_champion: boolean;
  is_tm_cup_winner: boolean;
  people: { id: string; name: string } | null;
}

// Elenco stagioni con campione/Coppa TM correnti — per l'editor Albo d'oro.
historyRouter.get('/seasons', async (_req, res) => {
  const [{ data: seasons, error: e1 }, { data: entries, error: e2 }] = await Promise.all([
    supabase.from('seasons').select('id, year, mode, status').order('year', { ascending: false }),
    supabase.from('season_entries').select('season_id, is_champion, is_tm_cup_winner, people(id, name)'),
  ]);
  if (e1 || e2) {
    res.status(500).json({ error: (e1 ?? e2)?.message });
    return;
  }
  const champ = new Map<string, { id: string; name: string }>();
  const tm = new Map<string, { id: string; name: string }>();
  for (const e of (entries ?? []) as unknown as FlagEntry[]) {
    if (!e.people) continue;
    if (e.is_champion) champ.set(e.season_id, e.people);
    if (e.is_tm_cup_winner) tm.set(e.season_id, e.people);
  }
  const rows = ((seasons ?? []) as SeasonRow[]).map((s) => ({
    id: s.id,
    year: s.year,
    mode: s.mode,
    status: s.status,
    championId: champ.get(s.id)?.id ?? null,
    championName: champ.get(s.id)?.name ?? null,
    tmCupId: tm.get(s.id)?.id ?? null,
    tmCupName: tm.get(s.id)?.name ?? null,
  }));
  res.json({ seasons: rows });
});

// Crea/aggiorna una stagione storica (Albo d'oro): campione + vincitore Coppa TM.
historyRouter.post('/season', async (req, res) => {
  const { year, championPersonId, tmCupPersonId, note } = req.body as {
    year?: number;
    championPersonId?: string | null;
    tmCupPersonId?: string | null;
    note?: string | null;
  };
  if (!Number.isInteger(year) || (year as number) < 1990 || (year as number) > 2100) {
    res.status(400).json({ error: 'Anno non valido (1990–2100)' });
    return;
  }
  // Upsert stagione (le storiche nascono mode='summary').
  let { data: season } = await supabase.from('seasons').select('id, mode').eq('year', year).maybeSingle();
  if (!season) {
    const ins = await supabase
      .from('seasons')
      .insert({ year, mode: 'summary', status: 'closed' })
      .select('id, mode')
      .single();
    if (ins.error) {
      res.status(500).json({ error: ins.error.message });
      return;
    }
    season = ins.data;
  }
  const seasonId = season.id;

  // Azzera i flag esistenti, poi riassegna a campione e vincitore Coppa TM.
  await supabase
    .from('season_entries')
    .update({ is_champion: false, is_tm_cup_winner: false })
    .eq('season_id', seasonId);

  const targets = new Map<string, { is_champion: boolean; is_tm_cup_winner: boolean }>();
  if (championPersonId) targets.set(championPersonId, { is_champion: true, is_tm_cup_winner: false });
  if (tmCupPersonId) {
    const cur = targets.get(tmCupPersonId) ?? { is_champion: false, is_tm_cup_winner: false };
    cur.is_tm_cup_winner = true;
    targets.set(tmCupPersonId, cur);
  }
  for (const [pid, flags] of targets) {
    const up = await supabase.from('season_entries').upsert(
      {
        season_id: seasonId,
        person_id: pid,
        is_champion: flags.is_champion,
        is_tm_cup_winner: flags.is_tm_cup_winner,
        notes: note ?? null,
      },
      { onConflict: 'season_id,person_id' }
    );
    if (up.error) {
      res.status(500).json({ error: up.error.message });
      return;
    }
  }
  res.json({ ok: true });
});

// Elimina una stagione storica (solo le summary, mai quella live).
historyRouter.delete('/season/:year', async (req, res) => {
  const year = Number(req.params.year);
  const { data: season } = await supabase.from('seasons').select('id, mode').eq('year', year).maybeSingle();
  if (!season) {
    res.status(404).json({ error: 'Stagione non trovata' });
    return;
  }
  if (season.mode !== 'summary') {
    res.status(400).json({ error: 'Puoi eliminare solo stagioni storiche, non quella live' });
    return;
  }
  const { error } = await supabase.from('seasons').delete().eq('id', season.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

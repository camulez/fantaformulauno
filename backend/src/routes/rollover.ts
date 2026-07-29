import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { computeStandings, tmCupCompare } from '../services/standings';

export const rolloverRouter = Router();
rolloverRouter.use(requireAuth);

// Stagione corrente = anno più recente (con anno/stato per l'UI del ciclo).
async function currentSeason() {
  const { data } = await supabase
    .from('seasons')
    .select('id, year, mode, status, total_rounds')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Chiude la stagione corrente e archivia campione + Coppa TM + piazzamenti nell'albo.
rolloverRouter.post('/close', async (_req, res) => {
  const season = await currentSeason();
  if (!season) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const standings = await computeStandings(season.id);
  if (standings.rounds.length === 0 || standings.teams.length === 0) {
    res.status(400).json({ error: 'Nessun risultato da archiviare: la stagione non ha round disputati' });
    return;
  }

  // Mappa squadra → persona.
  const { data: teamsData } = await supabase
    .from('fantasy_teams')
    .select('id, person_id')
    .eq('season_id', season.id);
  const personByTeam = new Map((teamsData ?? []).map((t) => [t.id, t.person_id]));

  const champ = standings.teams[0]; // già ordinato per championCompare
  const tmWinner = [...standings.teams].sort(tmCupCompare)[0];

  let archived = 0;
  for (let i = 0; i < standings.teams.length; i++) {
    const t = standings.teams[i];
    const personId = personByTeam.get(t.teamId);
    if (!personId) continue;
    const up = await supabase.from('season_entries').upsert(
      {
        season_id: season.id,
        person_id: personId,
        team_name: t.name,
        final_position: i + 1,
        final_points: t.total,
        races_won: t.gpWins,
        is_champion: t.teamId === champ.teamId,
        is_tm_cup_winner: t.teamId === tmWinner.teamId,
      },
      { onConflict: 'season_id,person_id' }
    );
    if (up.error) {
      res.status(500).json({ error: up.error.message });
      return;
    }
    archived++;
  }

  const { error } = await supabase.from('seasons').update({ status: 'closed' }).eq('id', season.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({
    ok: true,
    year: season.year,
    archived,
    champion: champ.name,
    tmCup: tmWinner.name,
  });
});

// Riapre la stagione corrente (per correzioni dopo una chiusura).
rolloverRouter.post('/reopen', async (_req, res) => {
  const season = await currentSeason();
  if (!season) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const { error } = await supabase.from('seasons').update({ status: 'running' }).eq('id', season.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true, year: season.year });
});

// Apre la nuova stagione (anno+1): eredita regole e squadre (stesse persone, budget azzerato).
// Catalogo componenti, calendario e asta si impostano nel setup (fase successiva).
rolloverRouter.post('/new-season', async (_req, res) => {
  const season = await currentSeason();
  if (!season) {
    res.status(404).json({ error: 'Nessuna stagione da cui ereditare' });
    return;
  }
  const newYear = season.year + 1;
  const { data: exists } = await supabase.from('seasons').select('id').eq('year', newYear).maybeSingle();
  if (exists) {
    res.status(400).json({ error: `La stagione ${newYear} esiste già` });
    return;
  }

  const ins = await supabase
    .from('seasons')
    .insert({ year: newYear, mode: 'live', status: 'setup', total_rounds: season.total_rounds ?? 24 })
    .select('id')
    .single();
  if (ins.error) {
    res.status(500).json({ error: ins.error.message });
    return;
  }
  const newId = ins.data.id;

  // Eredita la matrice di config punteggi/asta.
  const { data: rules } = await supabase.from('season_rules').select('config').eq('season_id', season.id).maybeSingle();
  if (rules?.config) {
    await supabase.from('season_rules').insert({ season_id: newId, config: rules.config });
  }

  // Ricrea le squadre (stesse persone, nome mantenuto, budget ripristinato a 1835).
  const { data: teams } = await supabase
    .from('fantasy_teams')
    .select('person_id, name, tm_nickname')
    .eq('season_id', season.id);
  if (teams && teams.length) {
    const rows = teams.map((t) => ({
      season_id: newId,
      person_id: t.person_id,
      name: t.name,
      tm_nickname: t.tm_nickname,
      budget_initial: 1835,
    }));
    const { error } = await supabase.from('fantasy_teams').insert(rows);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  res.json({ ok: true, year: newYear, seasonId: newId, teams: teams?.length ?? 0 });
});

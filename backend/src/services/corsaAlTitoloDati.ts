// Prepara i dati veri per `corsaAlTitolo`, che resta puro.
//
// Due scelte che valgono la pena di essere scritte:
//  · i round ancora in calendario si contano TUTTI, anche quelli che forse non si correranno.
//    Contarne uno di troppo rende gli inseguitori più forti, quindi nessuno viene dichiarato
//    fuori per sbaglio. Se una gara viene annullata, basta toglierla dal calendario e la
//    risposta si aggiorna da sola.
//  · la formazione dei round futuri è quella EREDITATA (`formazioneEffettiva`): se Lawson
//    corre per Red Bull dall'Olanda in poi, lo si dà per scontato anche a Interlagos.
import { supabase } from '../db/supabase';
import { DEFAULT_RULES, ScoringRules } from '../config/defaultRules';
import { computeStandings } from './standings';
import { formazioneEffettiva, organicoDiAnagrafica, RigaScritta } from './lineups';
import { corsaAlTitolo, CorsaAlTitolo, RosaFantasy, RoundFuturo } from './corsaAlTitolo';

const SLOT_ROSA = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'] as const;

export interface CorsaAlTitoloConNomi extends CorsaAlTitolo {
  leaderName: string;
  roundsRimasti: { roundNo: number; code: string | null }[];
  squadre: (CorsaAlTitolo['squadre'][number] & { name: string })[];
}

export async function caricaCorsaAlTitolo(seasonId: string): Promise<CorsaAlTitoloConNomi | null> {
  const [roundsR, driversR, compsR, teamsR, assR, luR, drsR, rulesR] = await Promise.all([
    supabase.from('rounds').select('id, round_no, code, has_sprint, status').eq('season_id', seasonId).order('round_no'),
    supabase.from('drivers').select('id, fia_team_id, is_reserve').eq('season_id', seasonId),
    supabase.from('components').select('id, ref_driver_id, ref_fia_team_id').eq('season_id', seasonId),
    supabase.from('fantasy_teams').select('id, name').eq('season_id', seasonId),
    supabase.from('roster_assignments').select('fantasy_team_id, slot, component_id, from_round, to_round'),
    supabase.from('round_lineups').select('round_id, fia_team_id, driver_id'),
    supabase.from('drs_declarations').select('fantasy_team_id, round_id'),
    supabase.from('season_rules').select('config').eq('season_id', seasonId).maybeSingle(),
  ]);

  const rounds = roundsR.data ?? [];
  const teams = teamsR.data ?? [];
  if (rounds.length === 0 || teams.length < 2) return null;

  const rules: ScoringRules = { ...DEFAULT_RULES, ...((rulesR.data?.config as Partial<ScoringRules>) ?? {}) };
  const daCorrere = rounds.filter((r) => r.status !== 'scored');
  const giaCorsi = new Set(rounds.filter((r) => r.status === 'scored').map((r) => r.id));
  const numeroDi = new Map(rounds.map((r) => [r.id, r.round_no]));
  const comp = new Map((compsR.data ?? []).map((c) => [c.id, c]));

  const anagrafica = organicoDiAnagrafica((driversR.data ?? []) as never);
  const righe: RigaScritta[] = (luR.data ?? [])
    .map((l) => ({ fia_team_id: l.fia_team_id, driver_id: l.driver_id, round_no: numeroDi.get(l.round_id) ?? 0 }))
    .filter((r) => r.round_no > 0);

  const futuri: RoundFuturo[] = daCorrere.map((r) => {
    const { lineup } = formazioneEffettiva(anagrafica, righe, r.round_no);
    const rose: Record<string, RosaFantasy> = {};
    for (const t of teams) {
      const attivi: Record<string, { ref_driver_id: string | null; ref_fia_team_id: string | null }> = {};
      for (const a of assR.data ?? []) {
        if (a.fantasy_team_id !== t.id) continue;
        if (a.from_round > r.round_no || (a.to_round != null && a.to_round < r.round_no)) continue;
        const c = comp.get(a.component_id);
        if (c) attivi[a.slot] = c;
      }
      if (!SLOT_ROSA.every((s) => attivi[s])) continue; // rosa incompleta: nessun punto di gara
      rose[t.id] = {
        telaio: attivi.telaio.ref_fia_team_id!,
        motore: attivi.motore.ref_fia_team_id!,
        p1: attivi.pilota1.ref_driver_id!,
        p2: attivi.pilota2.ref_driver_id!,
        sponsor: attivi.sponsor.ref_fia_team_id!,
        benzina: attivi.benzina.ref_fia_team_id!,
      };
    }
    return { roundNo: r.round_no, code: r.code, hasSprint: r.has_sprint, lineup, rose };
  });

  // DRS spendibili da qui alla fine: quelli non ancora usati PIÙ quelli già dichiarati su
  // round non disputati. Mai più di uno per gara.
  const drsDisponibili: Record<string, number> = {};
  for (const t of teams) {
    const miei = (drsR.data ?? []).filter((d) => d.fantasy_team_id === t.id);
    const suFuturi = miei.filter((d) => !giaCorsi.has(d.round_id)).length;
    const inutilizzati = Math.max(0, rules.drsPerSeason - miei.length);
    drsDisponibili[t.id] = Math.min(suFuturi + inutilizzati, futuri.length);
  }

  const standings = await computeStandings(seasonId);
  const punti: Record<string, number> = {};
  for (const t of standings.teams) punti[t.teamId] = t.total;
  if (Object.keys(punti).length < 2) return null;

  const esito = corsaAlTitolo(punti, futuri, drsDisponibili, {
    raceScale: rules.raceScale,
    sprintScale: rules.sprintScale,
    polePoints: rules.polePoints,
    teamManagerPoints: rules.teamManagerPoints,
    sponsorPointsPerCar: rules.sponsorPointsPerCar,
    benzinaPointsPerCar: rules.benzinaPointsPerCar,
    drsMultiplier: rules.drsMultiplier,
    drsScope: rules.drsScope,
  });
  if (!esito) return null;

  const nome = new Map(teams.map((t) => [t.id, t.name]));
  return {
    ...esito,
    leaderName: nome.get(esito.leaderId) ?? '—',
    roundsRimasti: futuri.map((r) => ({ roundNo: r.roundNo, code: r.code })),
    squadre: esito.squadre.map((s) => ({ ...s, name: nome.get(s.teamId) ?? '—' })),
  };
}

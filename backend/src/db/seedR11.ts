// Seed dei dati REALI R01–R11 (dal PDF) per collaudare le classifiche end-to-end:
// roster delle 6 squadre + risultati grezzi + pole + DRS Scuderia. Eseguire: npm run seed:r11
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { supabase } from './supabase';

const data = JSON.parse(readFileSync(join(__dirname, '../services/r11data.json'), 'utf8')) as {
  race: Record<string, Record<string, number>>;
  sprint: Record<string, Record<string, number>>;
  poles: Record<string, string>;
};

type Slot = 'telaio' | 'motore' | 'pilota1' | 'pilota2' | 'sponsor' | 'benzina';
interface RDef { telaio: string; motore: string; p1: string; p2: string; sponsor: string; benzina: string; drs?: { round: number; slot: Slot }; }

// Roster delle 6 squadre (PDF pag.2). Chiave = nome fantasy_team come nel seed.
const ROSTERS: Record<string, RDef> = {
  'Anzo Grand Prix International': { telaio: 'Mercedes', motore: 'Ferrari', p1: 'Oscar Piastri', p2: 'Esteban Ocon', sponsor: 'Haas F1 Team', benzina: 'Mercedes' },
  'Marchesse Motori&Mignotte': { telaio: 'Haas F1 Team', motore: 'Racing Bulls', p1: 'Carlos Sainz', p2: 'Lando Norris', sponsor: 'McLaren', benzina: 'McLaren' },
  'Scuderia Da Silva': { telaio: 'Red Bull Racing', motore: 'Mercedes', p1: 'Charles Leclerc', p2: 'Olivier Bearman', sponsor: 'Alpine', benzina: 'Red Bull Racing', drs: { round: 2, slot: 'motore' } },
  'Pio Motori & Propulsioni': { telaio: 'Ferrari', motore: 'Red Bull Racing', p1: 'Andrea Kimi Antonelli', p2: 'Liam Lawson', sponsor: 'Audi', benzina: 'Cadillac' },
  'Staiv Squadra Corse': { telaio: 'Racing Bulls', motore: 'McLaren', p1: 'Max Verstappen', p2: 'Lewis Hamilton', sponsor: 'Racing Bulls', benzina: 'Alpine' },
  zippof1team: { telaio: 'McLaren', motore: 'Williams', p1: 'George Russel', p2: 'Isack Hadjar', sponsor: 'Mercedes', benzina: 'Ferrari' },
};

async function main() {
  const { data: season } = await supabase.from('seasons').select('id').eq('year', 2026).single();
  if (!season) throw new Error('Stagione 2026 mancante');
  const sid = season.id;

  const [{ data: fteams }, { data: fiaTeams }, { data: drivers }, { data: comps }, { data: rounds }] = await Promise.all([
    supabase.from('fantasy_teams').select('id, name').eq('season_id', sid),
    supabase.from('fia_teams').select('id, name').eq('season_id', sid),
    supabase.from('drivers').select('id, name').eq('season_id', sid),
    supabase.from('components').select('id, kind, ref_driver_id, ref_fia_team_id').eq('season_id', sid),
    supabase.from('rounds').select('id, round_no').eq('season_id', sid).lte('round_no', 11),
  ]);

  // Il PDF scrive "George Russel" (1 L); nel DB il nome corretto è "George Russell".
  const ALIAS: Record<string, string> = { 'George Russel': 'George Russell' };
  const dName = (n: string) => ALIAS[n] ?? n;

  const teamByName = new Map((fteams ?? []).map((t) => [t.name, t.id]));
  const fiaByName = new Map((fiaTeams ?? []).map((t) => [t.name, t.id]));
  const drvByName = new Map((drivers ?? []).map((d) => [d.name, d.id]));
  const roundByNo = new Map((rounds ?? []).map((r) => [r.round_no, r.id]));
  const roundIds = (rounds ?? []).map((r) => r.id);

  // component lookup
  const compTeam = new Map<string, string>(); // `${kind}:${fiaTeamId}` -> componentId
  const compDrv = new Map<string, string>(); // driverId -> pilota componentId
  for (const c of comps ?? []) {
    if (c.kind === 'pilota' && c.ref_driver_id) compDrv.set(c.ref_driver_id, c.id);
    else if (c.ref_fia_team_id) compTeam.set(`${c.kind}:${c.ref_fia_team_id}`, c.id);
  }
  const telaioComp = (team: string) => compTeam.get(`telaio:${fiaByName.get(team)}`)!;
  const motoreComp = (team: string) => compTeam.get(`motore:${fiaByName.get(team)}`)!;
  const sponsorComp = (team: string) => compTeam.get(`sponsor:${fiaByName.get(team)}`)!;
  const benzinaComp = (team: string) => compTeam.get(`benzina:${fiaByName.get(team)}`)!;
  const pilotaComp = (drv: string) => compDrv.get(drvByName.get(dName(drv))!)!;

  // --- Roster assignments (reset + insert) ---
  const teamIds = [...teamByName.values()];
  await supabase.from('roster_assignments').delete().in('fantasy_team_id', teamIds);
  const drsRows: { fantasy_team_id: string; round_id: string; slot: string }[] = [];
  const assignments: Record<string, unknown>[] = [];
  for (const [name, r] of Object.entries(ROSTERS)) {
    const tid = teamByName.get(name);
    if (!tid) throw new Error(`fantasy_team mancante: ${name}`);
    const map: Record<Slot, string> = {
      telaio: telaioComp(r.telaio), motore: motoreComp(r.motore),
      pilota1: pilotaComp(r.p1), pilota2: pilotaComp(r.p2),
      sponsor: sponsorComp(r.sponsor), benzina: benzinaComp(r.benzina),
    };
    for (const [slot, component_id] of Object.entries(map)) {
      if (!component_id) throw new Error(`Componente mancante: ${name} / ${slot} (telaio=${r.telaio} motore=${r.motore} sponsor=${r.sponsor} benzina=${r.benzina})`);
      assignments.push({ fantasy_team_id: tid, slot, component_id, from_round: 1, source: 'auction' });
    }
    if (r.drs) drsRows.push({ fantasy_team_id: tid, round_id: roundByNo.get(r.drs.round)!, slot: r.drs.slot });
  }
  const aIns = await supabase.from('roster_assignments').insert(assignments);
  if (aIns.error) throw new Error('insert roster_assignments: ' + aIns.error.message);

  // --- Risultati grezzi R01–R11 (reset + insert) ---
  await supabase.from('session_results').delete().in('round_id', roundIds);
  await supabase.from('poles').delete().in('round_id', roundIds);
  const results: Record<string, unknown>[] = [];
  for (const [session, table] of [['race', data.race], ['sprint', data.sprint]] as const) {
    for (const [drvName, byRound] of Object.entries(table)) {
      const did = drvByName.get(dName(drvName));
      if (!did) continue;
      for (const [rn, pts] of Object.entries(byRound)) {
        const rid = roundByNo.get(Number(rn));
        if (rid) results.push({ round_id: rid, driver_id: did, session, fia_points: pts });
      }
    }
  }
  await supabase.from('session_results').insert(results);

  const poleRows = Object.entries(data.poles)
    .map(([rn, drv]) => ({ round_id: roundByNo.get(Number(rn)), pole_driver_id: drvByName.get(dName(drv)) }))
    .filter((p) => p.round_id && p.pole_driver_id);
  if (poleRows.length) await supabase.from('poles').insert(poleRows);

  // --- DRS ---
  const scuderiaTeamIds = drsRows.map((d) => d.fantasy_team_id);
  if (scuderiaTeamIds.length) await supabase.from('drs_declarations').delete().in('fantasy_team_id', scuderiaTeamIds);
  if (drsRows.length) await supabase.from('drs_declarations').insert(drsRows);

  // --- Marca R01–R11 come disputati ---
  await supabase.from('rounds').update({ status: 'scored' }).in('id', roundIds);

  console.log(`✅ Seed R11: ${assignments.length} assegnazioni roster, ${results.length} risultati, ${poleRows.length} pole, ${drsRows.length} DRS, ${roundIds.length} round marcati.`);
}

main().catch((e) => {
  console.error('❌ Seed R11 fallito:', e.message ?? e);
  process.exit(1);
});

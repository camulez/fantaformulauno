// Seed anagrafica FIA 2026 + calendario per la stagione 2026 (dal PDF R11).
// Idempotente: cancella e reinserisce l'anagrafica della stagione. Eseguire: npm run seed:reference
import 'dotenv/config';
import { supabase } from './supabase';

interface TeamDef {
  name: string;
  motore: string; // nome componente motore (works)
  sponsor: string;
  benzina: string;
  drivers: [string, string];
}

const TEAMS: TeamDef[] = [
  { name: 'McLaren', motore: 'McLaren Mercedes Power Unit', sponsor: 'Chrome', benzina: 'Petronas', drivers: ['Oscar Piastri', 'Lando Norris'] },
  { name: 'Mercedes', motore: 'Mercedes Power Unit', sponsor: 'AMG', benzina: 'Petronas', drivers: ['George Russell', 'Andrea Kimi Antonelli'] },
  { name: 'Red Bull Racing', motore: 'Red Bull Power Unit', sponsor: 'Oracle', benzina: 'ExxonMobil', drivers: ['Max Verstappen', 'Isack Hadjar'] },
  { name: 'Ferrari', motore: 'Ferrari Power Unit', sponsor: 'Ray-Ban', benzina: 'Shell', drivers: ['Charles Leclerc', 'Lewis Hamilton'] },
  { name: 'Williams', motore: 'Williams Mercedes Power Unit', sponsor: 'Komatsu', benzina: 'Petronas', drivers: ['Alexander Albon', 'Carlos Sainz'] },
  { name: 'Racing Bulls', motore: 'Ford Power Unit (Racing Bulls)', sponsor: 'Visa', benzina: 'ExxonMobil', drivers: ['Liam Lawson', 'Arvid Lindblad'] },
  { name: 'Aston Martin', motore: 'Aston Martin Honda Power Unit', sponsor: 'Boss', benzina: 'Aramco', drivers: ['Lance Stroll', 'Fernando Alonso'] },
  { name: 'Haas F1 Team', motore: 'Haas Ferrari Power Unit', sponsor: 'MoneyGram', benzina: 'Shell', drivers: ['Esteban Ocon', 'Olivier Bearman'] },
  { name: 'Audi', motore: 'Audi Power Unit', sponsor: 'Revolut', benzina: 'Castrol', drivers: ['Niko Hulkenberg', 'Gabriel Bortoleto'] },
  { name: 'Alpine', motore: 'Alpine Mercedes Power Unit', sponsor: 'BWT', benzina: 'Petronas', drivers: ['Pierre Gasly', 'Franco Colapinto'] },
  { name: 'Cadillac', motore: 'Cadillac Ferrari Power Unit', sponsor: 'Jim Bean', benzina: 'Shell', drivers: ['Sergio Perez', 'Valtteri Bottas'] },
];

// Calendario 2026 (sigle e sprint dal PDF). Sprint: R02, R06, R11, R14, R18.
const CALENDAR: { round_no: number; code: string; name: string; has_sprint: boolean }[] = [
  { round_no: 1, code: 'AUS', name: 'Australia', has_sprint: false },
  { round_no: 2, code: 'CHI', name: 'Cina', has_sprint: true },
  { round_no: 3, code: 'JAP', name: 'Giappone', has_sprint: false },
  { round_no: 4, code: 'BHA', name: 'Bahrain', has_sprint: false },
  { round_no: 5, code: 'SAR', name: 'Arabia Saudita', has_sprint: false },
  { round_no: 6, code: 'USA', name: 'Miami', has_sprint: true },
  { round_no: 7, code: 'CAN', name: 'Canada', has_sprint: false },
  { round_no: 8, code: 'MON', name: 'Monaco', has_sprint: false },
  { round_no: 9, code: 'CAT', name: 'Spagna (Barcellona)', has_sprint: false },
  { round_no: 10, code: 'OST', name: 'Austria', has_sprint: false },
  { round_no: 11, code: 'GBR', name: 'Gran Bretagna', has_sprint: true },
  { round_no: 12, code: 'BEL', name: 'Belgio', has_sprint: false },
  { round_no: 13, code: 'HUN', name: 'Ungheria', has_sprint: false },
  { round_no: 14, code: 'NET', name: 'Olanda', has_sprint: true },
  { round_no: 15, code: 'ITA', name: 'Italia (Monza)', has_sprint: false },
  { round_no: 16, code: 'ESP', name: 'Spagna (Madrid)', has_sprint: false },
  { round_no: 17, code: 'AZB', name: 'Azerbaijan', has_sprint: false },
  { round_no: 18, code: 'SNG', name: 'Singapore', has_sprint: true },
  { round_no: 19, code: 'USA', name: 'Stati Uniti (Austin)', has_sprint: false },
  { round_no: 20, code: 'MEX', name: 'Messico', has_sprint: false },
  { round_no: 21, code: 'BRA', name: 'Brasile', has_sprint: false },
  { round_no: 22, code: 'USA', name: 'Las Vegas', has_sprint: false },
  { round_no: 23, code: 'QTR', name: 'Qatar', has_sprint: false },
  { round_no: 24, code: 'ABD', name: 'Abu Dhabi', has_sprint: false },
];

async function main() {
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .select('id, year')
    .eq('year', 2026)
    .single();
  if (seasonErr || !season) throw new Error('Stagione 2026 non trovata: esegui prima `npm run seed`.');
  const seasonId = season.id;

  // Pulizia idempotente (nessun risultato/roster esistente in questa fase).
  await supabase.from('components').delete().eq('season_id', seasonId);
  await supabase.from('drivers').delete().eq('season_id', seasonId);
  await supabase.from('rounds').delete().eq('season_id', seasonId);
  await supabase.from('fia_teams').delete().eq('season_id', seasonId);

  // 1) Scuderie
  const { data: teams, error: teamsErr } = await supabase
    .from('fia_teams')
    .insert(TEAMS.map((t) => ({ season_id: seasonId, name: t.name })))
    .select('id, name');
  if (teamsErr || !teams) throw teamsErr;
  const teamId = new Map(teams.map((t) => [t.name, t.id]));

  // 2) Piloti
  const driverRows = TEAMS.flatMap((t) =>
    t.drivers.map((d) => ({ season_id: seasonId, name: d, fia_team_id: teamId.get(t.name)! }))
  );
  const { data: drivers, error: driversErr } = await supabase
    .from('drivers')
    .insert(driverRows)
    .select('id, name');
  if (driversErr || !drivers) throw driversErr;
  const driverId = new Map(drivers.map((d) => [d.name, d.id]));

  // 3) Componenti (catalogo asta) — base_price 0 (placeholder, da foglio 2025)
  const components: Record<string, unknown>[] = [];
  for (const t of TEAMS) {
    const tid = teamId.get(t.name)!;
    components.push({ season_id: seasonId, kind: 'telaio', ref_fia_team_id: tid, name: `${t.name} Chassis`, base_price: 0 });
    components.push({ season_id: seasonId, kind: 'motore', ref_fia_team_id: tid, name: t.motore, base_price: 0 });
    components.push({ season_id: seasonId, kind: 'sponsor', ref_fia_team_id: tid, name: `${t.sponsor} (${t.name})`, base_price: 0 });
    components.push({ season_id: seasonId, kind: 'benzina', ref_fia_team_id: tid, name: `${t.benzina} (${t.name})`, base_price: 0 });
  }
  for (const t of TEAMS) {
    for (const d of t.drivers) {
      components.push({ season_id: seasonId, kind: 'pilota', ref_driver_id: driverId.get(d)!, name: d, base_price: 0 });
    }
  }
  const { error: compErr } = await supabase.from('components').insert(components);
  if (compErr) throw compErr;

  // 4) Calendario
  const { error: roundsErr } = await supabase
    .from('rounds')
    .insert(CALENDAR.map((r) => ({ season_id: seasonId, ...r, status: 'scheduled' })));
  if (roundsErr) throw roundsErr;

  const sprints = CALENDAR.filter((r) => r.has_sprint).map((r) => `R${r.round_no}`).join(', ');
  console.log(
    `✅ Seed reference 2026: ${teams.length} scuderie, ${drivers.length} piloti, ${components.length} componenti, ${CALENDAR.length} round (sprint: ${sprints}).`
  );
}

main().catch((e) => {
  console.error('❌ Seed reference fallito:', e.message ?? e);
  process.exit(1);
});

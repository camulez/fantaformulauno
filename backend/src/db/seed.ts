// Seed iniziale: stagione 2026, 6 partecipanti (persone), 6 squadre fantasy, config default.
// Eseguire dopo aver applicato schema.sql e impostato .env:  npm run seed
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';
import { DEFAULT_RULES } from '../config/defaultRules';

const DEFAULT_PIN = '1234'; // ⚠️ da cambiare al primo accesso di ciascun partecipante

// person name (login) → { team, tm nickname }
const PARTICIPANTS: Array<{ name: string; team: string; tm: string }> = [
  { name: 'Ago', team: 'Anzo Grand Prix International', tm: 'Ago' },
  { name: 'Marchese', team: 'Marchesse Motori&Mignotte', tm: 'Marchese' },
  { name: 'Maurinho', team: 'Scuderia Da Silva', tm: 'Maurinho' },
  { name: 'Pio', team: 'Pio Motori & Propulsioni', tm: 'Pio' },
  { name: 'Staiv', team: 'Staiv Squadra Corse', tm: 'Staiv' },
  { name: 'Zippo', team: 'zippof1team', tm: 'Zippo' },
];

async function main() {
  const pin_hash = await bcrypt.hash(DEFAULT_PIN, 10);

  // 1) persone
  const { data: people, error: peopleErr } = await supabase
    .from('people')
    .upsert(
      PARTICIPANTS.map((p) => ({ name: p.name, nickname: p.tm, pin_hash })),
      { onConflict: 'name' }
    )
    .select('id, name');
  if (peopleErr) throw peopleErr;

  // 2) stagione 2026
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .upsert({ year: 2026, mode: 'live', status: 'setup' }, { onConflict: 'year' })
    .select('id')
    .single();
  if (seasonErr) throw seasonErr;

  // 3) config default della stagione
  const { error: rulesErr } = await supabase
    .from('season_rules')
    .upsert({ season_id: season.id, config: DEFAULT_RULES }, { onConflict: 'season_id' });
  if (rulesErr) throw rulesErr;

  // 4) squadre fantasy
  const byName = new Map((people ?? []).map((p) => [p.name, p.id]));
  const teams = PARTICIPANTS.map((p) => ({
    season_id: season.id,
    person_id: byName.get(p.name)!,
    name: p.team,
    tm_nickname: p.tm,
    budget_initial: DEFAULT_RULES.auction.budget,
  }));
  const { error: teamsErr } = await supabase
    .from('fantasy_teams')
    .upsert(teams, { onConflict: 'season_id,person_id' });
  if (teamsErr) throw teamsErr;

  console.log(`✅ Seed completato: stagione 2026, ${PARTICIPANTS.length} partecipanti e squadre. PIN default: ${DEFAULT_PIN}`);
}

main().catch((e) => {
  console.error('❌ Seed fallito:', e.message ?? e);
  process.exit(1);
});

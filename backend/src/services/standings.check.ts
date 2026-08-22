// Collaudo end-to-end: legge dal DB e calcola le classifiche. Esegui: npx tsx src/services/standings.check.ts
import 'dotenv/config';
import { supabase } from '../db/supabase';
import { computeStandings } from './standings';

async function main() {
  const { data: season } = await supabase.from('seasons').select('id').eq('year', 2026).single();
  const res = await computeStandings(season!.id);
  console.log('Round disputati:', res.rounds.map((r) => `R${r.round_no}·${r.code}`).join(' '), '\n');

  // Attesi (roster pieno). Scuderia con DRS=solo Race → 747 (il PDF 759 era errore di sprint).
  const expected: Record<string, number> = {
    'Anzo Grand Prix International': 778,
    'Marchesse Motori&Mignotte': 285,
    'Pio Motori & Propulsioni': 634,
    zippof1team: 558,
  };
  let fail = 0;
  for (const t of res.teams) {
    const exp = expected[t.name];
    const mark = exp !== undefined ? (t.total === exp ? '✅' : '❌') : '·';
    if (exp !== undefined && t.total !== exp) fail++;
    const b = t.breakdown;
    console.log(
      `${mark} ${t.name.padEnd(30)} ${String(t.total).padStart(4)}${exp !== undefined ? ` (atteso ${exp})` : ''}  ` +
        `[T${b.telaio} M${b.motore} P1:${b.pilota1} P2:${b.pilota2} S${b.sponsor} B${b.benzina} Pole${b.pole} TM${b.teamManager} DRS${b.drsExtra}]`
    );
  }
  console.log(`\n${fail === 0 ? '✅ Classifiche DB coerenti col gate' : `❌ ${fail} scostamenti`}`);
  console.log('(Scuderia = 747 con DRS solo-Race; Staiv ≈ 587 senza mercato datato — attesi.)');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

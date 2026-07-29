import { Router } from 'express';
import { supabase } from '../db/supabase';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

interface MsgRow {
  id: string;
  body: string;
  created_at: string;
  people: { name: string } | null;
}

// Bacheca: ultimi messaggi (con autore), dal più recente.
messagesRouter.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, body, created_at, people(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const messages = ((data ?? []) as unknown as MsgRow[]).map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.created_at,
    author: m.people?.name ?? '—',
  }));
  res.json({ messages });
});

// Pubblica un messaggio.
messagesRouter.post('/', async (req: AuthedRequest, res) => {
  const body = String(req.body?.body ?? '').trim();
  if (!body) {
    res.status(400).json({ error: 'Messaggio vuoto' });
    return;
  }
  if (body.length > 500) {
    res.status(400).json({ error: 'Massimo 500 caratteri' });
    return;
  }
  const seasonId = await getCurrentSeasonId();
  const { data, error } = await supabase
    .from('messages')
    .insert({ person_id: req.personId, body, season_id: seasonId })
    .select('id')
    .single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json({ id: data.id });
});

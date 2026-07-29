import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import { AuthedRequest, requireAuth } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET as string;
const isProd = process.env.NODE_ENV === 'production';
const PIN_REGEX = /^\d{4}$/;

export const authRouter = Router();

function issueSession(res: import('express').Response, personId: string, name: string) {
  const token = jwt.sign({ personId, name }, JWT_SECRET, { expiresIn: '180d' });
  res.cookie('session', token, {
    httpOnly: true,
    secure: isProd,
    // Il browser parla sempre col dominio del frontend (proxy /api in next.config.ts),
    // quindi dal suo punto di vista è same-site: Lax basta, non serve None.
    sameSite: 'lax',
    maxAge: 180 * 24 * 60 * 60 * 1000,
  });
}

// Lista nomi per il selettore di login: solo chi ha un PIN (esclude i solo-storici).
authRouter.get('/people', async (_req, res) => {
  const { data, error } = await supabase
    .from('people')
    .select('id, name, pin_hash')
    .order('name');
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json((data ?? []).filter((p) => p.pin_hash).map((p) => ({ id: p.id, name: p.name })));
});

authRouter.post('/login', async (req, res) => {
  const { personId, pin } = req.body as { personId?: string; pin?: string };
  if (!personId || !pin) {
    res.status(400).json({ error: 'personId e pin sono obbligatori' });
    return;
  }

  const { data: person, error } = await supabase
    .from('people')
    .select('id, name, pin_hash')
    .eq('id', personId)
    .single();

  if (error || !person || !person.pin_hash) {
    res.status(401).json({ error: 'Partecipante o PIN non validi' });
    return;
  }

  const pinMatches = await bcrypt.compare(pin, person.pin_hash);
  if (!pinMatches) {
    res.status(401).json({ error: 'Partecipante o PIN non validi' });
    return;
  }

  issueSession(res, person.id, person.name);
  res.json({ id: person.id, name: person.name });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ id: req.personId, name: req.personName });
});

// Cambio nome/PIN (richiede il PIN attuale).
authRouter.put('/me', requireAuth, async (req: AuthedRequest, res) => {
  const { currentPin, newName, newPin } = req.body as {
    currentPin?: string;
    newName?: string;
    newPin?: string;
  };

  if (!currentPin) {
    res.status(400).json({ error: 'Inserisci il PIN attuale per confermare' });
    return;
  }
  const trimmedName = newName?.trim();
  if (!trimmedName && !newPin) {
    res.status(400).json({ error: 'Nessuna modifica da salvare' });
    return;
  }
  if (trimmedName && (trimmedName.length < 2 || trimmedName.length > 30)) {
    res.status(400).json({ error: 'Il nome deve avere tra 2 e 30 caratteri' });
    return;
  }
  if (newPin && !PIN_REGEX.test(newPin)) {
    res.status(400).json({ error: 'Il nuovo PIN deve essere di 4 cifre' });
    return;
  }

  const { data: person, error } = await supabase
    .from('people')
    .select('id, name, pin_hash')
    .eq('id', req.personId)
    .single();

  if (error || !person || !person.pin_hash) {
    res.status(404).json({ error: 'Partecipante non trovato' });
    return;
  }

  const pinMatches = await bcrypt.compare(currentPin, person.pin_hash);
  if (!pinMatches) {
    res.status(401).json({ error: 'PIN attuale errato' });
    return;
  }

  if (trimmedName && trimmedName !== person.name) {
    const { data: existing } = await supabase
      .from('people')
      .select('id')
      .ilike('name', trimmedName)
      .neq('id', person.id)
      .maybeSingle();
    if (existing) {
      res.status(409).json({ error: 'Questo nome è già in uso' });
      return;
    }
  }

  const update: { name?: string; pin_hash?: string } = {};
  if (trimmedName) update.name = trimmedName;
  if (newPin) update.pin_hash = await bcrypt.hash(newPin, 10);

  const { data: updated, error: updateError } = await supabase
    .from('people')
    .update(update)
    .eq('id', person.id)
    .select('id, name')
    .single();

  if (updateError || !updated) {
    res.status(500).json({ error: updateError?.message || 'Errore nel salvataggio' });
    return;
  }

  issueSession(res, updated.id, updated.name);
  res.json({ id: updated.id, name: updated.name });
});

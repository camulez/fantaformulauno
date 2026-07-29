# Deploy FantaFormula1 — Vercel (frontend) + Render (backend)

Stesso schema di calcio-balilla / family-budget: il browser parla **solo** col
frontend (Vercel), che inoltra le chiamate `/api/*` al backend (Render) tramite
il rewrite in `next.config.ts`. Così il cookie di sessione resta same-site.

## 0. Prerequisiti
- Un progetto **Supabase** già attivo (ref `nkfxufveqsahnsvxmhra`) con `schema.sql` applicato.
  ⚠️ La service_role key è esposta da una vecchia conversazione: **rigenerala** (Supabase →
  Settings → API → Reset service_role) prima di andare in produzione.
- Il codice su **GitHub** (vedi passo 1).
- Account Vercel e Render collegati a GitHub.

## 1. Repository GitHub
Dalla cartella `fantaformulauno/`:
```bash
git init && git add -A && git commit -m "FantaFormula1 iniziale"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/fantaformulauno.git
git push -u origin main
```
`.gitignore` esclude già `node_modules`, `dist`, `.next` e i file `.env`.

## 2. Backend su Render
1. Render → **New** → **Web Service** → collega il repo.
2. **Root Directory**: `backend`
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. **Health Check Path**: `/health`
6. Piano **Free** (nota: si sospende dopo inattività, primo avvio lento).
7. **Environment** → aggiungi:
   - `SUPABASE_URL` = URL del progetto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (quella rigenerata)
   - `JWT_SECRET` = stringa casuale (`openssl rand -base64 32`)
   - `FRONTEND_ORIGIN` = URL Vercel (lo avrai dopo il passo 3; per ora metti un placeholder e aggiorna)
   - `NODE_ENV` = `production`
8. Deploy. Annota l'URL, es. `https://fantaformulauno-backend.onrender.com`.
   Verifica: aprendo `<url>/health` deve rispondere `{"ok":true}`.

> In alternativa esiste `render.yaml` (Blueprint): Render → New → Blueprint → seleziona il repo;
> imposterà tutto tranne i valori marcati `sync:false`, che inserisci a mano.

## 3. Frontend su Vercel
1. Vercel → **Add New** → **Project** → importa il repo.
2. **Root Directory**: `frontend`
3. Framework: Next.js (auto). Build/Output: default.
4. **Environment Variables**:
   - `BACKEND_URL` = URL Render del backend
   - `NEXT_PUBLIC_API_URL` = **stesso** URL Render del backend
5. Deploy. Annota l'URL, es. `https://fantaformulauno.vercel.app`.

## 4. Chiudere il cerchio
- Torna su Render e imposta `FRONTEND_ORIGIN` = URL Vercel definitivo → redeploy backend.
- Apri l'URL Vercel, fai login con un PIN (default `1234`) e verifica dashboard/classifica.

## Variabili d'ambiente (riassunto)
| Dove   | Chiave | Valore |
|--------|--------|--------|
| Render | `SUPABASE_URL` | URL Supabase |
| Render | `SUPABASE_SERVICE_ROLE_KEY` | service_role (solo backend) |
| Render | `JWT_SECRET` | random |
| Render | `FRONTEND_ORIGIN` | URL Vercel |
| Render | `NODE_ENV` | `production` |
| Vercel | `BACKEND_URL` | URL Render |
| Vercel | `NEXT_PUBLIC_API_URL` | URL Render |

## Note
- **Cookie**: `secure` si attiva con `NODE_ENV=production`; `sameSite=lax` basta perché
  il browser vede solo il dominio Vercel (proxy `/api`).
- **PIN**: default `1234` per tutti — cambiali dal Profilo dopo il primo accesso.
- **Asta (Socket.io)**: quando la aggiungeremo, Render supporta i WebSocket; nessuna
  modifica al deploy prevista.

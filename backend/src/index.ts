import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { authRouter } from './routes/auth';
import { seasonRouter } from './routes/season';
import { referenceRouter } from './routes/reference';
import { resultsRouter } from './routes/results';
import { standingsRouter } from './routes/standings';
import { historyRouter } from './routes/history';
import { rosterRouter } from './routes/roster';
import { drsRouter } from './routes/drs';
import { messagesRouter } from './routes/messages';
import { rolloverRouter } from './routes/rollover';
import { auctionRouter } from './routes/auction';
import { componentsRouter } from './routes/components';
import { reportRouter } from './routes/report';
import { simulatorRouter } from './routes/simulator';
import { pingDb, requireDb, segnalaDbSu } from './middleware/dbHealth';

const app = express();
const PORT = process.env.PORT || 4200;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3400',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check di Render: NON tocca il database, deve restare istantaneo.
app.get('/health', (_req, res) => res.json({ ok: true }));

// Ping vero del database, senza cache. Lo usa la sveglia automatica (che così azzera il
// contatore di inattività di Supabase) e il frontend per capire quando può ricaricare.
app.get('/health/db', async (_req, res) => {
  const su = await pingDb();
  if (su) segnalaDbSu();
  res.status(su ? 200 : 503).json(su ? { db: 'up' } : { db: 'down', code: 'DB_DOWN' });
});

// Da qui in giù serve il database: se è sospeso si risponde 503 in un attimo, invece di
// far aspettare sette secondi a ogni chiamata per poi dare un 500 che non spiega niente.
app.use(requireDb);

app.use('/auth', authRouter);
app.use('/season', seasonRouter);
app.use('/reference', referenceRouter);
app.use('/results', resultsRouter);
app.use('/standings', standingsRouter);
app.use('/history', historyRouter);
app.use('/roster', rosterRouter);
app.use('/drs', drsRouter);
app.use('/messages', messagesRouter);
app.use('/rollover', rolloverRouter);
app.use('/auction', auctionRouter);
app.use('/components', componentsRouter);
app.use('/report', reportRouter);
app.use('/simulator', simulatorRouter);
// Router successivi (montati man mano che le fasi avanzano):
// app.use('/market', marketRouter);
// app.use('/drs', drsRouter);
// app.use('/auction', auctionRouter);
// app.use('/messages', messagesRouter);

app.listen(PORT, () => {
  console.log(`FantaFormula1 backend in ascolto su http://localhost:${PORT}`);
});

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

app.get('/health', (_req, res) => res.json({ ok: true }));

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
// Router successivi (montati man mano che le fasi avanzano):
// app.use('/market', marketRouter);
// app.use('/drs', drsRouter);
// app.use('/auction', auctionRouter);
// app.use('/messages', messagesRouter);

app.listen(PORT, () => {
  console.log(`FantaFormula1 backend in ascolto su http://localhost:${PORT}`);
});

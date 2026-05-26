import 'dotenv/config';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import ticketsRoutes from './routes/tickets.js';

// Force IPv4 first — Atlas SRV via Node's c-ares can ECONNREFUSED on Windows
// when the system resolver answers AAAA before A.
dns.setDefaultResultOrder('ipv4first');
// Override c-ares with public resolvers; the system resolver was refusing SRV.
dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '256kb' }));

app.get('/', (_req, res) => {
  res.json({ name: 'deskflow-api', ok: true });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/tickets', ticketsRoutes);

// 404 for anything else
app.use((req, res) => {
  res.status(404).json({ error: `route not found: ${req.method} ${req.path}` });
});

// Last-resort error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('unhandled:', err);
  res.status(500).json({ error: 'internal server error' });
});

const PORT = parseInt(process.env.PORT || '4000', 10);

(async () => {
  try {
    await connect(process.env.MONGODB_URI);
    app.listen(PORT, () => console.log(`api: listening on :${PORT}`));
  } catch (e) {
    console.error('startup failed:', e.message);
    process.exit(1);
  }
})();

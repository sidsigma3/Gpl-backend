import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cricheroesRouter from './routes/cricheroes.js';
import adminRouter from './routes/admin.js';
import aiRouter from './routes/ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api', cricheroesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});

app.listen(PORT, () => {
  console.log(`Banavasi Backend running on port ${PORT}`);
});

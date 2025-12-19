<<<<<<< HEAD
=======

>>>>>>> 6974c8e (working)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import router from './routes';
<<<<<<< HEAD
=======
import cleanupRouter from './routes/cleanup';
>>>>>>> 6974c8e (working)

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Health endpoints for frontend preflight
app.get('/api/health', (_req, res) => res.json({ status: 'OK', message: 'Server is running' }));
app.get('/health', (_req, res) => res.json({ status: 'OK', message: 'Server is running' }));

// DB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/result-analyzer';
mongoose
  .connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

<<<<<<< HEAD
// Mount routes (contain /api/... and non-prefixed endpoints expected by the frontend)
app.use('/', router);

=======

// Mount routes (contain /api/... and non-prefixed endpoints expected by the frontend)
app.use('/', router);

// Mount cleanup routes
app.use('/api', cleanupRouter);

>>>>>>> 6974c8e (working)
const PORT = process.env.PORT ? Number(process.env.PORT) : 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

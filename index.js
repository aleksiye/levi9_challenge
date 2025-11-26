import express from 'express';
import redisClient from './config/redis.js' ;
import studentRoutes from './routes/students.js';
import canteenRoutes from './routes/canteens.js';
import reservationRoutes from './routes/reservations.js';

const app = express();
app.use(express.json());

await redisClient.flushAll();
console.log('Flushed all Redis data on startup.');

app.use('/students', studentRoutes);
app.use('/canteens', canteenRoutes);
app.use('/reservations', reservationRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

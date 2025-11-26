import express from 'express';
import './config/redis.js' ;
import studentRoutes from './routes/students.js';
import canteenRoutes from './routes/canteens.js';

const app = express();
app.use(express.json());

app.use('/students', studentRoutes);
app.use('/canteens', canteenRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

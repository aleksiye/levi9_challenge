import express from 'express';
import { createReservation, deleteReservation } from '../services/reservactionService.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const reservation = await createReservation(req.body);
        res.status(201).json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const studentId = req.headers['studentid'];
        if (!studentId) {
            return res.status(400).json({ error: 'Missing studentId header' });
        }
        const deletedReservation = await deleteReservation(req.params.id, studentId);
        if (!deletedReservation) {
            return res.status(404).json({ error: 'Reservation not found or unauthorized' });
        }
        res.json(deletedReservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
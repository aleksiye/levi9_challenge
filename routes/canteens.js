import express from 'express';
import { createCanteen, getCanteen, getAllCanteens, updateCanteen } from '../services/canteenService.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const canteen = await createCanteen(req.body);
        res.status(201).json(canteen);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const canteens = await getAllCanteens();
        res.json(canteens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const canteen = await getCanteen(req.params.id);
        if (!canteen) return res.status(404).json({ error: 'Canteen not found' });
        res.json(canteen);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedCanteen = await updateCanteen(req.params.id, req.body);
        if (!updatedCanteen) return res.status(404).json({ error: 'Canteen not found' });
        res.json(updatedCanteen);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const success = await deleteCanteen(req.params.id);
        if (!success) return res.status(404).json({ error: 'Canteen not found' });
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
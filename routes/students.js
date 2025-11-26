import express from 'express';
import { createStudent, getStudent } from '../services/studentService.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const student = await createStudent(req.body);
        res.status(201).json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const student = await getStudent(req.params.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
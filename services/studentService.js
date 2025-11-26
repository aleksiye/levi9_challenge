import redisClient from "../config/redis.js";

const STUDENT_COUNTER_KEY = 'student:id:counter';
const STUDENT_EMAIL_INDEX = 'student:email:index';

export async function createStudent(studentData) {
    // check if email aleady exists
    const existingId = await redisClient.hGet(STUDENT_EMAIL_INDEX, studentData.email);
    if (existingId) {
        throw new Error('Email already in use');
    }

    const id = await redisClient.incr(STUDENT_COUNTER_KEY);
    const studentKey = `student:${id}`;
    
    await redisClient.hSet(studentKey, {
        id: id,
        name: studentData.name,
        email: studentData.email,
        isAdmin: studentData.isAdmin ? 'true' : 'false'
    });

    await redisClient.hSet(STUDENT_EMAIL_INDEX, studentData.email, id);

    return { id, ...studentData };
}

export async function getStudent(id) {
    const student = await redisClient.hGetAll(`student:${id}`);
    if (Object.keys(student).length === 0) {
        return null;
    }
    return {
        id: parseInt(student.id, 10),
        name: student.name,
        email: student.email,
        isAdmin: student.isAdmin === 'true',
    };
}
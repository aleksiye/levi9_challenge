import redisClient from "../config/redis.js";

const STUDENT_COUNTER_KEY = 'student:id:counter';

export async function createStudent(studentData) {
    const id = await redisClient.incr(STUDENT_COUNTER_KEY);
    const studentKey = `student:${id}`;
    
    await redisClient.hSet(studentKey, {
        id: id.toString(),
        name: studentData.name,
        email: studentData.email,
        isAdmin: studentData.isAdmin ? 'true' : 'false'
    });

    return { id, ...studentData };
}

export async function getStudent(id) {
    const student = await redisClient.hGetAll(`student:${id}`);
    return Object.keys(student).length ? student : null;
}
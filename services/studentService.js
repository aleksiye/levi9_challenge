import prisma from "../config/db.js";

export async function createStudent(studentData) {
    // Validate required fields exist
    if (!studentData.name || typeof studentData.name !== 'string') {
        throw new Error('Name is required');
    }
    if (!studentData.email || typeof studentData.email !== 'string') {
        throw new Error('Email is required');
    }
    // Validate name length
    const trimmedName = studentData.name.trim();
    if (trimmedName.length < 1) {
        throw new Error('Name cannot be empty');
    }
    if (trimmedName.length > 100) {
        throw new Error('Name cannot exceed 100 characters');
    }
    // check if email already exists
    const existingStudent = await prisma.student.findUnique({
        where: { email: studentData.email }
    });
    if (existingStudent) {
        throw new Error('Email already in use');
    }
    // validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentData.email)) {
        throw new Error('Invalid email format');
    }
    // Should continue with ZeroBounce or similar email validation service in production

    const student = await prisma.student.create({
        data: {
            name: trimmedName,
            email: studentData.email,
            isAdmin: studentData.isAdmin ? true : false
        }
    });

    return {
        id: student.id,
        name: student.name,
        email: student.email,
        isAdmin: student.isAdmin
    };
}

export async function getStudent(id) {
    const student = await prisma.student.findUnique({
        where: { id: parseInt(id, 10) }
    });
    if (!student) {
        return null;
    }
    return {
        id: student.id,
        name: student.name,
        email: student.email,
        isAdmin: student.isAdmin
    };
}
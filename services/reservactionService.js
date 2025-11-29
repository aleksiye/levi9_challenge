import prisma from "../config/db.js";
import { getCanteen } from "./canteenService.js";

/**
 * Get the 30-min slot times affected by a reservation
 * For 30-min duration: 1 slot (the start time)
 * For 60-min duration: 2 slots (start time and start time + 30 min)
 */
function getAffectedSlotTimes(time, duration) {
    const times = [time];

    if (parseInt(duration) === 60) {
        // Add the next 30-min slot
        const [hours, minutes] = time.split(':').map(Number);
        const nextMinutes = minutes + 30;
        const nextHours = hours + Math.floor(nextMinutes / 60);
        const nextTime = `${String(nextHours).padStart(2, '0')}:${String(nextMinutes % 60).padStart(2, '0')}`;
        times.push(nextTime);
    }

    return times;
}

/**
 * Check if a time falls within a meal period
 */
function isTimeInMealPeriod(workingHours, time) {
    for (const period of workingHours) {
        if (time >= period.from && time < period.to) {
            return true;
        }
    }
    return false;
}

/**
 * Validate that for 60-min duration, the end time also falls within meal period
 */
function isValidReservationTime(workingHours, time, duration) {
    if (!isTimeInMealPeriod(workingHours, time)) {
        return false;
    }

    if (parseInt(duration) === 60) {
        // Check that the slot only starts at even hours
        const [, minutes] = time.split(':').map(Number);
        if (minutes !== 0) {
            return false;
        }

        // Check that end time (start + 30 min) is also within meal period
        const [hours] = time.split(':').map(Number);
        const nextTime = `${String(hours).padStart(2, '0')}:30`;
        if (!isTimeInMealPeriod(workingHours, nextTime)) {
            return false;
        }
    }

    return true;
}

function validateReservationData(reservationData) {
    const { studentId, canteenId, date, time, duration } = reservationData;

    // Validate studentId
    if (studentId === undefined || studentId === null) {
        throw new Error('studentId is required');
    }
    const parsedStudentId = parseInt(studentId, 10);
    if (isNaN(parsedStudentId) || parsedStudentId < 1) {
        throw new Error('studentId must be a positive integer');
    }

    // Validate canteenId
    if (canteenId === undefined || canteenId === null) {
        throw new Error('canteenId is required');
    }
    const parsedCanteenId = parseInt(canteenId, 10);
    if (isNaN(parsedCanteenId) || parsedCanteenId < 1) {
        throw new Error('canteenId must be a positive integer');
    }

    // Validate date format (YYYY-MM-DD)
    if (!date || typeof date !== 'string') {
        throw new Error('date is required');
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        throw new Error('Invalid date format. Must be YYYY-MM-DD');
    }
    // Validate date is a real date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date');
    }

    // Validate time format (HH:mm)
    if (!time || typeof time !== 'string') {
        throw new Error('time is required');
    }
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
        throw new Error('Invalid time format. Must be HH:mm');
    }

    // Validate duration
    if (duration === undefined || duration === null) {
        throw new Error('duration is required');
    }
    const parsedDuration = parseInt(duration, 10);
    if (parsedDuration !== 30 && parsedDuration !== 60) {
        throw new Error('duration must be 30 or 60');
    }

    // Validate 60-min slots start at even hours
    if (parsedDuration === 60) {
        const [, minutes] = time.split(':').map(Number);
        if (minutes !== 0) {
            throw new Error('60-minute reservations must start at even hours (e.g., 08:00, 09:00)');
        }
    }

    return {
        studentId: parsedStudentId,
        canteenId: parsedCanteenId,
        date,
        time,
        duration: parsedDuration
    };
}

export async function createReservation(reservationData) {
    const { canteenId, date, time, duration, studentId } = validateReservationData(reservationData);

    // Fetch canteen to get capacity and workingHours
    const canteen = await getCanteen(canteenId);
    if (!canteen) {
        throw new Error('Canteen not found');
    }
    
    // Check if user exists
    const student = await prisma.student.findUnique({
        where: { id: studentId }
    });
    if (!student) {
        throw new Error('Student not found');
    }
    
    // Validate date is not in the past
    const today = new Date();
    const reservationDate = new Date(`${date}T${time}:00`);

    if (reservationDate < today) {
        throw new Error('Reservation date and time cannot be in the past');
    }

    // Validate time is within working hours
    if (!isValidReservationTime(canteen.workingHours, time, duration)) {
        throw new Error('Invalid reservation time or duration');
    }

    const slotTimes = getAffectedSlotTimes(time, duration);
    const capacity = canteen.capacity;
    const reservationDateObj = new Date(date);

    // Use Prisma transaction to check capacity and create reservation atomically
    const reservation = await prisma.$transaction(async (tx) => {
        // Check if student already has an ACTIVE reservation for any affected time slot (globally)
        for (const slotTime of slotTimes) {
            const existingReservation = await tx.reservation.findFirst({
                where: {
                    studentId,
                    date: reservationDateObj,
                    time: slotTime,
                    status: 'Active'
                }
            });
            if (existingReservation) {
                throw new Error('Student already has a reservation for this time slot');
            }
        }

        // Check capacity for all affected slots
        for (const slotTime of slotTimes) {
            const count = await tx.reservation.count({
                where: {
                    canteenId,
                    date: reservationDateObj,
                    time: slotTime,
                    status: 'Active'
                }
            });
            if (count >= capacity) {
                throw new Error(`Slot at ${slotTime} is fully booked`);
            }
        }

        // Create the reservation
        const newReservation = await tx.reservation.create({
            data: {
                studentId,
                canteenId,
                date: reservationDateObj,
                time,
                duration,
                status: 'Active'
            }
        });

        return newReservation;
    });

    return { 
        id: reservation.id, 
        studentId: reservation.studentId,
        date: date,
        time: reservation.time,
        duration: reservation.duration,
        canteenId: reservation.canteenId, 
        status: reservation.status 
    };
}

export async function getReservationsByStudent(studentId, startDate, endDate) {
    if (!startDate || !endDate) {
        throw new Error('startDate and endDate are required');
    }

    const reservations = await prisma.reservation.findMany({
        where: {
            studentId: parseInt(studentId, 10),
            date: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        orderBy: [
            { date: 'asc' },
            { time: 'asc' }
        ]
    });

    return reservations.map(r => ({
        id: r.id,
        studentId: r.studentId,
        canteenId: r.canteenId,
        date: r.date.toISOString().split('T')[0],
        time: r.time,
        duration: r.duration,
        status: r.status
    }));
}

export async function deleteReservation(reservationId, studentId) {
    const reservation = await prisma.reservation.findUnique({
        where: { id: parseInt(reservationId, 10) }
    });
    
    if (!reservation) {
        return null;
    }
    if (reservation.studentId !== parseInt(studentId, 10)) {
        return null;
    }
    if (reservation.status === 'Cancelled') {
        return null; // Already cancelled
    }

    // Update reservation status to Cancelled
    const updatedReservation = await prisma.reservation.update({
        where: { id: parseInt(reservationId, 10) },
        data: { status: 'Cancelled' }
    });

    return {
        id: updatedReservation.id,
        status: updatedReservation.status,
        studentId: updatedReservation.studentId,
        canteenId: updatedReservation.canteenId,
        date: updatedReservation.date.toISOString().split('T')[0],
        time: updatedReservation.time,
        duration: updatedReservation.duration
    };
}
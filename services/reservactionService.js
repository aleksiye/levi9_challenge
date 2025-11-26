import redisClient from "../config/redis.js";
import { getCanteen } from "./canteenService.js";

const RESERVATION_COUNTER_KEY = 'reservation:id:counter';

/**
 * Get the 30-min slot keys affected by a reservation
 * For 30-min duration: 1 slot (the start time)
 * For 60-min duration: 2 slots (start time and start time + 30 min)
 */
function getAffectedSlotKeys(canteenId, date, time, duration) {
    const keys = [];
    const slotKey = `slot:${canteenId}:${date}:${time}`;
    keys.push(slotKey);

    if (parseInt(duration) === 60) {
        // Add the next 30-min slot
        const [hours, minutes] = time.split(':').map(Number);
        const nextMinutes = minutes + 30;
        const nextHours = hours + Math.floor(nextMinutes / 60);
        const nextTime = `${String(nextHours).padStart(2, '0')}:${String(nextMinutes % 60).padStart(2, '0')}`;
        keys.push(`slot:${canteenId}:${date}:${nextTime}`);
    }

    return keys;
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

export async function createReservation(reservationData) {
    const { canteenId, date, time, duration } = reservationData;

    // Fetch canteen to get capacity and workingHours
    const canteen = await getCanteen(canteenId);
    if (!canteen) {
        throw new Error('Canteen not found');
    }

    // Validate time is within working hours
    if (!isValidReservationTime(canteen.workingHours, time, duration)) {
        throw new Error('Invalid reservation time or duration');
    }

    const slotKeys = getAffectedSlotKeys(canteenId, date, time, duration);
    const capacity = canteen.capacity;

    // Use transaction to check capacity and create reservation atomically
    const multi = redisClient.multi();

    // Get current counts for all affected slots
    for (const key of slotKeys) {
        multi.get(key);
    }

    const currentCounts = await multi.exec();

    // Check if all slots have capacity
    for (let i = 0; i < slotKeys.length; i++) {
        const count = parseInt(currentCounts[i] || '0', 10);
        if (count >= capacity) {
            throw new Error(`Slot ${slotKeys[i]} is fully booked`);
        }
    }

    // Create reservation and increment slot counters in a transaction
    const createMulti = redisClient.multi();

    const id = await redisClient.incr(RESERVATION_COUNTER_KEY);
    const reservationKey = `reservation:${id}`;

    createMulti.hSet(reservationKey, {
        id: parseInt(id, 10),
        studentId: parseInt(reservationData.studentId, 10),
        canteenId: parseInt(canteenId, 10),
        date: date,
        time: time,
        duration: parseInt(duration, 10),
        status: 'Active',
        createdAt: new Date().toISOString()
    });
    /*
    console.log('Creating reservation with key:', reservationKey);
    console.log('Affected slot keys:', slotKeys);
    console.log('Current slot counts:', currentCounts);
    console.log('Creating reservation with data:', {
        id: parseInt(id, 10),
        studentId: parseInt(reservationData.studentId, 10),
        canteenId: parseInt(canteenId, 10),
        date: date,
        time: time,
        duration: duration.toString(),
        status: 'Active',
        createdAt: new Date().toISOString()
    });*/

    // Increment all affected slot counters
    for (const key of slotKeys) {
        createMulti.incr(key);
    }

    await createMulti.exec();

    return { 
        id: parseInt(id, 10), 
        studentId: parseInt(reservationData.studentId, 10),
        date: date,
        time: time,
        duration: parseInt(duration, 10),
        canteenId: parseInt(canteenId, 10), 
        status: 'Active' };
}

export async function deleteReservation(reservationId, studentId) {
    const reservationKey = `reservation:${reservationId}`;
    const reservation = await redisClient.hGetAll(reservationKey);
    if (Object.keys(reservation).length === 0) {
        return null;
    }
    if (reservation.studentId !== studentId) {
        return null;
    }
    if (reservation.status === 'Cancelled') {
        return null; // Already cancelled
    }

    const slotKeys = getAffectedSlotKeys(
        reservation.canteenId,
        reservation.date,
        reservation.time,
        reservation.duration
    );

    // Use transaction to cancel reservation and decrement slot counters
    const multi = redisClient.multi();

    multi.hSet(reservationKey, 'status', 'Cancelled');

    // Decrement all affected slot counters
    for (const key of slotKeys) {
        multi.decr(key);
    }

    await multi.exec();

    const updatedReservation = await redisClient.hGetAll(reservationKey);
    return {
        id: parseInt(updatedReservation.id, 10),
        status: updatedReservation.status,
        studentId: parseInt(updatedReservation.studentId, 10),
        canteenId: parseInt(updatedReservation.canteenId, 10),
        date: updatedReservation.date,
        time: updatedReservation.time,
        duration: parseInt(updatedReservation.duration, 10)
    };
}
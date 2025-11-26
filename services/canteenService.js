import redisClient from "../config/redis.js";

const CANTEEN_COUNTER_KEY = 'canteen:id:counter';

/**
 * Get the meal name for a given time based on workingHours
 */
function getMealForTime(workingHours, time) {
    for (const period of workingHours) {
        if (time >= period.from && time < period.to) {
            return period.meal;
        }
    }
    return null;
}

/**
 * Generate all time slots between start and end times for a single date
 * For 30-min duration: every 30-min slot
 * For 60-min duration: only slots starting at even hours (:00)
 */
function generateTimeSlotsForDate(date, startTime, endTime, duration, workingHours) {
    const slots = [];
    const durationMin = parseInt(duration);

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    const endTotalMinutes = endHour * 60 + endMinute;

    while (true) {
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        // For 60-min slots, we need the next 30-min slot to exist
        const slotEndMinutes = currentTotalMinutes + durationMin;

        if (slotEndMinutes > endTotalMinutes) {
            break;
        }

        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const meal = getMealForTime(workingHours, timeStr);

        // Only include slots that fall within a meal period
        if (meal) {
            // For 60-min duration, check that the second 30-min slot is also in the meal period
            if (durationMin === 60) {
                const nextTime = `${String(currentHour).padStart(2, '0')}:30`;
                const nextMeal = getMealForTime(workingHours, nextTime);
                if (nextMeal === meal) {
                    slots.push({ date, time: timeStr, meal });
                }
            } else {
                slots.push({ date, time: timeStr, meal });
            }
        }

        // Move to next slot
        if (durationMin === 60) {
            // 60-min slots only start at even hours
            currentHour += 1;
            currentMinute = 0;
        } else {
            // 30-min slots advance by 30 minutes
            currentMinute += 30;
            if (currentMinute >= 60) {
                currentMinute = 0;
                currentHour += 1;
            }
        }
    }

    return slots;
}

/**
 * Generate all time slots in a date/time range
 */
function generateTimeSlots(startDate, startTime, endDate, endTime, duration, workingHours) {
    const slots = [];
    const durationMin = parseInt(duration);

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        // Determine time range for this date
        const dayStartTime = dateStr === startDate ? startTime : '00:00';
        const dayEndTime = dateStr === endDate ? endTime : '23:59';

        const daySlots = generateTimeSlotsForDate(dateStr, dayStartTime, dayEndTime, durationMin, workingHours);
        slots.push(...daySlots);
    }

    return slots;
}

/**
 * Get canteen status with available slots
 */
export async function getCanteenStatus(canteenId, startDate, startTime, endDate, endTime, duration) {
    const canteen = await getCanteen(canteenId);
    if (!canteen) {
        return null;
    }

    const durationMin = parseInt(duration);
    const slots = generateTimeSlots(startDate, startTime, endDate, endTime, durationMin, canteen.workingHours);

    // Fetch current counts for all slots
    const result = [];

    for (const slot of slots) {
        const slotKey = `slot:${canteenId}:${slot.date}:${slot.time}`;

        if (durationMin === 60) {
            // For 60-min slots, get both 30-min slot counts
            const [hours] = slot.time.split(':').map(Number);
            const nextTime = `${String(hours).padStart(2, '0')}:30`;
            const nextSlotKey = `slot:${canteenId}:${slot.date}:${nextTime}`;

            const [count1, count2] = await Promise.all([
                redisClient.get(slotKey),
                redisClient.get(nextSlotKey)
            ]);

            const used1 = parseInt(count1 || '0', 10);
            const used2 = parseInt(count2 || '0', 10);
            const remainingCapacity = canteen.capacity - Math.max(used1, used2);

            result.push({
                date: slot.date,
                meal: slot.meal,
                startTime: slot.time,
                remainingCapacity: Math.max(0, remainingCapacity)
            });
        } else {
            // For 30-min slots
            const count = await redisClient.get(slotKey);
            const used = parseInt(count || '0', 10);
            const remainingCapacity = canteen.capacity - used;

            result.push({
                date: slot.date,
                meal: slot.meal,
                startTime: slot.time,
                remainingCapacity: Math.max(0, remainingCapacity)
            });
        }
    }

    return { slots: result };
}

/**
 * Get status for all canteens
 */
export async function getAllCanteensStatus(startDate, startTime, endDate, endTime, duration) {
    const canteens = await getAllCanteens();
    const results = [];

    for (const canteen of canteens) {
        const status = await getCanteenStatus(canteen.id, startDate, startTime, endDate, endTime, duration);
        results.push({
            canteenId: canteen.id,
            name: canteen.name,
            slots: status.slots
        });
    }

    return results;
}

export async function createCanteen(canteenData) {
    const id = await redisClient.incr(CANTEEN_COUNTER_KEY);
    const canteenKey = `canteen:${id}`;
    await redisClient.hSet(canteenKey, {
        id: id.toString(),
        name: canteenData.name,
        location: canteenData.location,
        capacity: canteenData.capacity,
        workingHours: JSON.stringify(canteenData.workingHours),
        createdBy: canteenData.createdBy,
        createdAt: new Date().toISOString()
    });
    const { createdBy, createdAt, ...publicData } = canteenData;
    return { id, ...publicData };
}

function sanitizeCanteen(canteen) {
    return {
        id: parseInt(canteen.id, 10),
        name: canteen.name,
        location: canteen.location,
        capacity: parseInt(canteen.capacity, 10),
        workingHours: JSON.parse(canteen.workingHours)
    };
}

export async function getAllCanteens() {
    const canteenIds = await redisClient.keys('canteen:*');
    const canteens = [];
    for (const key of canteenIds) {
        if (key === CANTEEN_COUNTER_KEY) continue;
        const canteen = await redisClient.hGetAll(key);
        canteens.push(sanitizeCanteen(canteen));
    }
    return canteens;
}

export async function getCanteen(id) {
    const canteen = await redisClient.hGetAll(`canteen:${id}`);
    if (Object.keys(canteen).length === 0) {
        return null;
    }
    return {
        id: parseInt(canteen.id, 10),
        name: canteen.name,
        location: canteen.location,
        capacity: parseInt(canteen.capacity, 10),
        workingHours: JSON.parse(canteen.workingHours)
    };
}

export async function updateCanteen(id, updateData) {
    const canteenKey = `canteen:${id}`;
    const existingCanteen = await redisClient.hGetAll(canteenKey);
    if (Object.keys(existingCanteen).length === 0) {
        return null;
    }
    const updatedCanteen = { ...existingCanteen, ...updateData };
    await redisClient.hSet(canteenKey, updatedCanteen);
    return updatedCanteen;
}

export async function deleteCanteen(id) {
    const canteenKey = `canteen:${id}`;
    const result = await redisClient.del(canteenKey);
    return result === 1;
}
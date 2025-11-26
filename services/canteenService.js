import redisClient from "../config/redis.js";

const CANTEEN_COUNTER_KEY = 'canteen:id:counter';

export async function createCanteen(canteenData) {
    const id = await redisClient.incr(CANTEEN_COUNTER_KEY);
    const canteenKey = `canteen:${id}`;
    await redisClient.hSet(canteenKey, {
        id: id.toString(),
        name: canteenData.name,
        location: canteenData.location
    });
    return { id, ...canteenData };
}

export async function getAllCanteens() {
    const canteenIds = await redisClient.keys('canteen:*');
    const canteens = [];
    for (const key of canteenIds) {
        const canteen = await redisClient.hGetAll(key);
        canteens.push(canteen);
    }
    return canteens;
}

export async function getCanteen(id) {
    const canteen = await redisClient.hGetAll(`canteen:${id}`);
    return Object.keys(canteen).length ? canteen : null;
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
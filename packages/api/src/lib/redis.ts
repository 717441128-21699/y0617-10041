import Redis from 'ioredis';
import { config } from '../config';

class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.redis.url);
    }
    return RedisClient.instance;
  }
}

export const redis = RedisClient.getInstance();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function incrementCounter(key: string): Promise<number> {
  return redis.incr(key);
}

export async function getCounter(key: string): Promise<number> {
  const value = await redis.get(key);
  return value ? parseInt(value, 10) : 0;
}

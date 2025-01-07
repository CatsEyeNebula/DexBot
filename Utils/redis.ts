import { Redis, RedisKey, RedisOptions } from "ioredis";

export class RedisUtil {
  client: Redis;
  options: RedisOptions;
  constructor(options) {
    this.options = options;
    this.client = new Redis(options);
  }

  async get(key: RedisKey) {
    return await this.client.get(key);
  }

  async set(key: RedisKey, value: string | number | Buffer, ttl = null) {
    if (ttl) {
      return await this.client.setex(key, ttl, value);
    } else {
      return await this.client.set(key, value);
    }
  }

  async delete(...keys: RedisKey[]) {
    const result = await this.client.unlink(...keys);
    return result;
  }

  async publish(channel: string, message: string) {
    return await this.client.publish(channel, message);
  }

  async subscribe(channel: string, handler) {
    const subscriber = new Redis(this.options);
    await subscriber.subscribe(channel);
    subscriber.on("message", handler);
    return subscriber;
  }

  async lock(key: string, value: string | number, ttl = 30000) {
    const result = await this.client.set(key, value, "PX", ttl, "NX");
    return result === "OK";
  }

  async unlock(key: string, value: string) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    const result = await this.client.eval(script, 1, key, value);
    return result === 1;
  }
}

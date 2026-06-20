type RedisValue = string | number;

export interface InMemoryRedisClient {
  incr: (key: string) => Promise<number>;
  expire: (key: string, ttl: number) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: RedisValue) => Promise<string>;
  del: (key: string) => Promise<number>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
  srem: (key: string, ...members: string[]) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  publish: (channel: string, message: string) => Promise<number>;
  subscribe: (channel: string) => Promise<number>;
  unsubscribe: (channel: string) => Promise<number>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off: (event: string, listener: (...args: unknown[]) => void) => void;
  quit: () => Promise<void>;
  reset: () => void;
}

export function createInMemoryRedisClient(): InMemoryRedisClient {
  const store = new Map<string, number>();

  const client: InMemoryRedisClient = {
    incr: jest.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => 1),
    get: jest.fn(async (key: string) => {
      const value = store.get(key);
      return value === undefined ? null : String(value);
    }),
    set: jest.fn(async (key: string, value: RedisValue) => {
      store.set(key, Number(value));
      return "OK";
    }),
    del: jest.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    sadd: jest.fn(async () => 1),
    srem: jest.fn(async () => 1),
    smembers: jest.fn(async () => []),
    publish: jest.fn(async () => 1),
    subscribe: jest.fn(async () => 1),
    unsubscribe: jest.fn(async () => 1),
    on: jest.fn(),
    off: jest.fn(),
    quit: jest.fn(async () => undefined),
    reset: () => {
      store.clear();
    }
  };

  return client;
}

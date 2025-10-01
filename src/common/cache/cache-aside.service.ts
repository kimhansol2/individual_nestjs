import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';

type GetOrLoadOptions = {
  // 개별 호출 TTL(초) - 미지정 시 CacheModule 기본 TTL 사용
  ttlSec?: number;
  // 무효화용 인덱스 세트 이름. 지정 시 키를 세트에 등록
  index?: string | string[];
  // 스탬피드 방지 락 유지 시간
  lockMs?: number;
};

type RedisStoreLike = { getClient: () => Redis };
const hasGetClient = (x: unknown): x is RedisStoreLike => {
  const o = x as { getClient?: unknown } | null;
  return !!o && typeof o.getClient === 'function';
};

@Injectable()
export class CacheAsideService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private get redis(): Redis | null {
    const storeUnknown = Reflect.get(this.cache as object, 'store') as unknown;
    return hasGetClient(storeUnknown) ? storeUnknown.getClient() : null;
  }

  private async sleep(ms: number) {
    await new Promise<void>((r) => setTimeout(r, ms));
  }

  private asArray(v?: string | string[]) {
    return Array.isArray(v) ? v : v ? [v] : [];
  }

  private async addToIndices(
    indices: string[],
    key: string,
    client: Redis | null,
  ) {
    if (!client || indices.length === 0) return;
    await Promise.all(indices.map((idx) => client.sadd(idx, key)));
  }

  // Cache-Aside(+single-flight) 핵심
  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    opts: GetOrLoadOptions = {},
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== undefined && cached !== null) return cached;

    const lockKey = `lock:${key}`;
    const lockMs = opts.lockMs ?? 5000;

    const client = this.redis;

    //SET NX PX로 락 시도
    const locked = client
      ? await client.set(lockKey, '1', 'PX', lockMs, 'NX')
      : 'OK';
    if (locked) {
      try {
        const data = await loader();

        if (opts.ttlSec !== undefined)
          await this.cache.set(key, data, opts.ttlSec);
        else await this.cache.set(key, data);

        //인덱스 등록
        const indices = this.asArray(opts.index);
        await this.addToIndices(indices, key, client);

        return data;
      } finally {
        if (client) await client.del(lockKey);
      }
    }

    // 누군가 로딩 중 -> 짧게 대기 후 재조회
    await this.sleep(80);
    const retry = await this.cache.get<T>(key);
    if (retry !== undefined && retry !== null) return retry;

    //혹시 락이 끊겼는데 아직 미적재라면 안전하게 직접 로드
    const data = await loader();
    if (opts.ttlSec !== undefined) await this.cache.set(key, data, opts.ttlSec);
    else await this.cache.set(key, data);

    const indices = this.asArray(opts.index);
    await this.addToIndices(indices, key, client);
    return data;
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  // 인덱스 기반 무효화 (세트에 등록된 모든 키 삭제 후 세트 제거)
  async invalidateByIndex(index: string): Promise<void> {
    const client = this.redis;
    if (!client) return;
    const keys = await client.smembers(index);
    if (keys.length) {
      await Promise.all(keys.map((k) => this.cache.del(k)));
    }
    await client.del(index);
  }

  // 여러 인덱스를 한번에 무효화
  async invalidateByIndices(indices: string[]): Promise<void> {
    await Promise.all(indices.map((idx) => this.invalidateByIndex(idx)));
  }
}

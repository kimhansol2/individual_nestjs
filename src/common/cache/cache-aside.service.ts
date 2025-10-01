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

interface RedisStoreWithClient {
  getClient(): Redis;
}

@Injectable()
export class CacheAsideService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private get redis(): Redis {
    const store = this.cache.stores as unknown as RedisStoreWithClient;
    return store.getClient();
  }

  private async sleep(ms: number) {
    await new Promise<void>((r) => setTimeout(r, ms));
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

    //SET NX PX로 락 시도
    const locked = await this.redis.set(lockKey, '1', 'PX', lockMs, 'NX');
    if (locked) {
      try {
        const data = await loader();

        if (opts.ttlSec !== undefined)
          await this.cache.set(key, data, opts.ttlSec);
        else await this.cache.set(key, data);

        //인덱스 등록
        const indices = Array.isArray(opts.index)
          ? opts.index
          : opts.index
            ? [opts.index]
            : [];
        await Promise.all(indices.map((idx) => this.redis.sadd(idx, key)));

        return data;
      } finally {
        await this.redis.del(lockKey);
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

    const indices = Array.isArray(opts.index)
      ? opts.index
      : opts.index
        ? [opts.index]
        : [];
    await Promise.all(indices.map((idx) => this.redis.sadd(idx, key)));

    return data;
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  // 인덱스 기반 무효화 (세트에 등록된 모든 키 삭제 후 세트 제거)
  async invalidateByIndex(index: string): Promise<void> {
    const keys = await this.redis.smembers(index);
    if (keys.length) await this.redis.del(...keys);
    await this.redis.del(index);
  }

  // 여러 인덱스를 한번에 무효화
  async invalidateByIndices(indices: string[]): Promise<void> {
    await Promise.all(indices.map((idx) => this.invalidateByIndex(idx)));
  }
}

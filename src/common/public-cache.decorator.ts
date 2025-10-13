import { SetMetadata } from '@nestjs/common';
export const PUBLIC_CACHE_KEY = 'publicCache';
export type PublicCacheOpts = {
  maxAge?: number; //브라우저
  sMaxAge?: number; //CDN/프록시
  weak?: boolean; //Weak ETag 쓸지
};
export const PublicCache = (opts: PublicCacheOpts = {}) =>
  SetMetadata(PUBLIC_CACHE_KEY, {
    maxAge: 300,
    sMaxAge: 600,
    weak: true,
    ...opts,
  });

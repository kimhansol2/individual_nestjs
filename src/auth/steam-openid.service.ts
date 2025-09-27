import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { errorSummary } from 'src/common/error.util';

const OP = 'https://steamcommunity.com/openid/login';

@Injectable()
export class SteamOpenIdService {
  private readonly realm: string;
  private readonly returnTo: string;

  constructor(
    private readonly cfg: ConfigService,
    @Inject('REDIS') private readonly redis: Redis,
  ) {
    this.realm = this.cfg.getOrThrow<string>('STEAM_REALM');
    this.returnTo = this.cfg.getOrThrow<string>('STEAM_RETURN_TO');
  }

  // 로그인 시작 URL 생성
  async buildRedirectUrl(): Promise<string> {
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    // 10분 TTL
    await this.redis
      .multi()
      .set(`oid:state:${state}`, '1', 'EX', 600, 'NX')
      .set(`oid:nonce:${nonce}`, '1', 'EX', 600, 'NX')
      .exec();

    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': this.returnTo,
      'openid.realm': this.realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });
    const url = `${OP}?${params.toString()}&state=${state}&nonce=${nonce}`;
    return url;
  }

  // 콜백 검증 + SteamID64 추출
  async verifyCallback(
    query: Record<string, string>,
  ): Promise<{ steamid64: string; state?: string }> {
    try {
      const mode = query['openid.mode'];
      if (mode !== 'id_res')
        throw new BadRequestException('invalid openid mode');

      // return_to 체크(우리 콜백 URL과 완전 동일해야함)
      const returnTo = query['openid.return_to'];
      if (!returnTo || !returnTo.startsWith(this.returnTo)) {
        throw new BadRequestException('return_to mismatch');
      }

      // state, nonce 체크
      const state =
        new URL(returnTo).searchParams.get('state') ?? query['state'];
      const nonce = query['openid.response_nonce'];
      if (!state || !nonce)
        throw new BadRequestException('state or nonce missing');

      const consumed = await this.redis
        .multi()
        .del(`oid:state:${state}`)
        .del(`oid:nonce:${nonce}`)
        .exec();

      if (
        !consumed ||
        consumed.some((r) => (Array.isArray(r) ? r[1] : r) === 0)
      ) {
        throw new BadRequestException('replay detected or unknown state/nonce');
      }

      // OpenId 서명 검증: Steam OP에 check_authentication 요청
      const body = new URLSearchParams({
        'openid.mode': 'check_authentication',
      });
      for (const [k, v] of Object.entries(query)) {
        if (k.startsWith('openid.')) body.append(k, v);
      }

      const { data } = await axios.post(OP, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 7000,
      });

      const isValid =
        typeof data === 'string' && data.includes('is_valid:true');
      if (!isValid) throw new BadRequestException('invalid openid signature');

      // steamid64 파싱
      const claimed = query['openid.claimed_id'] ?? '';
      const match = claimed.match(/\/id\/(\d{17})$|\/openid\/id\/(\d{17})$/);
      const steamid64 = match?.[1] ?? match?.[2];
      if (!steamid64) throw new BadRequestException('steamid parse failed');

      return { steamid64, state: state || undefined };
    } catch (e: unknown) {
      throw new BadRequestException(
        `OpenID verification failed: ${errorSummary(e)}`,
      );
    }
  }
}

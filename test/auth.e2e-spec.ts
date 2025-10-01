import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { SteamAuthController } from '../src/auth/auth.controller';
import { SteamOpenIdService } from '../src/auth/steam-openid.service';
import { UsersRepository } from '../src/domain/users/users.repository';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

//axios 모킹 (OpenID check_authentication & GetPlayerSummaries)
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ioredis multi/exec 응답 튜플 타입
type ExecReply = [error: null, value: 'OK' | 1 | 0];

// 간단 Redis 목: ioredis가 쓰는 메서드만 흉내 (set/get/del/multi/exec)
// TTL, NX는 테스트가 필요한 부분만 반영
class MockRedis {
  private store = new Map<string, string>();
  private queue: Array<() => ExecReply> = [];

  set(key: string, value: string, ...args: unknown[]): 'OK' {
    this.store.set(key, value);
    return 'OK';
  }

  get(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  del(key: string): 1 | 0 {
    return this.store.delete(key) ? 1 : 0;
  }

  multi() {
    const self = this;
    return {
      set(key: string, value: string, ...args: unknown[]) {
        self.queue.push(() => [null, self.set(key, value, ...args)]);
        return this;
      },
      del(key: string) {
        self.queue.push(() => [null, self.del(key)]);
        return this;
      },
      async exec(): Promise<ExecReply[]> {
        const out = self.queue.map((fn) => fn());
        self.queue = [];
        return out;
      },
    };
  }

  // 이벤트 리스너 시그니처
  on(_event: string, _cb: (...args: unknown[]) => void): void {}
}

const usersRepoMock: UsersRepository = {
  upsertBySteamId: async (
    steamId: string,
    patch?: { personaName?: string | null; avatar?: string | null },
  ) => ({
    id: 1,
    steamId,
    personaName: patch?.personaName ?? null,
    avatar: patch?.avatar ?? null,
  }),
} as UsersRepository;

const configMock: Pick<ConfigService, 'get' | 'getOrThrow'> = {
  getOrThrow: (k: string) => {
    switch (k) {
      case 'STEAM_REALM':
        return 'http://localhost:3000';
      case 'STEAM_RETURN_TO':
        return 'http://localhost:3000/api/v1/auth/steam/callback';
      case 'JWT_ACCESS_SECRET':
        return 'access-secret';
      case 'JWT_REFRESH_SECRET':
        return 'refresh-secret';
      default:
        throw new Error(`Missing config: ${k}`);
    }
  },
  get: (k: string, d?: unknown) => {
    switch (k) {
      case 'JWT_EXPIRES_IN':
        return '900';
      case 'JWT_REFRESH_EXPIRES_IN':
        return '259200';
      case 'STEAM_API_KEY':
        return 'dummy-key';
      default:
        return d;
    }
  },
};

describe('Auth flow: GET /auth/steam -> GET /auth/steam/callback -> POST /auth/steam/refresh', () => {
  let app: INestApplication;
  let redis: MockRedis;

  beforeAll(async () => {
    redis = new MockRedis();

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [SteamAuthController],
      providers: [
        SteamOpenIdService,
        { provide: 'REDIS', useValue: redis },
        { provide: UsersRepository, useValue: usersRepoMock },
        { provide: ConfigService, useValue: configMock as ConfigService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('1) GET /api/v1/auth/steam -> 302 (Steam OP로 리다이렉트, return_to에 state/nonce 포함)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/steam')
      .expect(302);

    const loc = res.headers.location as string;
    expect(loc).toContain('https://steamcommunity.com/openid/login');
    const op = new URL(loc);
    const rt = new URL(op.searchParams.get('openid.return_to')!);
    expect(rt.pathname).toBe('/api/v1/auth/steam/callback');
    expect(rt.searchParams.get('state')).toBeTruthy();
    expect(rt.searchParams.get('nonce')).toBeTruthy();
  });

  it('2) GET /api/v1/auth/steam/callback -> 200 (검증 ok, Set-Cookie refresh_tokenm JSON 바디)', async () => {
    await redis
      .multi()
      .set(`oid:state:s123`, '1')
      .set(`oid:nonce:n123`, '1')
      .exec();

    // OP 서명 검증: is_valid:true 모킹
    mockedAxios.post.mockResolvedValueOnce({
      data: 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n',
    });

    // 스팀 프로필 모킹
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        response: {
          players: [{ personaname: 'Alice', avatarfull: 'https://avatar' }],
        },
      },
    });

    const claimed = 'https://steamcommunity.com/openid/id/76561198000000000';

    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/steam/callback')
      .query({
        'openid.mode': 'id_res',
        'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
        'openid.return_to': `http://localhost:3000/api/v1/auth/steam/callback?state=s123&nonce=n123`,
        'openid.claimed_id': claimed,
        'openid.identity': claimed,
        'openid.response_nonce': '2025-09-29T13:00:00Zxyz',
        'openid.signed':
          'op_endpoint,claimed_id,identity,return_to,response_nonce',
        'openid.sig': 'dummy',
        'openid.ns': 'http://specs.openid.net/auth/2.0',
      })
      .expect(200);

    //바디 검증
    const jwtRe = /^[\w-]+\.[\w-]+\.[\w-]+$/;

    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBe(900);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken).toMatch(jwtRe);
    expect(res.body.user).toEqual({
      id: 1,
      steamId: '76561198000000000',
      personaName: 'Alice',
      avatar: 'https://avatar',
    });

    const setCookie = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie'].join(';')
      : '';
    expect(setCookie).toContain('refresh_token=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie).toContain('Path=/api/v1');
  });

  it('3) POST /api/v1/auth/steam/refresh -> 200 (회전 성공: 새 access, 새 refresh 쿠키)', async () => {
    //먼저 콜백 한 번 더 태워서 유효한 refresh_token 쿠키 확보

    await redis
      .multi()
      .set(`oid:state:s456`, '1')
      .set(`oid:nonce:n456`, '1')
      .exec();

    mockedAxios.post.mockResolvedValueOnce({ data: 'is_valid:true' });
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        response: {
          players: [{ personaname: 'Bob', avatarfull: 'https://avatar2' }],
        },
      },
    });

    const claimed = 'https://steamcommunity.com/openid/id/76561198000000001';
    const cb = await request(app.getHttpServer())
      .get('/api/v1/auth/steam/callback')
      .query({
        'openid.mode': 'id_res',
        'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
        'openid.return_to': `http://localhost:3000/api/v1/auth/steam/callback?state=s456&nonce=n456`,
        'openid.claimed_id': claimed,
        'openid.identity': claimed,
        'openid.response_nonce': '2025-09-29T13:10:00Zabc',
        'openid.signed':
          'op_endpoint,claimed_id,identity,return_to,response_nonce',
        'openid.sig': 'dummy',
        'openid.ns': 'http://specs.openid.net/auth/2.0',
      })
      .expect(200);

    // 콜백에서 내려온 refresh_token 쿠키 추출
    const setCookieCb = Array.isArray(cb.headers['set-cookie'])
      ? (cb.headers['set-cookie'][0] ?? '')
      : '';

    const refreshCookie = setCookieCb.split(';')[0];
    expect(refreshCookie.startsWith('refresh_token=')).toBe(true);

    //회전 호출
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/steam/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    const jwtRe = /^[\w-]+\.[\w-]+\.[\w-]+$/;
    expect(res.body.tokenType).toBe('Bearer');
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken).toMatch(jwtRe);

    const rotated = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie'].join('; ')
      : '';
    expect(rotated).toContain('refresh_token=');
    expect(rotated).toContain('Path=/api/v1');
  });
});

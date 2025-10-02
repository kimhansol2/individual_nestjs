/* eslint-disable */

// 이 주석을 파일 맨 위에 추가하면 Prettier가 무시됩니다.
// prettier-ignore
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core'; // HttpAdapterHost 임포트

import request, {
  SuperTest,
  Test as SupertestTestType,
  Response,
} from 'supertest';

import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Friend } from '../src/domain/friends/friends.entity';
import { User } from '../src/domain/users/user.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// Cache 인터페이스 확장: reset() 메서드 정의 추가
interface CacheWithReset extends Cache {
  reset(): Promise<void>;
  get<T>(key: string): Promise<T | undefined>;
}

// 응답 인터페이스
interface LoginResponse {
  accessToken: string;
}

interface CommonGame {
  appid: number;
  name: string;
  playtime_forever_user: number;
  playtime_forever_friend: number;
  img_icon_url?: string;
  headerImageUrl: string;
  rtime_last_played_user?: number;
  rtime_last_played_friend?: number;
}

interface CommonGamesResponse {
  data: CommonGame[];
  meta: {
    userSteamId: string;
    friendSteamId: string;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

describe('Friends - Common Games (e2e)', (): void => {
  let app: INestApplication;
  let friendRepository: Repository<Friend>;
  let userRepository: Repository<User>;
  let cacheManager: CacheWithReset;
  let jwtToken: string;
  let testUser: User;
  let testFriend: User;
  // Supertest 타입을 명확하게 지정
  let apiAgent: SuperTest<SupertestTestType>;

  // 상수 정의 (매직 넘버 방지 및 ESLint 일관성 유지)
  const VALID_SORT_OPTIONS = ['playtime', 'name', 'recent'] as const;
  const ENDPOINT = (friendId: number | string): string =>
    `/api/v1/friends/${friendId}/common-games`;
  const LOGIN_ENDPOINT = '/auth/login';

  beforeAll(async (): Promise<void> => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    // 💡 ESLint 경고 해결: HttpAdapterHost를 사용하여 as any 제거
    // 💡 HTTP Agent 초기화
    const httpAdapterHost = moduleFixture.get<HttpAdapterHost>(HttpAdapterHost);
    const httpServer = httpAdapterHost.httpAdapter.getHttpServer();
    apiAgent = request(httpServer) as unknown as SuperTest<SupertestTestType>;

    // 💡 Repository 초기화: get() 호출 내에 getRepositoryToken이 위치해야 합니다.
    //    또한, as 단언을 사용하여 any 오염을 제거합니다.
    friendRepository = moduleFixture.get(
      getRepositoryToken(Friend),
    ) as Repository<Friend>;
    userRepository = moduleFixture.get(
      getRepositoryToken(User),
    ) as Repository<User>;

    // Cache Manager 오류 회피 주석
     
    cacheManager = moduleFixture.get<CacheWithReset>(CACHE_MANAGER);
    beforeEach(async (): Promise<void> => {
      // 모든 beforeEach 블록의 시작은 데이터 클린업
      await friendRepository.delete({});
      await userRepository.delete({});
      await cacheManager.reset();

      // 테스트 유저 생성
      testUser = await userRepository.save({
        steamId: '76561198000000001',
        personaName: 'TestUser1',
        avatar: 'https://example.com/avatar1.jpg',
      });

      testFriend = await userRepository.save({
        steamId: '76561198000000002',
        personaName: 'TestUser2',
        avatar: 'https://example.com/avatar2.jpg',
      });

      // 친구 관계 설정
      await friendRepository.save([
        { userId: testUser.id, friendId: testFriend.id, status: 'accepted' },
        { userId: testFriend.id, friendId: testUser.id, status: 'accepted' },
      ]);

      // 로그인 및 JWT 토큰 획득
      const loginResponse: Response = await apiAgent
        .post(LOGIN_ENDPOINT)
        .send({ steamId: testUser.steamId })
        .expect(201);

      const loginBody: LoginResponse = loginResponse.body as LoginResponse;
      jwtToken = loginBody.accessToken;
    });

    afterAll(async (): Promise<void> => {
      await app.close();
    });

    // ------------------------------------------------------------------

    describe('GET /api/v1/friends/:friendId/common-games', (): void => {
      it('should return common games with valid friend relationship (200 OK)', async (): Promise<void> => {
        const response: Response = await apiAgent
          .get(ENDPOINT(testFriend.id))
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(200);

        const responseBody: CommonGamesResponse =
          response.body as CommonGamesResponse;
        const { data, meta } = responseBody;

        expect(Array.isArray(data)).toBe(true);
        expect(meta.userSteamId).toBeDefined();
        expect(meta.friendSteamId).toBeDefined();
        expect(responseBody).toHaveProperty('meta');
        expect(responseBody).toHaveProperty('data');
      });

      it('should return 401 without JWT token', async (): Promise<void> => {
        await apiAgent.get(ENDPOINT(testFriend.id)).expect(401);
      });

      it('should return 403 when not friends (no relationship)', async (): Promise<void> => {
        // 관계 제거 (친구 아님)
        await friendRepository.delete({
          userId: testUser.id,
          friendId: testFriend.id,
        });

        await apiAgent
          .get(ENDPOINT(testFriend.id))
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(403);
      });

      it('should return 400 when trying to compare with self', async (): Promise<void> => {
        await apiAgent
          .get(ENDPOINT(testUser.id)) // 본인의 ID 사용
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(400);
      });

      it('should handle pagination correctly', async (): Promise<void> => {
        const page = 1;
        const limit = 10;
        const response: Response = await apiAgent
          .get(ENDPOINT(testFriend.id))
          .query({ page, limit })
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(200);

        const responseBody: CommonGamesResponse =
          response.body as CommonGamesResponse;
        const { meta } = responseBody;

        expect(meta.page).toBe(page);
        expect(meta.limit).toBe(limit);
      });

      it('should handle all valid sortBy parameters without error', async (): Promise<void> => {
        for (const sortBy of VALID_SORT_OPTIONS) {
          // 모든 유효한 옵션을 반복하며 테스트
          const response: Response = await apiAgent
            .get(ENDPOINT(testFriend.id))
            .query({ sortBy })
            .set('Authorization', `Bearer ${jwtToken}`)
            .expect(200);

          const responseBody: CommonGamesResponse =
            response.body as CommonGamesResponse;
          expect(responseBody.data).toBeDefined();
        }
      });

      it('should reject invalid sortBy parameter (400 Bad Request)', async (): Promise<void> => {
        await apiAgent
          .get(ENDPOINT(testFriend.id))
          .query({ sortBy: 'invalid_sort_option' })
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(400);
      });

      it('should handle search parameter', async (): Promise<void> => {
        const response: Response = await apiAgent
          .get(ENDPOINT(testFriend.id))
          .query({ search: 'Counter' })
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(200);

        const responseBody: CommonGamesResponse =
          response.body as CommonGamesResponse;
        expect(responseBody.data).toBeDefined();
      });

      it('should return cached data on second request (cache hit check)', async (): Promise<void> => {
        // 1. 첫 번째 요청 (캐시 저장)
        const firstResponse: Response = await apiAgent
          .get(ENDPOINT(testFriend.id))
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(200);

        const firstResponseBody: CommonGamesResponse =
          firstResponse.body as CommonGamesResponse;

        // 2. 캐시 키 확인 (실제 로직과 일치해야 함)
        const [id1, id2] = [testUser.id, testFriend.id].sort(
          (a: number, b: number): number => a - b,
        );
        // 💡 쿼리 파라미터에 따라 캐시 키가 달라지므로, 기본 값으로 키 생성
        const cacheKey = `common:games:${id1}:${id2}:1:20::`;

        // 3. 캐시 매니저를 통해 데이터 확인
        const cachedData: CommonGamesResponse | undefined =
          await cacheManager.get<CommonGamesResponse>(cacheKey);
        expect(cachedData).toBeDefined();
        // 캐시된 데이터의 메타 정보가 정확한지 확인 (선택 사항)
        expect(cachedData?.meta.page).toBe(1);

        // 4. 두 번째 요청 (캐시 사용)
        const secondResponse: Response = await apiAgent
          .get(ENDPOINT(testFriend.id))
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(200);

        const secondResponseBody: CommonGamesResponse =
          secondResponse.body as CommonGamesResponse;
        expect(firstResponseBody).toEqual(secondResponseBody);
      });

      it('should validate friendId as integer (400 Bad Request)', async (): Promise<void> => {
        await apiAgent
          .get(ENDPOINT('abc')) // 'abc'는 유효하지 않은 ID
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(400);
      });

      it('should return 404 when friend user not found', async (): Promise<void> => {
        await apiAgent
          .get(ENDPOINT(999999))
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(404);
      });

      it('should handle pending and blocked friend status (403 Forbidden)', async (): Promise<void> => {
        // Pending 상태 테스트
        await friendRepository.update(
          { userId: testUser.id, friendId: testFriend.id },
          { status: 'pending' },
        );
        await apiAgent
          .get(ENDPOINT(testFriend.id))
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(403);

        // Blocked 상태 테스트
        await friendRepository.update(
          { userId: testUser.id, friendId: testFriend.id },
          { status: 'blocked' },
        );
        await apiAgent
          .get(ENDPOINT(testFriend.id))
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(403);
      }); // <--- Blocked 상태 테스트 it() 닫기
    }); // <--- GET /api/v1/friends/:friendId/common-games describe() 닫기
  }); // <--- Friends - Common Games (e2e) describe()의 함수 본체 {} 닫기
}); // <--- Friends - Common Games (e2e) describe()의 함수 호출 () 닫기

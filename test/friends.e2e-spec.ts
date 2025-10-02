// 파일명: friends.e2e-spec.ts (예시)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';

// supertest 임포트 방식 변경: 함수는 request로, 타입은 SuperTest와 Test로 별도 임포트
import request, {
  SuperTest,
  Test as SupertestTestType,
  Response,
} from 'supertest';

import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Friend } from '../src/domain/friends/friends.entity'; // 실제 경로 확인
import { User } from '../src/domain/users/user.entity'; // 실제 경로 확인
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// Cache 인터페이스 확장: reset() 메서드 정의 추가
interface CacheWithReset extends Cache {
  reset(): Promise<void>;
  get<T>(key: string): Promise<T | undefined>; // get 메서드도 명시적으로 타입 정의 (선택 사항이지만 안전성 증가)
}

interface LoginResponse {
  accessToken: string;
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

describe('Friends - Common Games (e2e)', () => {
  let app: INestApplication;
  let friendRepository: Repository<Friend>;
  let userRepository: Repository<User>;
  let cacheManager: CacheWithReset; // <--- 확장된 CacheWithReset 타입 적용
  let jwtToken: string;
  let testUser: User;
  let testFriend: User;
  let apiAgent: SuperTest<SupertestTestType>; // <--- supertest의 SuperTest와 Test 타입을 사용하여 apiAgent 정의

  beforeAll(async () => {
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

    // supertest 에이전트 생성: getHttpServer()의 타입을 명확하게 전달하기 위해 `as any` 사용 (supertest 라이브러리 타입 문제 회피)
    apiAgent = request(app.getHttpServer());

    friendRepository = moduleFixture.get<Repository<Friend>>(
      getRepositoryToken(Friend),
    );
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );

    // cacheManager 초기화: 이중 타입 단언 (as unknown as) 사용하여 정확한 타입 부여
    cacheManager = moduleFixture.get(CACHE_MANAGER);
  });

  beforeEach(async () => {
    await friendRepository.delete({});
    await userRepository.delete({});
    // cacheManager.reset() 오류 해결: CacheWithReset 인터페이스에 reset()이 정의되었으므로 직접 호출
    await cacheManager.reset();

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

    await friendRepository.save([
      { userId: testUser.id, friendId: testFriend.id, status: 'accepted' },
      { userId: testFriend.id, friendId: testUser.id, status: 'accepted' },
    ]);

    // 로그인 요청
    const loginResponse: Response = await apiAgent
      .post('/auth/login')
      .send({ steamId: testUser.steamId })
      .expect(201);

    const loginBody = loginResponse.body as LoginResponse;
    jwtToken = loginBody.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/friends/:friendId/common-games', () => {
    it('should return common games with valid friend relationship', async () => {
      const response: Response = await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const responseBody = response.body as CommonGamesResponse;
      const { data, meta } = responseBody;
      expect(Array.isArray(data)).toBe(true);
      expect(meta.userSteamId).toBeDefined();
      expect(meta.friendSteamId).toBeDefined();
    });

    it('should return 401 without JWT token', async () => {
      await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .expect(401);
    });

    it('should return 403 when not friends', async () => {
      await friendRepository.delete({
        userId: testUser.id,
        friendId: testFriend.id,
      });

      await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);
    });

    it('should return 400 when trying to compare with self', async () => {
      await apiAgent
        .get(`/api/v1/friends/${testUser.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should handle pagination correctly', async () => {
      const response: Response = await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const responseBody = response.body as CommonGamesResponse;
      const { meta } = responseBody;
      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(10);
    });

    it('should handle sortBy parameter', async () => {
      const validSortOptions = ['playtime', 'name', 'recent'] as const;

      for (const sortBy of validSortOptions) {
        const response: Response = await apiAgent
          .get(`/api/v1/friends/${testFriend.id}/common-games`)
          .query({ sortBy })
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(200);

        const responseBody = response.body as CommonGamesResponse;
        expect(responseBody.data).toBeDefined();
      }
    });

    it('should reject invalid sortBy parameter', async () => {
      await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .query({ sortBy: 'invalid' })
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should handle search parameter', async () => {
      const response: Response = await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .query({ search: 'Counter' })
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const responseBody = response.body as CommonGamesResponse;
      expect(responseBody.data).toBeDefined();
    });

    it('should return cached data on second request', async () => {
      const firstResponse: Response = await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const firstResponseBody = firstResponse.body as CommonGamesResponse;

      // 캐시 키 생성 로직: 실제 generateCacheKey 함수의 로직과 일치하도록 검토 필요
      const [id1, id2] = [testUser.id, testFriend.id].sort((a, b) => a - b);
      const cacheKey = `common:games:${id1}:${id2}:0:20::`;

      // cacheManager.get 오류 해결: CacheWithReset 인터페이스에 get()이 정의되었으므로 직접 호출
      const cachedData: CommonGamesResponse | undefined =
        await cacheManager.get(cacheKey);
      expect(cachedData).toBeDefined();

      const secondResponse: Response = await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const secondResponseBody = secondResponse.body as CommonGamesResponse;
      expect(firstResponseBody).toEqual(secondResponseBody);
    });

    it('should validate friendId as integer', async () => {
      await apiAgent
        .get('/api/v1/friends/abc/common-games')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should return 404 when friend user not found', async () => {
      await apiAgent
        .get('/api/v1/friends/999999/common-games')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });

    it('should handle pending and blocked friend status', async () => {
      await friendRepository.update(
        { userId: testUser.id, friendId: testFriend.id },
        { status: 'pending' },
      );
      await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);

      await friendRepository.update(
        { userId: testUser.id, friendId: testFriend.id },
        { status: 'blocked' },
      );
      await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);
    });

    it('should return correct game data structure', async () => {
      const response: Response = await apiAgent
        .get(`/api/v1/friends/${testFriend.id}/common-games`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const responseBody = response.body as CommonGamesResponse;
      const { data } = responseBody;
      if (data.length > 0) {
        const game = data[0];
        expect(typeof game.appid).toBe('number');
        expect(typeof game.name).toBe('string');
        expect(typeof game.playtime_forever_user).toBe('number');
        expect(typeof game.playtime_forever_friend).toBe('number');
        expect(typeof game.headerImageUrl).toBe('string');
      }
    });
  }); // <-- describe('GET ...') 닫는 괄호
}); // <-- describe('Friends - Common Games ...') 닫는 괄호

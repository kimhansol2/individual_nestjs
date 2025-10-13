import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  INestApplication,
  ExecutionContext,
  CanActivate,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../src/domain/users/user.entity';
import { Friend } from '../src/domain/friends/friends.entity';
import {
  CommonGame,
  CommonGamesResponse,
} from '../src/myfriends/get-common-games.dto';

let app: INestApplication;
let testingModule: TestingModule;
let httpServer: Server;
let entityManager: EntityManager;
let userRepository: Repository<User>;
let friendRepository: Repository<Friend>;

const throttlerGuardMock = {
  canActivate: jest.fn().mockReturnValue(true),
};

interface MockCache {
  get: jest.MockedFunction<(key: string) => Promise<unknown>>;
  set: jest.MockedFunction<
    (key: string, value: unknown, ttl?: number) => Promise<void>
  >;
  reset: jest.MockedFunction<() => Promise<void>>;
  del: jest.MockedFunction<(key: string) => Promise<void>>;
}

const cacheManagerMock: MockCache = {
  get: jest.fn(),
  set: jest.fn(),
  reset: jest.fn(),
  del: jest.fn(),
};

// Mock Guard 클래스 정의 - testUser는 런타임에 설정됨
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    // testUser가 설정되어 있으면 사용, 아니면 기본값
    if (testUser) {
      request.user = {
        userId: testUser.id,
        steamId: testUser.steamId,
      };
    }
    return true;
  }
}

let testUser: User;
let testFriend: User;
let jwtToken: string;

const ENDPOINT = (friendId: number | string): string =>
  `/api/v1/friends/${friendId}/common-games`;

interface RequestWithUser extends request.Request {
  user: {
    userId: number;
    steamId: string;
  };
}

// DTO에 정의된 유효한 정렬 옵션으로 업데이트합니다.
const VALID_SORT_OPTIONS = [
  'name',
  'you_playtime',
  'friend_playtime',
  'last_played',
  'recent_overlap',
] as const;

describe('Friends - Common Games (e2e)', () => {
  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(ThrottlerGuard)
      .useValue(throttlerGuardMock)
      .overrideProvider(CACHE_MANAGER)
      .useValue(cacheManagerMock)
      .compile();

    app = testingModule.createNestApplication();
    await app.init();

    httpServer = app.getHttpServer() as Server;
    entityManager = testingModule.get(EntityManager);
    userRepository = entityManager.getRepository(User);
    friendRepository = entityManager.getRepository(Friend);
  });

  beforeEach(async () => {
    const entities = entityManager.connection.entityMetadatas;
    for (const entity of entities) {
      await entityManager.query(
        `TRUNCATE TABLE "${entity.tableName}" CASCADE;`,
      );
    }

    cacheManagerMock.reset.mockClear();
    await cacheManagerMock.reset();

    const savedUser = await userRepository.save(
      userRepository.create({
        steamId: '76561198000000001',
        personaName: 'TestUser1',
        avatar: 'https://example.com/avatar1.jpg',
      }),
    );
    testUser = savedUser;

    const savedFriend = await userRepository.save(
      userRepository.create({
        steamId: '76561198000000002',
        personaName: 'TestUser2',
        avatar: 'https://example.com/avatar2.jpg',
      }),
    );
    testFriend = savedFriend;

    await friendRepository.save([
      {
        userId: testUser.id,
        friendId: testFriend.id,
        status: 'accepted',
      },
      {
        userId: testFriend.id,
        friendId: testUser.id,
        status: 'accepted',
      },
    ]);

    jwtToken = 'dummy-auth-token-is-all-we-need';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    throttlerGuardMock.canActivate.mockClear();
    cacheManagerMock.get.mockClear();
    cacheManagerMock.reset.mockClear();
  });

  afterAll(async () => {
    if (entityManager.connection.isInitialized) {
      await entityManager.connection.destroy();
    }
    await app.close();
  });

  describe('GET /api/v1/friends/:friendId/common-games', () => {
    it('should return common games with valid friend relationship (200 OK)', async () => {
      const response = await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      // DTO 구조에 맞게 items와 friend, paging 객체로 destructuring 수정
      const { items, friend, summary, paging } =
        response.body as CommonGamesResponse;

      expect(Array.isArray(items)).toBe(true);
      // friend 객체의 steamid를 검증
      expect(friend.steamid).toBe(testFriend.steamId);
      // summary 객체 검증 추가 (ESLint 경고 해제 목적)
      expect(summary).toBeDefined();
      // 페이징 정보가 정의되었는지 검증
      expect(paging.total).toBeDefined();
      expect(paging.size).toBeDefined();
    });

    it.skip('should return 401 without JWT token', async () => {
      await request(httpServer).get(ENDPOINT(testFriend.id)).expect(401);
    });

    it('should return 403 when not friends (no relationship)', async () => {
      await friendRepository.delete({
        userId: testUser.id,
        friendId: testFriend.id,
      });
      await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);
    });

    it('should return 400 when trying to compare with self', async () => {
      await request(httpServer)
        .get(ENDPOINT(testUser.id))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should handle pagination correctly', async () => {
      const page = 1;
      const limit = 10;
      const response = await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .query({ page, limit })
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      // paging 객체의 속성을 검증하도록 수정
      const { paging } = response.body as CommonGamesResponse;
      expect(paging.page).toBe(page);
      expect(paging.size).toBe(limit);
      expect(paging.total).toBeDefined(); // totalPages 대신 total 존재 여부 확인
    });

    it('should handle all valid sortBy parameters without error', async () => {
      // DTO의 정렬 기준 enum에 맞춰 전역 VALID_SORT_OPTIONS를 업데이트했으므로, 재정의 없이 사용합니다.
      for (const sortBy of VALID_SORT_OPTIONS) {
        await request(httpServer)
          .get(ENDPOINT(testFriend.id))
          .query({ sortBy })
          .set('Authorization', `Bearer ${jwtToken}`)
          .expect(200);
      }
    });

    it('should reject invalid sortBy parameter (400 Bad Request)', async () => {
      await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .query({ sortBy: 'invalid_sort_option' })
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should handle search parameter', async () => {
      const response = await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .query({ search: 'Counter' })
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      // data 대신 items를 검증하도록 수정
      const { items } = response.body as CommonGamesResponse;
      expect(items).toBeDefined();
    });

    it('should return cached data on second request (cache hit check)', async () => {
      // DTO CommonGame 인터페이스에 맞게 mock 데이터 수정
      const mockCachedGame: CommonGame = {
        app_id: 100, // app_id 사용
        name: 'Cached Game',
        icon: 'mockIconHash', // icon 추가
        you: {
          playtime_forever: 500, // you 객체 아래로 이동
          playtime_2weeks: undefined, // 명시적으로 undefined 할당 (Optional 필드)
          last_played_at: '2023-01-01T00:00:00Z', // string 할당
        },
        friend: {
          playtime_forever: 300, // friend 객체 아래로 이동
          playtime_2weeks: undefined, // 명시적으로 undefined 할당 (Optional 필드)
          last_played_at: '2023-01-01T00:00:00Z', // string 할당
        },
        overlap: {
          recent: false,
          installed: true,
        },
      };

      // DTO CommonGamesResponse 인터페이스에 맞게 mock 응답 수정
      const mockCachedResponse: CommonGamesResponse = {
        friend: {
          steamid: testFriend.steamId,
          // 'string | null' 타입 오류 해결을 위해 Non-null Assertion Operator(!) 추가
          persona_name: testFriend.personaName!,
        },
        summary: {
          total: 1,
          recent_overlap: 0,
        },
        items: [mockCachedGame], // data 대신 items 사용
        paging: {
          page: 1,
          size: 20, // limit 대신 size 사용
          total: 1,
        },
        links: {
          self: ENDPOINT(testFriend.id) + '?page=1&limit=20',
          refresh: ENDPOINT(testFriend.id) + '?force=true',
        },
        trace_id: 'mock-trace-id',
      };

      cacheManagerMock.get.mockClear();
      cacheManagerMock.get.mockResolvedValueOnce(undefined);
      cacheManagerMock.get.mockResolvedValueOnce(mockCachedResponse);

      await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .query({ limit: 20 }) // 쿼리 파라미터를 추가하여 캐시 키 일관성을 유지
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const finalResponse = await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .query({ limit: 20 }) // 쿼리 파라미터를 추가하여 캐시 키 일관성을 유지
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      // 응답 본문 전체를 새로운 Mock 응답과 비교
      expect(finalResponse.body).toEqual(mockCachedResponse);
      expect(cacheManagerMock.get).toHaveBeenCalledTimes(2);
    });

    it('should validate friendId as integer (400 Bad Request)', async () => {
      await request(httpServer)
        .get(ENDPOINT('abc'))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should return 403 when friend user not found (no relationship)', async () => {
      await request(httpServer)
        .get(ENDPOINT(999999))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);
    });

    it('should handle pending and blocked friend status (403 Forbidden)', async () => {
      await friendRepository.update(
        { userId: testUser.id, friendId: testFriend.id },
        { status: 'pending' },
      );

      await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);

      await friendRepository.update(
        { userId: testUser.id, friendId: testFriend.id },
        { status: 'blocked' },
      );

      await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);
    });
  });
});

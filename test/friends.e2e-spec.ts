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

const VALID_SORT_OPTIONS = ['playtime', 'name', 'recent'] as const;

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

      const { data, meta } = response.body as CommonGamesResponse;

      expect(Array.isArray(data)).toBe(true);
      expect(meta.userSteamId).toBe(testUser.steamId);
      expect(meta.friendSteamId).toBe(testFriend.steamId);
      expect(meta.totalPages).toBeDefined();
      expect(meta.hasNext).toBeDefined();
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

      const { meta } = response.body as CommonGamesResponse;
      expect(meta.page).toBe(page);
      expect(meta.limit).toBe(limit);
      expect(meta.totalPages).toBeDefined();
    });

    it('should handle all valid sortBy parameters without error', async () => {
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

      const { data } = response.body as CommonGamesResponse;
      expect(data).toBeDefined();
    });

    it('should return cached data on second request (cache hit check)', async () => {
      const mockCachedGame: CommonGame = {
        appid: 100,
        name: 'Cached Game',
        playtime_forever_user: 500,
        playtime_forever_friend: 300,
        headerImageUrl: 'https://example.com/header_cached.jpg',
      };

      const mockCachedResponse: CommonGamesResponse = {
        data: [mockCachedGame],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
          userSteamId: testUser.steamId,
          friendSteamId: testFriend.steamId,
        },
      };

      cacheManagerMock.get.mockClear();
      cacheManagerMock.get.mockResolvedValueOnce(undefined);
      cacheManagerMock.get.mockResolvedValueOnce(mockCachedResponse);

      await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const finalResponse = await request(httpServer)
        .get(ENDPOINT(testFriend.id))
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

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

import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Friend } from '../domain/friends/friends.entity';
import { OwnedGame } from '../domain/games/owned-game.entity'; // OwnedGame 엔티티 임포트 추가
import { GetFriendsDto } from './get-friends.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository, SelectQueryBuilder } from 'typeorm';

// 실제 서비스에서 사용하는 RedisCache 인터페이스와 유사하게 정의
interface MockRedisCache {
  keys: jest.Mock;
  del: jest.Mock;
}

describe('FriendsService', () => {
  let service: FriendsService;
  let friendRepository: jest.Mocked<Partial<Repository<Friend>>>;
  let ownedGameRepository: jest.Mocked<Partial<Repository<OwnedGame>>>; // OwnedGameRepository 선언 추가
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    stores: MockRedisCache;
  };

  beforeEach(async () => {
    // 쿼리 빌더를 위한 모의 객체 생성 (FriendRepository용)
    const mockFriendQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    } as unknown as SelectQueryBuilder<Friend>;

    // Friend Repository 모킹
    friendRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockFriendQueryBuilder),
    } as jest.Mocked<Partial<Repository<Friend>>>;

    // OwnedGame Repository 모킹 추가
    ownedGameRepository = {
      // FriendsService가 OwnedGameRepository에서 필요로 하는 메서드들을 여기에 모킹합니다.
      // 예: find, findOne, save, create 등
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      // 여기에 FriendsService에서 사용될 OwnedGameRepository의 다른 메서드를 추가하세요
      // 예: save: jest.fn(),
      // 예: create: jest.fn((entity) => entity),
    } as jest.Mocked<Partial<Repository<OwnedGame>>>;

    // 캐시 매니저 모킹
    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      stores: {
        keys: jest.fn().mockResolvedValue([]),
        del: jest.fn().mockResolvedValue(undefined),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: getRepositoryToken(Friend),
          useValue: friendRepository,
        },
        {
          provide: getRepositoryToken(OwnedGame), // OwnedGameRepository 모킹 추가
          useValue: ownedGameRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty friend list', async () => {
    // GetFriendsDto 객체 생성
    const dto = new GetFriendsDto();
    dto.page = 1;
    dto.limit = 10;

    // friendRepository의 createQueryBuilder mock 설정 (예시)
    (friendRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    } as unknown as SelectQueryBuilder<Friend>);

    const result = await service.getFriends(1, dto);

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });
});

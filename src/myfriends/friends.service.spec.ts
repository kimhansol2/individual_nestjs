import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Friend } from '../domain/friends/friends.entity';
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
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    stores: MockRedisCache;
  };

  beforeEach(async () => {
    // 쿼리 빌더를 위한 모의 객체 생성
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    } as unknown as SelectQueryBuilder<Friend>;

    // 리포지토리 모킹
    friendRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as jest.Mocked<Partial<Repository<Friend>>>;

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

    // 빈 결과 반환하도록 모킹
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

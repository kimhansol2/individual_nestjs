import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Friend } from '../domain/friends/friends.entity';
import { GetFriendsDto } from './get-friends.dto';

export interface FriendWithExtra extends Friend {
  mutualFriendsCount?: number;
  sharedItemsCount?: number;
  recentActivity?: unknown;
  friendUser?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
    lastOnlineAt?: Date;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface RedisCache {
  keys: (pattern: string) => Promise<string[]>;
  del: (key: string) => Promise<void>;
}

@Injectable()
export class FriendsService {
  private readonly CACHE_TTL = 300000; // 5분

  constructor(
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getFriends(
    userId: number,
    dto: GetFriendsDto,
  ): Promise<PaginatedResponse<FriendWithExtra>> {
    try {
      const cacheKey = this.generateCacheKey(userId, dto);

      // 캐시 확인
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as PaginatedResponse<FriendWithExtra>;
      }

      // 쿼리 빌더 생성
      const qb = this.createFriendsQuery(userId, dto);

      // 전체 개수 조회
      const total = await qb.getCount();

      // 페이지네이션 적용
      const skip = (dto.page - 1) * dto.limit;
      qb.skip(skip).take(dto.limit);

      // 데이터 조회
      const friends = await qb.getMany();

      // 응답 구성
      const response: PaginatedResponse<FriendWithExtra> = {
        data: friends,
        meta: {
          page: dto.page,
          limit: dto.limit,
          total,
          totalPages: Math.ceil(total / dto.limit),
          hasNext: skip + dto.limit < total,
          hasPrev: dto.page > 1,
        },
      };

      // 캐시 저장
      await this.cacheManager.set(cacheKey, response, this.CACHE_TTL);

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        '친구 목록 조회 중 오류가 발생했습니다.',
      );
    }
  }

  private createFriendsQuery(
    userId: number,
    dto: GetFriendsDto,
  ): SelectQueryBuilder<Friend> {
    const qb = this.friendRepository
      .createQueryBuilder('friend')
      .where('friend.userId = :userId', { userId })
      .andWhere('friend.status = :status', { status: 'accepted' });

    // 검색어 필터링 (friendUser 조인 필요 - 실제 User 엔티티와 관계 설정 필요)
    if (dto.search) {
      // User 엔티티가 있다면 조인 추가
      // qb.leftJoin('friend.user', 'user')
      //   .andWhere('user.username LIKE :search', { search: `%${dto.search}%` });

      // 현재는 friendId로만 검색
      qb.andWhere('friend.friendId LIKE :search', {
        search: `%${dto.search}%`,
      });
    }

    // 정렬 적용
    this.applySorting(qb, dto.sortBy);

    return qb;
  }

  private applySorting(
    qb: SelectQueryBuilder<Friend>,
    sortBy?: 'name' | 'createdAt',
  ): void {
    switch (sortBy) {
      case 'name':
        // User 엔티티 조인이 있다면
        // qb.orderBy('user.username', 'ASC');
        qb.orderBy('friend.friendId', 'ASC');
        break;

      case 'createdAt':
      default:
        qb.orderBy('friend.createdAt', 'DESC');
        break;
    }
  }

  private generateCacheKey(userId: number, dto: GetFriendsDto): string {
    const params = [
      userId,
      dto.page,
      dto.limit,
      dto.search || '',
      dto.sortBy || 'createdAt',
    ].join(':');

    return `friends:list:${params}`;
  }

  async invalidateFriendsCacheForUser(userId: number): Promise<void> {
    try {
      const redisStore = this.cacheManager.stores as unknown as RedisCache;

      if (redisStore && typeof redisStore.keys === 'function') {
        const pattern = `friends:list:${userId}:*`;
        const keys: string[] = await redisStore.keys(pattern);

        if (keys && keys.length > 0) {
          await Promise.all(keys.map((key) => this.cacheManager.del(key)));
        }
      } else {
        console.warn(
          `Pattern-based cache invalidation not supported for user ${userId}`,
        );
      }
    } catch (error) {
      console.error('캐시 무효화 중 오류 발생:', error);
    }
  }

  async addFriend(userId: number, friendId: number): Promise<Friend> {
    // 이미 친구인지 확인
    const existing = await this.friendRepository.findOne({
      where: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    if (existing) {
      throw new BadRequestException('이미 친구 관계입니다.');
    }

    // 자기 자신을 친구로 추가하는지 확인
    if (userId === friendId) {
      throw new BadRequestException('자기 자신을 친구로 추가할 수 없습니다.');
    }

    const friend = this.friendRepository.create({
      userId,
      friendId,
      status: 'pending',
    });

    const saved = await this.friendRepository.save(friend);

    // 캐시 무효화
    await this.invalidateFriendsCacheForUser(userId);

    return saved;
  }

  async acceptFriend(userId: number, friendId: number): Promise<Friend> {
    const friend = await this.friendRepository.findOne({
      where: { userId: friendId, friendId: userId, status: 'pending' },
    });

    if (!friend) {
      throw new BadRequestException('친구 요청을 찾을 수 없습니다.');
    }

    friend.status = 'accepted';
    const updated = await this.friendRepository.save(friend);

    // 양방향 친구 관계 생성
    const reverseFriend = this.friendRepository.create({
      userId,
      friendId,
      status: 'accepted',
    });
    await this.friendRepository.save(reverseFriend);

    // 양쪽 캐시 무효화
    await Promise.all([
      this.invalidateFriendsCacheForUser(userId),
      this.invalidateFriendsCacheForUser(friendId),
    ]);

    return updated;
  }

  async removeFriend(userId: number, friendId: number): Promise<void> {
    // 양방향 관계 모두 삭제
    await this.friendRepository.delete([
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ]);

    // 양쪽 캐시 무효화
    await Promise.all([
      this.invalidateFriendsCacheForUser(userId),
      this.invalidateFriendsCacheForUser(friendId),
    ]);
  }

  async blockFriend(userId: number, friendId: number): Promise<Friend> {
    let friend = await this.friendRepository.findOne({
      where: { userId, friendId },
    });

    if (!friend) {
      friend = this.friendRepository.create({
        userId,
        friendId,
        status: 'blocked',
      });
    } else {
      friend.status = 'blocked';
    }

    const saved = await this.friendRepository.save(friend);

    // 캐시 무효화
    await this.invalidateFriendsCacheForUser(userId);

    return saved;
  }

  async getFriendStatus(
    userId: number,
    friendId: number,
  ): Promise<'none' | 'pending' | 'accepted' | 'blocked'> {
    const friend = await this.friendRepository.findOne({
      where: { userId, friendId },
    });

    return friend ? friend.status : 'none';
  }
}

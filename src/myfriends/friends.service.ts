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
import { GetCommonGamesDto } from './get-common-games.dto'; // 이 DTO도 임포트
import { PaginatedResponse } from 'src/common/types/pagination.types';
import { Game } from 'src/domain/games/game.entity';
import { OwnedGame } from '../domain/games/owned-game.entity';

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
    @InjectRepository(OwnedGame)
    private readonly userGameRepository: Repository<OwnedGame>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getFriends(
    userId: number,
    dto: GetFriendsDto,
  ): Promise<PaginatedResponse<FriendWithExtra>> {
    try {
      const cacheKey = this.generateCacheKey('friends:list', userId, dto);

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

  private generateCacheKey(
    keyType: string,
    userId: number,
    dto: GetFriendsDto | GetCommonGamesDto,
  ): string {
    const params: (string | number)[] = [userId];

    // 공통 속성 추가
    if (dto.page !== undefined && dto.page !== null) {
      params.push(dto.page);
    }
    if (dto.limit !== undefined && dto.limit !== null) {
      params.push(dto.limit);
    }

    // GetFriendsDto 속성 처리
    if ('search' in dto && typeof dto.search !== 'undefined') {
      params.push(dto.search || '');
    }
    if ('sortBy' in dto && typeof dto.sortBy !== 'undefined') {
      params.push(dto.sortBy || 'createdAt');
    }

    // friendId 처리 (getCommonGames에서 사용)
    function isCommonGamesDto(
      dto: GetFriendsDto | GetCommonGamesDto,
    ): dto is GetCommonGamesDto {
      return 'friendId' in dto;
    }

    if (isCommonGamesDto(dto) && dto.friendId != null) {
      params.push(dto.friendId);
    }

    return `${keyType}:${params.join(':')}`;
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
  async getCommonGames(
    userId: number,
    friendId: number,
    query: GetCommonGamesDto,
  ): Promise<PaginatedResponse<Game>> {
    try {
      const cacheKey = this.generateCacheKey(
        'common:games',
        userId,
        Object.assign({}, query, { friendId }), // Object.assign 메서드 사용
      ); // 명시적으로 속성 이름과 값을 모두 작성

      // 1. 캐시 확인: Promise를 반환하므로 await 사용
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as PaginatedResponse<Game>;
      }

      // 1. userId가 가진 게임 목록 조회 쿼리 빌더
      const userGamesQuery = this.userGameRepository
        .createQueryBuilder('userGame')
        .select('userGame.gameId')
        .where('userGame.userId = :userId', { userId });

      // 2. friendId가 가진 게임 목록 조회 쿼리 빌더
      const friendGamesQuery = this.userGameRepository
        .createQueryBuilder('userGame')
        .select('userGame.gameId')
        .where('userGame.userId = :friendId', { friendId });

      // 3. 두 쿼리의 교집합을 찾아 공통 게임 ID 목록을 얻는 서브쿼리 빌더
      const commonGameIdsQb = this.userGameRepository
        .createQueryBuilder('ug')
        .select('ug.gameId')
        .innerJoin(
          `(${userGamesQuery.getQuery()})`,
          'user_games',
          'ug.gameId = user_games.gameId',
        )
        .innerJoin(
          `(${friendGamesQuery.getQuery()})`,
          'friend_games',
          'ug.gameId = friend_games.gameId',
        )
        .where(
          `ug.gameId IN (${userGamesQuery.getQuery()})`,
          userGamesQuery.getParameters() as Record<string, unknown>,
        )
        .andWhere(
          `ug.gameId IN (${friendGamesQuery.getQuery()})`,
          friendGamesQuery.getParameters() as Record<string, unknown>,
        );

      // 4. 공통 게임 정보와 전체 개수를 조회하는 메인 쿼리 빌더
      const gameRepository =
        this.userGameRepository.manager.getRepository(Game);
      const qb = gameRepository
        .createQueryBuilder('game')
        .where(`game.id IN (${commonGameIdsQb.getQuery()})`)
        .setParameters(commonGameIdsQb.getParameters());

      // 5. 총 개수 조회: Promise를 반환하므로 await 사용
      const total = await qb.getCount();

      // 페이지네이션 및 정렬 로직 (동기적)
      // 페이지네이션 기본값 적용 (undefined 방어)
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const skip = (page - 1) * limit;

      // 2️⃣ 쿼리 빌더에 적용
      qb.skip(skip).take(limit);

      // 3️⃣ 정렬
      if (query.sortBy) {
        qb.orderBy(`game.${query.sortBy}`, query.ascending ? 'ASC' : 'DESC');
      }

      // 4️⃣ 데이터 조회
      const commonGames = await qb.getMany();

      // 5️⃣ 응답 구성
      const response: PaginatedResponse<Game> = {
        data: commonGames,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          hasPrev: page > 1,
        },
      };
      // 7. 캐시 저장: Promise를 반환하므로 await 사용
      await this.cacheManager.set(cacheKey, response, this.CACHE_TTL);
      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        '공통 게임 목록 조회 중 오류가 발생했습니다.',
      );
    }
  }
}

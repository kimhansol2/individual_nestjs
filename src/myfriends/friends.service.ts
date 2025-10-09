import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Friend } from '../domain/friends/friends.entity';
import { User } from '../domain/users/user.entity';
import { OwnedGame } from '../domain/games/owned-game.entity';
import { GetFriendsDto } from './get-friends.dto';
import {
  GetCommonGamesDto,
  CommonGamesResponse,
  CommonGame,
} from './get-common-games.dto';
import { PaginatedResponse } from '../common/types/pagination.types';
import { SteamService } from '../integrations/steam/steam.service';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly steamService: SteamService,
  ) {}

  async getFriends(
    userId: number,
    dto: GetFriendsDto,
  ): Promise<PaginatedResponse<FriendWithExtra>> {
    try {
      const cacheKey = this.generateFriendsCacheKey(userId, dto);

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

    // 검색어 필터링
    if (dto.search) {
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
        qb.orderBy('friend.friendId', 'ASC');
        break;

      case 'createdAt':
      default:
        qb.orderBy('friend.createdAt', 'DESC');
        break;
    }
  }

  private generateFriendsCacheKey(userId: number, dto: GetFriendsDto): string {
    const params = [
      userId,
      dto.page,
      dto.limit,
      dto.search || '',
      dto.sortBy || 'createdAt',
    ].join(':');

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

  // ==================== 공통 게임 관련 메서드 ====================

  async getCommonGames(
    userId: number,
    friendId: number,
    dto: GetCommonGamesDto,
  ): Promise<CommonGamesResponse> {
    try {
      // 1. 친구 관계 검증
      await this.validateFriendship(userId, friendId);

      // 2. 캐시 확인
      const cacheKey = this.generateCommonGamesCacheKey(userId, friendId, dto);
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as CommonGamesResponse;
      }

      // 3. User 엔티티에서 steamId 조회
      const [user, friend] = await Promise.all([
        this.userRepository.findOne({
          where: { id: userId },
          select: ['id', 'steamId', 'personaName'],
        }),
        this.userRepository.findOne({
          where: { id: friendId },
          select: ['id', 'steamId', 'personaName'],
        }),
      ]);

      if (!user || !friend) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 4. Steam API로 게임 목록 조회 (병렬 처리)
      const [userGamesResponse, friendGamesResponse] = await Promise.all([
        this.steamService.getOwnedGames(user.steamId),
        this.steamService.getOwnedGames(friend.steamId),
      ]);

      // 5. 공통 게임 추출
      const commonGames = this.findCommonGames(
        userGamesResponse.games || [],
        friendGamesResponse.games || [],
      );

      // 6. 검색 필터 적용
      let filteredGames = commonGames;
      if (dto.search && typeof dto.search === 'string') {
        const searchLower = dto.search.toLowerCase();
        filteredGames = commonGames.filter((game) =>
          typeof game.name === 'string'
            ? game.name.toLowerCase().includes(searchLower)
            : false,
        );
      }

      // 7. 정렬 적용
      const sortedGames = this.sortCommonGames(filteredGames, dto.sortBy);

      // 8. 페이지네이션
      const total = sortedGames.length;
      const skip = (dto.page - 1) * dto.limit;
      const paginatedGames = sortedGames.slice(skip, skip + dto.limit);

      // 9. 응답 구성
      const response: CommonGamesResponse = {
        data: paginatedGames,
        meta: {
          userSteamId: user.steamId,
          friendSteamId: friend.steamId,
          page: dto.page,
          limit: dto.limit,
          total,
          totalPages: Math.ceil(total / dto.limit),
          hasNext: skip + dto.limit < total,
          hasPrev: dto.page > 1,
        },
      };

      // 10. 캐시 저장 (5분)
      await this.cacheManager.set(cacheKey, response, this.CACHE_TTL);

      return response;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        '공통 게임 조회 중 오류가 발생했습니다.',
      );
    }
  }

  private async validateFriendship(
    userId: number,
    friendId: number,
  ): Promise<void> {
    if (userId === friendId) {
      throw new BadRequestException('자기 자신과는 비교할 수 없습니다.');
    }

    const friendship = await this.friendRepository.findOne({
      where: { userId, friendId, status: 'accepted' },
    });

    if (!friendship) {
      throw new ForbiddenException('친구 관계가 아니거나 승인되지 않았습니다.');
    }
  }

  private findCommonGames(
    userGames: Array<{
      appid: number;
      name?: string;
      playtime_forever: number;
      img_icon_url?: string;
      rtime_last_played?: number;
    }>,
    friendGames: Array<{
      appid: number;
      name?: string;
      playtime_forever: number;
      img_icon_url?: string;
      rtime_last_played?: number;
    }>,
  ): CommonGame[] {
    const friendGamesMap = new Map(
      friendGames.map((game) => [game.appid, game]),
    );

    const commonGames: CommonGame[] = [];

    for (const userGame of userGames) {
      const friendGame = friendGamesMap.get(userGame.appid);
      if (friendGame) {
        commonGames.push({
          appid: userGame.appid,
          name: userGame.name || 'Unknown Game',
          playtime_forever_user: userGame.playtime_forever || 0,
          playtime_forever_friend: friendGame.playtime_forever || 0,
          img_icon_url: userGame.img_icon_url,
          headerImageUrl: this.steamService.buildAppHeaderUrl(userGame.appid),
          rtime_last_played_user: userGame.rtime_last_played,
          rtime_last_played_friend: friendGame.rtime_last_played,
        });
      }
    }

    return commonGames;
  }

  private sortCommonGames(
    games: CommonGame[],
    sortBy?: 'playtime' | 'name' | 'recent',
  ): CommonGame[] {
    const sorted = [...games];

    switch (sortBy) {
      case 'playtime':
        sorted.sort(
          (a, b) =>
            b.playtime_forever_user +
            b.playtime_forever_friend -
            (a.playtime_forever_user + a.playtime_forever_friend),
        );
        break;

      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;

      case 'recent':
        sorted.sort((a, b) => {
          const aRecent = Math.max(
            a.rtime_last_played_user || 0,
            a.rtime_last_played_friend || 0,
          );
          const bRecent = Math.max(
            b.rtime_last_played_user || 0,
            b.rtime_last_played_friend || 0,
          );
          return bRecent - aRecent;
        });
        break;

      default:
        sorted.sort(
          (a, b) =>
            b.playtime_forever_user +
            b.playtime_forever_friend -
            (a.playtime_forever_user + a.playtime_forever_friend),
        );
        break;
    }

    return sorted;
  }

  private generateCommonGamesCacheKey(
    userId: number,
    friendId: number,
    dto: GetCommonGamesDto,
  ): string {
    const [id1, id2] = [userId, friendId].sort((a, b) => a - b);

    const params = [
      id1,
      id2,
      dto.page,
      dto.limit,
      dto.search || '',
      dto.sortBy || 'playtime',
    ].join(':');

    return `friends:common-games:${params}`;
  }

  async invalidateCommonGamesCache(
    userId: number,
    friendId: number,
  ): Promise<void> {
    try {
      const redisStore = this.cacheManager.stores as unknown as RedisCache;

      if (redisStore && typeof redisStore.keys === 'function') {
        const [id1, id2] = [userId, friendId].sort((a, b) => a - b);
        const pattern = `friends:common-games:${id1}:${id2}:*`;
        const keys: string[] = await redisStore.keys(pattern);

        if (keys && keys.length > 0) {
          await Promise.all(keys.map((key) => this.cacheManager.del(key)));
        }
      }
    } catch (error) {
      console.error('공통 게임 캐시 무효화 중 오류 발생:', error);
    }
  }
}

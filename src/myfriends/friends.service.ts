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
import {
  GetAchievementCompareDto,
  AchievementCompareResponse,
  ComparedAchievementDetail,
} from './get-achievement-compare.dto';
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
        qb.orderBy('friend.created_at', 'DESC');
        break;
    }
  }

  private generateFriendsCacheKey(userId: number, dto: GetFriendsDto): string {
    const params: (string | number)[] = [
      userId,
      dto.page,
      dto.limit,
      dto.search || '',
      dto.sortBy || 'createdAt',
    ];

    return `friends:list:${params.join(':')}`;
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
      const traceId = `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 1. 친구 관계 검증
      await this.validateFriendship(userId, friendId);

      // 2. 캐시 확인 (force=false일 때만)
      if (!dto.force) {
        const cacheKey = this.generateCommonGamesCacheKey(
          userId,
          friendId,
          dto,
        );
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
          return cached as CommonGamesResponse;
        }
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
      const commonGames = this.findCommonGamesDetailed(
        userGamesResponse.games || [],
        friendGamesResponse.games || [],
      );

      // 6. 검색 필터 적용
      let filteredGames = commonGames;
      if (dto.search && typeof dto.search === 'string') {
        const searchLower = dto.search.toLowerCase();
        filteredGames = commonGames.filter((game) =>
          game.name.toLowerCase().includes(searchLower),
        );
      }

      // 7. overlap 필터 적용
      if (dto.filter) {
        filteredGames = this.applyOverlapFilter(filteredGames, dto.filter);
      }

      // 8. 정렬 적용
      const sortedGames = this.sortCommonGamesDetailed(
        filteredGames,
        dto.sortBy,
      );

      // 9. 통계 계산
      const summary = this.calculateCommonGamesSummary(commonGames);

      // 10. 페이지네이션
      const total = sortedGames.length;
      const skip = (dto.page - 1) * dto.limit;
      const paginatedGames = sortedGames.slice(skip, skip + dto.limit);

      // 11. 응답 구성
      const response: CommonGamesResponse = {
        friend: {
          steamid: friend.steamId,
          persona_name: friend.personaName || 'Unknown',
        },
        summary,
        items: paginatedGames,
        paging: {
          page: dto.page,
          size: dto.limit,
          total,
        },
        links: {
          self: this.buildCommonGamesSelfLink(friend.steamId, dto),
          refresh: this.buildCommonGamesRefreshLink(friend.steamId),
        },
        trace_id: traceId,
      };

      // 12. 캐시 저장 (5분, force=false일 때만)
      if (!dto.force) {
        const cacheKey = this.generateCommonGamesCacheKey(
          userId,
          friendId,
          dto,
        );
        await this.cacheManager.set(cacheKey, response, this.CACHE_TTL);
      }

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

  private findCommonGamesDetailed(
    userGames: Array<{
      appid: number;
      name?: string;
      playtime_forever: number;
      playtime_2weeks?: number;
      img_icon_url?: string;
      rtime_last_played?: number;
    }>,
    friendGames: Array<{
      appid: number;
      name?: string;
      playtime_forever: number;
      playtime_2weeks?: number;
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
        // overlap 계산
        const recentOverlap =
          (userGame.playtime_2weeks || 0) > 0 &&
          (friendGame.playtime_2weeks || 0) > 0;

        commonGames.push({
          app_id: userGame.appid,
          name: userGame.name || 'Unknown Game',
          icon: this.steamService.buildAppHeaderUrl(userGame.appid),
          you: {
            playtime_forever: userGame.playtime_forever || 0,
            playtime_2weeks: userGame.playtime_2weeks,
            last_played_at: userGame.rtime_last_played
              ? new Date(userGame.rtime_last_played * 1000).toISOString()
              : undefined,
          },
          friend: {
            playtime_forever: friendGame.playtime_forever || 0,
            playtime_2weeks: friendGame.playtime_2weeks,
            last_played_at: friendGame.rtime_last_played
              ? new Date(friendGame.rtime_last_played * 1000).toISOString()
              : undefined,
          },
          overlap: {
            recent: recentOverlap,
            installed: true, // Steam API는 설치 정보를 제공하지 않으므로 기본값
          },
        });
      }
    }

    return commonGames;
  }

  private applyOverlapFilter(
    games: CommonGame[],
    filter: 'recent_overlap' | 'installed_overlap',
  ): CommonGame[] {
    switch (filter) {
      case 'recent_overlap':
        return games.filter((game) => game.overlap.recent);
      case 'installed_overlap':
        return games.filter((game) => game.overlap.installed);
      default:
        return games;
    }
  }

  private sortCommonGamesDetailed(
    games: CommonGame[],
    sortBy?:
      | 'name'
      | 'you_playtime'
      | 'friend_playtime'
      | 'last_played'
      | 'recent_overlap',
  ): CommonGame[] {
    const sorted = [...games];

    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;

      case 'you_playtime':
        sorted.sort((a, b) => b.you.playtime_forever - a.you.playtime_forever);
        break;

      case 'friend_playtime':
        sorted.sort(
          (a, b) => b.friend.playtime_forever - a.friend.playtime_forever,
        );
        break;

      case 'last_played':
        sorted.sort((a, b) => {
          const aTime = a.you.last_played_at || a.friend.last_played_at || '';
          const bTime = b.you.last_played_at || b.friend.last_played_at || '';
          return bTime.localeCompare(aTime);
        });
        break;

      case 'recent_overlap':
        sorted.sort((a, b) => {
          if (a.overlap.recent && !b.overlap.recent) return -1;
          if (!a.overlap.recent && b.overlap.recent) return 1;
          return 0;
        });
        break;

      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return sorted;
  }

  private calculateCommonGamesSummary(games: CommonGame[]) {
    const total = games.length;
    const recentOverlap = games.filter((game) => game.overlap.recent).length;

    return {
      total,
      recent_overlap: recentOverlap,
    };
  }

  private buildCommonGamesSelfLink(
    steamid: string,
    dto: GetCommonGamesDto,
  ): string {
    const params = new URLSearchParams({
      page: dto.page.toString(),
      size: dto.limit.toString(),
      sort: dto.sortBy || 'name',
    });
    if (dto.filter) params.append('filter', dto.filter);
    if (dto.search) params.append('search', dto.search);
    if (dto.lang) params.append('lang', dto.lang);

    return `/api/v1/friends/${steamid}/common-games?${params.toString()}`;
  }

  private buildCommonGamesRefreshLink(steamid: string): string {
    return `/api/v1/friends/${steamid}/common-games?force=true`;
  }

  private generateCommonGamesCacheKey(
    userId: number,
    friendId: number,
    dto: GetCommonGamesDto,
  ): string {
    const [id1, id2] = [userId, friendId].sort((a, b) => a - b);

    const params: (string | number)[] = [
      id1,
      id2,
      dto.page,
      dto.limit,
      dto.search || '',
      dto.sortBy || 'name',
      dto.filter || '',
      dto.lang || 'korean',
      dto.force ? '1' : '0',
    ];

    return `friends:common-games:${params.join(':')}`;
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

  // ==================== 업적 비교 관련 메서드 ====================

  async getAchievementCompare(
    userId: number,
    friendId: number,
    gameId: number,
    dto: GetAchievementCompareDto,
  ): Promise<AchievementCompareResponse> {
    try {
      const traceId = `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 1. 친구 관계 검증
      await this.validateFriendship(userId, friendId);

      // 2. 캐시 확인 (force=false일 때만)
      if (!dto.force) {
        const cacheKey = this.generateAchievementCompareCacheKey(
          userId,
          friendId,
          gameId,
          dto,
        );
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
          return cached as AchievementCompareResponse;
        }
      }

      // 3. User 엔티티에서 사용자 정보 조회
      const [user, friend] = await Promise.all([
        this.userRepository.findOne({
          where: { id: userId },
          select: ['id', 'steamId', 'personaName', 'avatar'],
        }),
        this.userRepository.findOne({
          where: { id: friendId },
          select: ['id', 'steamId', 'personaName', 'avatar'],
        }),
      ]);

      if (!user || !friend) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 4. Steam API로 데이터 조회 (병렬 처리)
      const [userAchievements, friendAchievements, gameSchema] =
        await Promise.all([
          this.steamService.getPlayerAchievements(user.steamId, gameId),
          this.steamService.getPlayerAchievements(friend.steamId, gameId),
          this.steamService.getSchemaForGame(gameId),
        ]);

      // 5. 게임 정보 검증
      if (!gameSchema?.availableGameStats?.achievements) {
        throw new NotFoundException('게임 업적 정보를 찾을 수 없습니다.');
      }

      // 6. 업적 비교 데이터 생성
      const achievements = this.buildComparedAchievements(
        gameSchema.availableGameStats.achievements,
        userAchievements.achievements || [],
        friendAchievements.achievements || [],
        dto.includeGlobal,
      );

      // 7. 필터 적용
      const filteredAchievements = this.applyFilter(achievements, dto.filter);

      // 8. 정렬 적용
      const sortedAchievements = this.applySort(
        filteredAchievements,
        dto.short,
      );

      // 9. 통계 계산
      const summary = this.calculateSummary(achievements);

      // 10. 페이지네이션
      const total = sortedAchievements.length;
      const skip = (dto.page - 1) * dto.size;
      const paginatedAchievements = sortedAchievements.slice(
        skip,
        skip + dto.size,
      );

      // 11. 응답 구성
      const response: AchievementCompareResponse = {
        game: {
          app_id: gameId,
          name: gameSchema.gameName,
          icon: this.steamService.buildAppHeaderUrl(gameId),
        },
        friend: {
          steamid: friend.steamId,
          persona_name: friend.personaName || 'Unknown',
          avatar: friend.avatar || '',
        },
        summary,
        achievements: paginatedAchievements,
        paging: {
          page: dto.page,
          size: dto.size,
          total,
        },
        links: {
          self: this.buildSelfLink(friend.steamId, gameId, dto),
          refresh: this.buildRefreshLink(friend.steamId, gameId),
        },
        trace_id: traceId,
      };

      // 12. 캐시 저장 (60초)
      if (!dto.force) {
        const cacheKey = this.generateAchievementCompareCacheKey(
          userId,
          friendId,
          gameId,
          dto,
        );
        await this.cacheManager.set(cacheKey, response, 60000);
      }

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
        '업적 비교 조회 중 오류가 발생했습니다.',
      );
    }
  }

  // 헬퍼 메서드들
  private buildComparedAchievements(
    schemaAchievements: Array<{
      name: string;
      displayName: string;
      description?: string;
      icon: string;
      icongray: string;
      hidden: 0 | 1;
    }>,
    userAchievements: Array<{
      apiname: string;
      achieved: number;
      unlocktime: number;
    }>,
    friendAchievements: Array<{
      apiname: string;
      achieved: number;
      unlocktime: number;
    }>,
    includeGlobal: boolean = false,
  ): ComparedAchievementDetail[] {
    const userAchMap = new Map(
      userAchievements.map((ach) => [ach.apiname, ach]),
    );
    const friendAchMap = new Map(
      friendAchievements.map((ach) => [ach.apiname, ach]),
    );

    return schemaAchievements.map((schemaAch) => {
      const userAch = userAchMap.get(schemaAch.name);
      const friendAch = friendAchMap.get(schemaAch.name);

      const youUnlocked = userAch?.achieved === 1;
      const friendUnlocked = friendAch?.achieved === 1;

      // status 결정
      let status:
        | 'friend_missing'
        | 'you_missing'
        | 'both_unlocked'
        | 'both_missing';
      if (youUnlocked && friendUnlocked) {
        status = 'both_unlocked';
      } else if (youUnlocked && !friendUnlocked) {
        status = 'friend_missing';
      } else if (!youUnlocked && friendUnlocked) {
        status = 'you_missing';
      } else {
        status = 'both_missing';
      }

      return {
        api_name: schemaAch.name,
        display_name: schemaAch.displayName,
        description: schemaAch.description || '',
        you: {
          unlocked: youUnlocked,
          unlock_time: userAch?.unlocktime
            ? new Date(userAch.unlocktime * 1000).toISOString()
            : null,
        },
        friend: {
          unlocked: friendUnlocked,
          unlock_time: friendAch?.unlocktime
            ? new Date(friendAch.unlocktime * 1000).toISOString()
            : null,
        },
        status,
        global: includeGlobal ? { percent: 0 } : null,
      };
    });
  }

  private applyFilter(
    achievements: ComparedAchievementDetail[],
    filter?:
      | 'you_missing'
      | 'friend_missing'
      | 'both_unlocked'
      | 'both_missing',
  ): ComparedAchievementDetail[] {
    if (!filter) return achievements;
    return achievements.filter((ach) => ach.status === filter);
  }

  private applySort(
    achievements: ComparedAchievementDetail[],
    sort?:
      | 'status'
      | 'friend_missing'
      | 'you_missing'
      | 'both_unlocked'
      | 'name'
      | 'rarity',
  ): ComparedAchievementDetail[] {
    const sorted = [...achievements];

    switch (sort) {
      case 'status': {
        // 중괄호 추가!
        const statusOrder = {
          you_missing: 1,
          friend_missing: 2,
          both_unlocked: 3,
          both_missing: 4,
        };
        sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
      }

      case 'friend_missing':
        sorted.sort((a, b) => {
          if (a.status === 'friend_missing' && b.status !== 'friend_missing')
            return -1;
          if (a.status !== 'friend_missing' && b.status === 'friend_missing')
            return 1;
          return 0;
        });
        break;

      case 'you_missing':
        sorted.sort((a, b) => {
          if (a.status === 'you_missing' && b.status !== 'you_missing')
            return -1;
          if (a.status !== 'you_missing' && b.status === 'you_missing')
            return 1;
          return 0;
        });
        break;

      case 'both_unlocked':
        sorted.sort((a, b) => {
          if (a.status === 'both_unlocked' && b.status !== 'both_unlocked')
            return -1;
          if (a.status !== 'both_unlocked' && b.status === 'both_unlocked')
            return 1;
          return 0;
        });
        break;

      case 'name':
        sorted.sort((a, b) => a.display_name.localeCompare(b.display_name));
        break;

      case 'rarity':
        sorted.sort((a, b) => {
          const aPercent = a.global?.percent || 100;
          const bPercent = b.global?.percent || 100;
          return aPercent - bPercent;
        });
        break;
    }

    return sorted;
  }

  private calculateSummary(achievements: ComparedAchievementDetail[]) {
    const youUnlocked = achievements.filter((a) => a.you.unlocked).length;
    const friendUnlocked = achievements.filter((a) => a.friend.unlocked).length;
    const bothUnlocked = achievements.filter(
      (a) => a.you.unlocked && a.friend.unlocked,
    ).length;
    const onlyYou = achievements.filter(
      (a) => a.you.unlocked && !a.friend.unlocked,
    ).length;
    const onlyFriend = achievements.filter(
      (a) => !a.you.unlocked && a.friend.unlocked,
    ).length;
    const total = achievements.length;

    return {
      you_unlocked: youUnlocked,
      friend_unlocked: friendUnlocked,
      both_unlocked: bothUnlocked,
      only_you: onlyYou,
      only_friend: onlyFriend,
      you_completion_rate:
        total > 0 ? parseFloat((youUnlocked / total).toFixed(2)) : 0,
      friend_completion_rate:
        total > 0 ? parseFloat((friendUnlocked / total).toFixed(2)) : 0,
      total,
    };
  }

  private buildSelfLink(
    steamid: string,
    gameId: number,
    dto: GetAchievementCompareDto,
  ): string {
    const params = new URLSearchParams({
      lang: dto.lang || 'korean',
      short: dto.short || 'status',
      page: dto.page.toString(),
      size: dto.size.toString(),
    });
    if (dto.filter) params.append('filter', dto.filter);
    if (dto.includeGlobal) params.append('includeGlobal', 'true');

    return `/api/v1/friends/${steamid}/games/${gameId}/achievements/compare?${params.toString()}`;
  }

  private buildRefreshLink(steamid: string, gameId: number): string {
    return `/api/v1/friends/${steamid}/games/${gameId}/achievements/compare?force=true`;
  }

  private generateAchievementCompareCacheKey(
    userId: number,
    friendId: number,
    gameId: number,
    dto: GetAchievementCompareDto,
  ): string {
    const [id1, id2] = [userId, friendId].sort((a, b) => a - b);

    const params: (string | number)[] = [
      id1,
      id2,
      gameId,
      dto.page,
      dto.size,
      dto.lang || 'korean',
      dto.short || 'status',
      dto.filter || '',
      dto.includeGlobal ? '1' : '0',
      dto.force ? '1' : '0',
    ];

    return `friends:achievement-compare:${params.join(':')}`;
  }

  async invalidateAchievementCompareCache(
    userId: number,
    friendId: number,
    gameId: number,
  ): Promise<void> {
    try {
      const redisStore = this.cacheManager.stores as unknown as RedisCache;

      if (redisStore && typeof redisStore.keys === 'function') {
        const [id1, id2] = [userId, friendId].sort((a, b) => a - b);
        const pattern = `friends:achievement-compare:${id1}:${id2}:${gameId}:*`;
        const keys: string[] = await redisStore.keys(pattern);

        if (keys && keys.length > 0) {
          await Promise.all(keys.map((key) => this.cacheManager.del(key)));
        }
      }
    } catch (error) {
      console.error('업적 비교 캐시 무효화 중 오류 발생:', error);
    }
  }
}

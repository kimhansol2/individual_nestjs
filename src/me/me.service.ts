import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { OwnedGameRepository } from 'src/domain/games/owned-game.repository';
import { ListMyGamesDto } from './dto/list-my-games.dto';
import { UsersRepository } from 'src/domain/users/users.repository';
import { MeProfileDto } from './dto/me-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CacheAsideService } from 'src/common/cache/cache-aside.service';

@Injectable()
export class MeService {
  constructor(
    private readonly ownedRepo: OwnedGameRepository,
    private readonly usersRepo: UsersRepository,
    private readonly cache: CacheAsideService,
  ) {}

  async listMyGames(userId: number, q: ListMyGamesDto) {
    const sort: 'playtimeForever' | 'playtime2Weeks' | 'gameId' | 'name' =
      q.sort ?? 'playtimeForever';
    const order: 'asc' | 'desc' = q.order ?? 'desc';
    const page = Math.max(1, Number(q.page ?? 1));
    const size = Math.min(100, Math.max(1, Number(q.size ?? 30)));
    const keyword = q.keyword?.trim();

    const { items, total } = await this.ownedRepo.listForUserQB(userId, {
      sort,
      order,
      page,
      size,
      keyword,
    });
    return { page, size, total, items };
  }

  private profileKey = (userId: number) => `user:profile:${userId}`;
  private profileIdx = (userId: number) => `idx:user:${userId}`;

  async getMeByUserId(userId: number): Promise<MeProfileDto> {
    return this.cache.getOrLoad<MeProfileDto>(
      this.profileKey(userId),
      async () => {
        const user = await this.usersRepo.findById(userId);
        if (!user) throw new NotFoundException('Profile not found');
        return {
          id: user.id,
          steamId: user.steamId,
          personaName: user.personaName ?? null,
          avatar: user.avatar ?? null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        };
      },
      { ttlSec: 30, index: this.profileIdx(userId) },
    );
  }
  async updateProfile(userId: number, patch: UpdateProfileDto): Promise<void> {
    await this.usersRepo.updateProfile(userId, patch);
    await this.cache.invalidateByIndex(this.profileIdx(userId));
  }
}

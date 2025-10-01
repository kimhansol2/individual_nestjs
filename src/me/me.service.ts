import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OwnedGameRepository } from 'src/domain/games/owned-game.repository';
import { ListMyGamesDto } from './dto/list-my-games.dto';
import { UsersRepository } from 'src/domain/users/users.repository';
import { MeProfileDto } from './dto/me-profile.dto';

@Injectable()
export class MeService {
  constructor(
    private readonly ownedRepo: OwnedGameRepository,
    private readonly usersRepo: UsersRepository,
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
    return { page: q.page, size: q.size, total, items };
  }

  async getMeByUserId(userId: number): Promise<MeProfileDto> {
    //서비스 제한 로직이 있다면 여기서 검사
    const restricted = false;
    if (restricted) throw new ForbiddenException('Account is restricted');

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
  }
}

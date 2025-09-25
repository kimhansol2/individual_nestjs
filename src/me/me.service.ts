import { Injectable } from '@nestjs/common';
import { OwnedGameRepository } from 'src/domain/games/owned-game.repository';
import { ListMyGamesDto } from './dto/list-my-games.dto';

@Injectable()
export class MeService {
  constructor(private readonly ownedRepo: OwnedGameRepository) {}

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
}

import { Injectable } from '@nestjs/common';
import { OwnedGameRepository } from 'src/domain/game/owned-game.repository';
import { ListMyGamesDto } from './dto/list-my-games.dto';

@Injectable()
export class MeService {
  constructor(private readonly ownedRepo: OwnedGameRepository) {}

  async listMyGames(userId: number, q: ListMyGamesDto) {
    const { items, total } = await this.ownedRepo.listForUserQB(userId, q);
    return { page: q.page, size: q.size, total, items };
  }
}

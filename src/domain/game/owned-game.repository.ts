import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { OwnedGame } from './owned-game.entity';
import { Game } from './game.entity';

@Injectable()
export class OwnedGameRepository {
  constructor(
    @InjectRepository(OwnedGame) private readonly repo: Repository<OwnedGame>,
  ) {}

  //복합키(userId, gameId) 기준 upsert
  async upsertMany(rows: Array<Partial<OwnedGame>>): Promise<void> {
    if (!rows.length) return;
    await this.repo.upsert(rows, ['userId', 'gameId']);
  }

  // 사용자별 조회용 기본 QB
  qbForUser(userId: number): SelectQueryBuilder<OwnedGame> {
    return this.repo
      .createQueryBuilder('og')
      .where('og.userId = :userId', { userId });
  }

  applyListModifiers(
    qb: SelectQueryBuilder<OwnedGame>,
    opts: {
      sort: 'playtimeForever' | 'playtime2Weeks' | 'gameId';
      order: 'asc' | 'desc';
      page: number;
      size: number;
    },
  ) {
    const order = opts.order === 'asc' ? 'ASC' : 'DESC';

    qb.skip((opts.page - 1) * opts.size).take(opts.size);
    return qb.orderBy('og.playtimeForever', order);
  }

  async listForUserQB(
    userId: number,
    opts: {
      sort: 'playtimeForever' | 'playtime2Weeks' | 'gameId' | 'name';
      order: 'asc' | 'desc';
      page: number;
      size: number;
      keyword?: string;
    },
  ) {
    const order = opts.order === 'asc' ? 'ASC' : 'DESC';
    const qb = this.qbForUser(userId);

    if (opts.keyword || opts.sort === 'name') {
      qb.innerJoin(Game, 'g', 'g.id = og.gameId');
      if (opts.keyword) {
        qb.andWhere('g.name ILIKE :kw', { kw: `${opts.keyword}%` });
      }
    }

    //안전한 정렬 컬럼 화이트리스트 매핑
    const sortExpr =
      opts.sort === 'name'
        ? 'g.name'
        : opts.sort === 'playtime2Weeks'
          ? 'og.playtime2Weeks'
          : opts.sort === 'gameId'
            ? 'og.gameId'
            : 'og.playtimeForever';

    qb.orderBy(sortExpr, order)
      .addOrderBy('og.gameId', 'ASC')
      .skip((opts.page - 1) * opts.size)
      .take(opts.size);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}

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
    await this.repo.upsert(rows, {
      conflictPaths: ['userId', 'gameId'],
      skipUpdateIfNoValuesChanged: true,
    });
  }

  // 사용자별 조회용 기본 QB
  qbForUser(userId: number): SelectQueryBuilder<OwnedGame> {
    return this.repo
      .createQueryBuilder('og')
      .where('og.userId = :userId', { userId });
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
    //데이터 쿼리(필요할 때만 조인)
    const dataQb = this.qbForUser(userId).select('og');
    const needJoin = !!opts.keyword || opts.sort === 'name';
    const kw = `${(opts.keyword ?? '').toLowerCase()}%`;

    if (needJoin) {
      dataQb.innerJoin(Game, 'g', 'g.id = og.gameId');
      if (opts.keyword) {
        dataQb.andWhere('g.name ILIKE :kw', { kw });
      }
    }

    //안전한 정렬 컬럼 화이트리스트 매핑
    const SORT_MAP = {
      name: 'g.name',
      playtime2Weeks: 'og.playtime2Weeks',
      gameId: 'og.gameId',
      playtimeForever: 'og.playtimeForever',
    } as const;

    const sortExpr = SORT_MAP[opts.sort] ?? SORT_MAP.playtimeForever;

    dataQb
      .orderBy(sortExpr, order, 'NULLS LAST')
      .addOrderBy('og.gameId', 'ASC')
      .skip((opts.page - 1) * opts.size)
      .take(opts.size);

    const items = await dataQb.getMany();

    // 2) 카운트 쿼리 (조인 제거 + EXISTS)
    const countQb = this.qbForUser(userId);

    if (opts.keyword) {
      const sub = this.repo.manager
        .createQueryBuilder()
        .select('1')
        .from(Game, 'g')
        .where('g.id = og.gameId')
        .andWhere('g.name ILIKE :kw', { kw });

      countQb
        .andWhere(`EXISTS (${sub.getQuery()})`)
        .setParameters(sub.getParameters());
    }
    const total = await countQb.getCount();

    return { items, total };
  }
}

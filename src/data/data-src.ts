// src/data-source.ts
import { DataSource } from 'typeorm';
import { User } from '../domain/users/user.entity';
import { Game } from '../domain/games/game.entity';
import { OwnedGame } from '../domain/games/owned-game.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'your_password',
  database: 'steam',
  entities: [User, Game, OwnedGame],
  synchronize: true, // 개발 단계에서는 true, 배포 환경에서는 false
});

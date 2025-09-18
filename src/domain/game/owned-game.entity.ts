import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Game } from './game.entity';
import { Friend } from '../users/user-friend.entity';

@Entity()
@Unique(['userId', 'gameId'])
export class OwnedGame {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column()
  userId: number;
  @Index() @Column() gameId: number;
  @Column({ default: 0 }) playtimeForever: number;
  @Column({ default: 0 }) playtime2Weeks: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.ownedGames, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Game, (game) => game.ownedGames, { onDelete: 'CASCADE' })
  game: Game;

  @OneToMany(() => Friend, (friend) => friend.ownedGame, { cascade: false })
  friends: Friend[];
}

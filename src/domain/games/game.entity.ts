import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OwnedGame } from './owned-game.entity';
import { Achievement } from '../achievements/achievement.entity';
@Entity()
export class Game {
  @PrimaryColumn() gameId: number;
  @Column() title: string;
  @Column({ nullable: true }) icon?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OwnedGame, (og) => og.game, { cascade: false })
  ownedGames: OwnedGame[];

  @OneToMany(() => Achievement, (achievement) => achievement.game, {
    cascade: false,
  })
  achievements: Achievement[];
}

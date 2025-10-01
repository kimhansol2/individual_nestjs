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
  JoinColumn,
} from 'typeorm';
import { Game } from '../games/game.entity';
import { UserAchievement } from './user-achievement.entity';

@Entity()
@Unique(['gameId', 'apiName'])
export class Achievement {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column() gameId!: number;
  @Column() apiName!: string;
  @Column() name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ default: false }) hidden!: boolean;
  @Column({ nullable: true }) icon?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Game, (game) => game.achievements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;
  @OneToMany(() => UserAchievement, (userA) => userA.achievement, {
    cascade: false,
  })
  userAchievements!: UserAchievement[];
}

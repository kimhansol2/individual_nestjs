import {
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  Index,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Achievement } from './achievement.entity';
import { User } from '../users/user.entity';
import { Game } from '../games/game.entity';
@Entity()
@Unique(['userId', 'gameId', 'apiName'])
export class UserAchievement {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column() userId!: number;
  @Index() @Column() gameId!: number;
  @Index() @Column() apiName!: string;
  @Column({ default: false }) achieved!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) unlockedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Achievement, (achievement) => achievement.userAchievements, {
    onDelete: 'CASCADE',
  })
<<<<<<< HEAD
  @JoinColumn([
    { name: 'apiName', referencedColumnName: 'apiName' },
    { name: 'gameId', referencedColumnName: 'gameId' },
  ])
  achievement!: Achievement;
=======
  // @JoinColumn({ name: 'apiName' })
  // achievement: Achievement;
  @JoinColumn({ name: 'apiName', referencedColumnName: 'apiName' })
  achievement: Achievement;
>>>>>>> 84c3cb9f53e4f08f6fd942ac41520023c5178e10
  @ManyToOne(() => User, (user) => user.userAchievements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Game, (g) => g.userAchievements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId', referencedColumnName: 'gameId' })
  game!: Game;
}

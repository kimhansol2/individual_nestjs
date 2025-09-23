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
@Entity()
@Unique(['userId', 'gameId', 'apiName'])
export class UserAchievement {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() userId: number;
  @Index() @Column() gameId: number;
  @Column() apiName: string;
  @Column({ default: false }) achieved: boolean;
  @Column({ type: 'timestamptz', nullable: true }) unlockedAt?: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Achievement, (achievement) => achievement.userAchievements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'apiName' })
  achievement: Achievement;
  @ManyToOne(() => User, (user) => user.userAchievements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;
}

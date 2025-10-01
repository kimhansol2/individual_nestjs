import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OwnedGame } from '../games/owned-game.entity';
import { UserAchievement } from '../achievements/user-achievement.entity';
import { Friend } from './user-friend.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn() id!: number;
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 17 })
  steamId!: string;
  @Column({ nullable: true }) personaName?: string;
  @Column({ nullable: true }) avatar?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => OwnedGame, (og) => og.user, { cascade: false })
  ownedGames!: OwnedGame[];
  @OneToMany(() => UserAchievement, (UserA) => UserA.user, { cascade: false })
  userAchievements!: UserAchievement[];
  @OneToMany(() => Friend, (friend) => friend.user, { cascade: false })
  friends!: Friend[];
  @OneToMany(() => Friend, (friend) => friend.friend, { cascade: false })
  friendedBy!: Friend[];
}

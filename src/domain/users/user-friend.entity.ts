import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';
import { OwnedGame } from '../game/owned-game.entity';

@Entity()
@Unique(['userId', 'friendId'])
export class Friend {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() userId: number;
  @Index() @Column() friendId: number;

  @Column({ name: 'friend_since', type: 'timestamptz', nullable: true })
  friendSince: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.friends, { onDelete: 'CASCADE' })
  user: User;
  @ManyToOne(() => OwnedGame, (ownedGame) => ownedGame.friends, {
    onDelete: 'CASCADE',
  })
  ownedGame: OwnedGame;
}

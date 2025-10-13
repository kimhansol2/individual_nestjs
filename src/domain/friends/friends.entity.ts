import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('friends')
export class Friend {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column()
  friendId!: number;

  @Column({ type: 'timestamptz', nullable: true })
  friend_since?: Date;

  @Column({ default: 'pending' })
  status!: 'pending' | 'accepted' | 'blocked';

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

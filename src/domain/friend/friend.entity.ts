import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('friend')
export class Friend {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number; // 내 ID

  @Column()
  friendId!: number; // 친구 ID

  @Column({ type: 'timestamptz', nullable: true })
  friend_since?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}

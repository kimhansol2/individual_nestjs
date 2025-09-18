import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column() steamId: string;
  @Column({ nullable: true }) displayName: string;
  @Column({ nullable: true }) avatar?: string;
}

import { Entity, PrimaryGeneratedColumn, Column, Unique, Index } from 'typeorm';

@Entity()
@Unique(['userId', 'appId'])
export class OwnedGame {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() userId: number;
  @Index() @Column() appId: number;
  @Column({ default: 0 }) playtimeForever: number;
  @Column({ default: 0 }) playtime2Weeks: number;
}

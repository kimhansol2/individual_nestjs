import { Entity, PrimaryGeneratedColumn, Unique, Index, Column } from 'typeorm';
@Entity()
@Unique(['userId', 'appId', 'apiName'])
export class UserAchievement {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() userId: number;
  @Index() @Column() appId: number;
  @Column() apiName: string;
  @Column({ default: false }) achieved: boolean;
  @Column({ type: 'timestamptz', nullable: true }) unlockedAt?: Date;
}

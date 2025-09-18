import { Entity, PrimaryGeneratedColumn, Column, Unique, Index } from 'typeorm';

@Entity()
@Unique(['appId', 'apiName'])
export class Achievement {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() appId: number;
  @Column() apiName: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ default: false }) hidden: boolean;
  @Column({ nullable: true }) icon?: string;
}

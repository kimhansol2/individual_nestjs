import { Entity, PrimaryColumn, Column } from 'typeorm';
@Entity()
export class Game {
  @PrimaryColumn() appId: number;
  @Column() name: string;
  @Column({ nullable: true }) icon?: string;
}

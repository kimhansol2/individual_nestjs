// gameDTO

export class GameDto {
  gameId!: number;
  title!: string;
  icon?: string | null | undefined;
  created_at!: Date;
  updated_at!: Date;
}
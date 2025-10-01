import { IsOptional, IsInt, Min, IsString, IsBoolean } from 'class-validator';

export class GetCommonGamesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsInt()
  @Min(0)
  page?: number = 0;

  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @IsOptional()
  @IsBoolean()
  ascending?: boolean = true;
}

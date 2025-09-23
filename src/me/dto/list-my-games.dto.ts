import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ListMyGamesDto {
  @IsOptional()
  @IsIn(['playtimeForever', 'playtime2Weeks', 'gameId', 'name'])
  sort: 'playtimeForever' | 'playtime2Weeks' | 'gameId' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  size = 30;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}

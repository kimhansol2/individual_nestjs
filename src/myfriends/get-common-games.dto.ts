// src/friends/get-common-games.dto.ts 파일

import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetCommonGamesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['playtime', 'name', 'recent'])
  sortBy?: 'playtime' | 'name' | 'recent' = 'playtime';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  ascending?: boolean = true;
}

// 🚨 'export' 키워드 추가
export interface CommonGame {
  appid: number;
  name: string;
  playtime_forever_user: number;
  playtime_forever_friend: number;
  img_icon_url?: string;
  headerImageUrl: string;
  rtime_last_played_user?: number;
  rtime_last_played_friend?: number;
}

// 🚨 'export' 키워드 추가
export interface CommonGamesResponse {
  data: CommonGame[];
  meta: {
    userSteamId: string;
    friendSteamId: string;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

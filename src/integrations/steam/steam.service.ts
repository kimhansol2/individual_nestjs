import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { errorSummary } from '../../common/error.util';

const API = 'https://api.steampowered.com';

type OwnedGamesResponse = {
  response: {
    game_count?: number;
    games?: Array<{
      appid: number;
      name?: string;
      playtime_forever: number;
      playtime_2weeks?: number;
      img_icon_url?: string;
      has_community_visible_stats: boolean;
      rtime_last_played?: number;
    }>;
  };
};

type ResolveVanityResponse = {
  response: {
    success: 1 | 42;
    steamid?: string;
    message?: string;
  };
};

@Injectable()
export class SteamService {
  private readonly key: string;
  private readonly http: AxiosInstance;

  constructor(cfg: ConfigService) {
    this.key = cfg.getOrThrow<string>('STEAM_API_KEY');
    this.http = axios.create({
      baseURL: API,
      timeout: 7000,
      headers: { 'User-Agent': 'steam-integration/1.0' },
    });
  }

  //보유 게임 목록
  async getOwnedGames(steamId64: string) {
    try {
      const { data } = await this.http.get<OwnedGamesResponse>(
        `/IPlayerService/GetOwnedGames/v1/`,
        {
          params: {
            key: this.key,
            steamid: steamId64,
            include_appinfo: 1,
            include_played_free_games: 1,
          },
        },
      );
      return data?.response ?? { game_count: 0, games: [] };
    } catch (e: unknown) {
      throw new InternalServerErrorException(
        `Steam GetOwnedGames failed: ${errorSummary(e)}`,
      );
    }
  }

  // steam 닉네임을 숫자 id로 바꾸는 변환용
  async resolveVanity(
    vanity: string,
  ): Promise<ResolveVanityResponse['response']> {
    try {
      const { data } = await this.http.get<ResolveVanityResponse>(
        `/ISteamUser/ResolveVanityURL/v1/`,
        {
          params: { key: this.key, vanityurl: vanity },
        },
      );
      return data.response;
    } catch (e: unknown) {
      throw new InternalServerErrorException(
        `Steam ResolveVanity failed: ${errorSummary(e)}`,
      );
    }
  }

  buildAppIconUrl(appId: number, iconHash?: string): string | null {
    if (!iconHash) return null;
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${iconHash}`;
  }

  buildAppHeaderUrl(appid: number): string {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  }
}

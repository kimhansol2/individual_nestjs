import { Injectable } from '@nestjs/common';
import axios from 'axios';

const API = 'https://api.steampowered.com';

@Injectable()
export class SteamService {
  private readonly key = process.env.STEAM_API_KEY!;

  //게임 목록 조회
  async getOwnedGames(steamId: string) {
    const { data } = await axios.get(
      `${API}/IPlayerService/GetOwnedGames/v1/`,
      {
        params: {
          key: this.key,
          steamid: steamId,
          include_appinfo: true,
          include_played_free_games: true,
        },
      },
    );
    return data?.respose ?? {};
  }

  // steam 닉네임을 숫자 id로 바꾸는 변환용
  async resolveVanity(vanity: string) {
    const { data } = await axios.get(`${API}/ISteamUser/ResolveVanityURL/v1/`, {
      params: { key: this.key, vanityurl: vanity },
    });
    return data?.response ?? {};
  }
}

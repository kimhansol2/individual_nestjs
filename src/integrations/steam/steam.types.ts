export interface SteamPlayer {
  steamid: string;
  personaname?: string;
  avatarfull?: string;
}

export interface GetPlayerSummariesRaw {
  response: { players: unknown[] };
}

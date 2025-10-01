import { SteamPlayer } from './steam.types';

function isRec(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

export function toSteamPlayer(p: unknown): SteamPlayer {
  if (!isRec(p)) throw new Error('player must be object');

  const sid = p['steamid'];
  if (typeof sid !== 'string') throw new Error('steamid must be string');

  const personaname =
    typeof p['personaname'] === 'string' ? p['personaname'] : undefined;

  const avatarfull =
    typeof p['avatarfull'] === 'string' ? p['avatarfull'] : undefined;
  return { steamid: sid, personaname, avatarfull };
}

export function parseGetPlayerSummaries(json: unknown): SteamPlayer[] {
  if (
    !isRec(json) ||
    !isRec(json.response) ||
    !Array.isArray(json.response.players)
  ) {
    throw new Error('bad schema: response.players');
  }

  return json.response.players.map(toSteamPlayer);
}

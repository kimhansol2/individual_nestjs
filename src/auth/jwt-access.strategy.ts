import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type AccessPayload = { sub: number; typ?: string; steamId?: string };

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessPayload) {
    if (
      !Number.isSafeInteger(payload.sub) ||
      (payload.typ && payload.typ !== 'access')
    )
      throw new UnauthorizedException('Invalid accessToken');

    return { userId: payload.sub, steamId: payload.steamId };
  }
}

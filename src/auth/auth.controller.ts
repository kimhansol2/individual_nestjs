import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { SteamOpenIdService } from './steam-openid.service';

@Controller('auth/steam')
export class SteamAuthController {
  constructor(private readonly steam: SteamOpenIdService) {}

  // 스팀 로그인 페이지로 리다이렉트
  @Get()
  async start(@Res() res: Response) {
    const url = await this.steam.buildRedirectUrl();
    return res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query() query: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.steam.finalizeLogin(query);

    // refersh 쿠키 설정 (HttpOnly)
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: result.refreshTokenMaxAgeMs,
      path: '/api/v1',
    });

    // body에는 accessToken만
    return {
      tokenType: 'Bearer',
      accessToken: result.accessToken,
      expiresIn: result.accessTokenExpiresIn,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['refresh_token'];
    if (!token) throw new UnauthorizedException('no refresh cookie');

    const out = await this.steam.rotateRefreshToken(token);

    res.cookie('refresh_token', out.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: out.refreshTokenMaxAgeMs,
      path: '/api/v1',
    });

    return {
      tokenType: 'Bearer',
      accessToken: out.accessToken,
    };
  }
}

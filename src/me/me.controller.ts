import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MeService } from './me.service';
import { Envelope, MeProfileDto } from './dto/me-profile.dto';
import { ListMyGamesDto } from './dto/list-my-games.dto';
import { UserId } from 'src/auth/user-id.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { NoStoreInterceptor } from 'src/common/interceptors/no-store.interceptor';
import { UserScopedCacheInterceptor } from 'src/common/interceptors/user-cache.interceptor';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('games')
  async listMyGames(@UserId() userId: number, @Query() q: ListMyGamesDto) {
    return this.meService.listMyGames(userId, q);
  }

  @ApiOperation({ summary: '현재 로그인한 사용자의 기본 프로필 반환' })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          id: 1,
          steamId: '76561198000355602',
          personaName: 'kim',
          avatar: 'https://.../avatarfull.jpg',
          createdAt: '2025-09-06T08:30:00Z',
          updatedAt: '2025-09-30T09:00:00Z',
        },
        error: null,
      },
    },
  })
  @ApiUnauthorizedResponse({
    schema: {
      example: {
        data: null,
        error: { code: 'unauthorized', message: 'Login required' },
      },
    },
  })
  @ApiForbiddenResponse({
    schema: {
      example: {
        data: null,
        error: { code: 'fobidden', message: 'Account is restricted' },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: {
      example: {
        data: null,
        error: { code: 'user_not_found', message: 'Profile not found' },
      },
    },
  })
  @ApiTooManyRequestsResponse({
    schema: {
      example: {
        data: null,
        error: { code: 'too_many_requests', message: 'Try again later' },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(NoStoreInterceptor)
  @Get()
  async getMe(@UserId() userId: number): Promise<Envelope<MeProfileDto>> {
    const data = await this.meService.getMeByUserId(userId);
    return { data, error: null };
  }
}

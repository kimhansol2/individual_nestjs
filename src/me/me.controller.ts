import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MeService } from './me.service';
import { ListMyGamesDto } from './dto/list-my-games.dto';
import { UserId } from 'src/auth/user-id.decorator';

@Controller('api/v1/me')
//@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('games')
  async listMyGames(@UserId() userId: number, @Query() q: ListMyGamesDto) {
    return this.meService.listMyGames(userId, q);
  }
}

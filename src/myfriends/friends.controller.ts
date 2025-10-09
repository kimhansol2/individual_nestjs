import {
  Controller,
  Get,
  Query,
  ValidationPipe,
  UseGuards,
  Post,
  Delete,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { UserId } from '../auth/user-id.decorator'; // @UserId 데코레이터 위치가 올바른지 확인 필요
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // 🚨 JwtAuthGuard 추가
import { GetFriendsDto } from './get-friends.dto';
import { GetCommonGamesDto } from './get-common-games.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// 클래스 레벨에 JwtAuthGuard와 ApiTags, ApiBearerAuth 적용
@ApiTags('Friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // 🚨 모든 엔드포인트에 인증 적용
@Controller('api/v1/friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @UseGuards(ThrottlerGuard) // Throttle Guard는 그대로 유지
  async getFriends(
    @UserId() userId: string,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    )
    query: GetFriendsDto,
  ) {
    const userIdNum = parseInt(userId, 10);
    return this.friendsService.getFriends(userIdNum, query);
  }

  @Post(':friendId')
  @UseGuards(ThrottlerGuard)
  async addFriend(
    @UserId() userId: string,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    const userIdNum = parseInt(userId, 10);
    return this.friendsService.addFriend(userIdNum, friendId);
  }

  @Post(':friendId/accept')
  @UseGuards(ThrottlerGuard)
  async acceptFriend(
    @UserId() userId: string,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    const userIdNum = parseInt(userId, 10);
    return this.friendsService.acceptFriend(userIdNum, friendId);
  }

  @Delete(':friendId')
  @UseGuards(ThrottlerGuard)
  async removeFriend(
    @UserId() userId: string,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    const userIdNum = parseInt(userId, 10);
    return this.friendsService.removeFriend(userIdNum, friendId);
  }

  @Post(':friendId/block')
  @UseGuards(ThrottlerGuard)
  async blockFriend(
    @UserId() userId: string,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    const userIdNum = parseInt(userId, 10);
    return this.friendsService.blockFriend(userIdNum, friendId);
  }

  @Get(':friendId/status')
  @UseGuards(ThrottlerGuard)
  async getFriendStatus(
    @UserId() userId: string,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    const userIdNum = parseInt(userId, 10);
    return this.friendsService.getFriendStatus(userIdNum, friendId);
  }

  @Get(':friendId/common-games')
  @UseGuards(ThrottlerGuard)
  getCommonGames(
    @UserId() userId: string,
    @Param('friendId', ParseIntPipe) friendId: number,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    )
    query: GetCommonGamesDto,
  ) {
    const userIdNum = parseInt(userId, 10);
    return this.friendsService.getCommonGames(userIdNum, friendId, query);
  }
}

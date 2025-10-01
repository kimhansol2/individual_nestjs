import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { GetFriendsDto } from './get-friends.dto';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

describe('FriendsController', () => {
  let controller: FriendsController;
  let getFriendsMock: jest.Mock;

  beforeEach(async () => {
    getFriendsMock = jest.fn().mockResolvedValue({
      data: [{ id: 1, userId: 1, friendId: 2, status: 'accepted' }],
      meta: {
        page: 1,
        limit: 30,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // ThrottlerModule 설정을 'throttlers' 배열 형태로 수정합니다.
        ThrottlerModule.forRoot([
          {
            ttl: 60, // 예시 값 (실제 Throttler 설정과 동일하게)
            limit: 10, // 예시 값
          },
        ]),
      ],
      controllers: [FriendsController],
      providers: [
        {
          provide: FriendsService,
          useValue: {
            getFriends: getFriendsMock,
          },
        },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    controller = module.get<FriendsController>(FriendsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return friend list', async () => {
    // request 객체 대신 string 타입의 userId를 전달
    const userId = '1'; // 컨트롤러가 기대하는 string 타입으로 전달

    const query: GetFriendsDto = {
      page: 1,
      limit: 30,
      sortBy: 'name',
    };

    // 컨트롤러 메서드에 맞게 호출
    const result = await controller.getFriends(userId, query);

    // 서비스 메서드 호출 시에는 숫자로 변환됐는지 확인
    expect(getFriendsMock).toHaveBeenCalledWith(1, query);
    expect(result.data).toHaveLength(1);
  });
});

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm'; // TypeOrmModule 추가
import { FriendsController } from '../../myfriends/friends.controller';
import { FriendsService } from '../../myfriends/friends.service';
// FriendsEntity를 도메인 폴더에서 가져옵니다.
import { Friend } from './friends.entity'; // 👈 FriendsService가 사용하는 엔티티

@Module({
  imports: [
    // 1. FriendsService가 의존하는 TypeORM 엔티티 등록
    TypeOrmModule.forFeature([Friend]),
    // 2. FriendsService가 의존하는 CacheModule 등록 (전역 설정이 아니라면 여기에 등록)
    CacheModule.register({
      // 캐시 설정 (전역 설정이 아니라면 필요한 설정을 추가합니다)
    }),
  ],
  controllers: [FriendsController],
  providers: [
    FriendsService,
    // FriendsRepository는 TypeOrmModule이 대신 처리하므로 제거하거나 확인이 필요
    // 만약 FriendsRepository가 커스텀 레포지토리라면 별도 등록이 필요
    // ...
  ],
  exports: [
    FriendsService,
    // ...
  ],
})
export class FriendsModule {}

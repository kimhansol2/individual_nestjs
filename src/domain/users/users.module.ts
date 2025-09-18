import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Friend } from './user-friend.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Friend])],
  exports: [TypeOrmModule],
})
export class UsersModule {}

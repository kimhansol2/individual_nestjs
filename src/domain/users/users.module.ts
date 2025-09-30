import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Friend } from './user-friend.entity';
import { UsersRepository } from './users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User, Friend])],
  providers: [UsersRepository],
  exports: [TypeOrmModule, UsersRepository],
})
export class UsersModule {}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

export type UserProfilePatch = {
  personaName?: string | null;
  avatar?: string | null;
};

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async findBySteamId(steamId: string): Promise<User | null> {
    return this.repo.findOne({ where: { steamId } });
  }

  async upsertBySteamId(
    steamId: string,
    patch?: UserProfilePatch,
  ): Promise<User> {
    const values: QueryDeepPartialEntity<User> = { steamId };

    if (patch) {
      if (patch.personaName === null) values.personaName = () => 'NULL';
      else if (patch.personaName !== undefined)
        values.personaName = patch.personaName;

      if (patch.avatar === null) values.avatar = () => 'NULL';
      else if (patch.avatar !== undefined) values.avatar = patch.avatar;
    }
    await this.repo.upsert(values, {
      conflictPaths: ['steamId'],
      skipUpdateIfNoValuesChanged: true,
    });

    const user = await this.findBySteamId(steamId);
    if (!user) throw new Error('upsertBySteamId: user not found after upsert');
    return user;
  }
}

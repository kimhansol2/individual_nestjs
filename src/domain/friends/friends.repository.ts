import { EntityRepository, Repository } from 'typeorm';
import { Friend } from './friends.entity';

@EntityRepository(Friend)
export class FriendsRepository extends Repository<Friend> {
  async listFriends(userId: number, search?: string) {
    const qb = this.createQueryBuilder('friend').where(
      'friend.userId = :userId',
      { userId },
    );

    if (search) {
      qb.andWhere('friend.friendId LIKE :search', { search: `%${search}%` });
    }

    return qb.getMany();
  }
}

export class FriendResponseDto {
  id: number;
  userId: number;
  friendId: number;
  status: string;
  createdAt: Date;

  constructor(partial: Partial<FriendResponseDto>) {
    Object.assign(this, partial);
  }
}

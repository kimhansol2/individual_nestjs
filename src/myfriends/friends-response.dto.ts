export class FriendResponseDto {
  id: number = 0; // 초기값 설정
  userId: number = 0;
  friendId: number = 0;
  status: string = '';
  createdAt: Date = new Date(); // 현재 시간으로 초기화

  constructor(partial: Partial<FriendResponseDto>) {
    Object.assign(this, partial);
  }
}

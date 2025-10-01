// 게임 객체 타입 정의

export class GameDto {
  gameId: number;          // 게임의 고유 ID
  title: string;           // 게임 제목
  icon?: string;           // 게임 이미지 URL
  created_at?: number;     // 데이터 생성날짜
  updated_at?: number;     // 데이터 업데이트 날짜
}

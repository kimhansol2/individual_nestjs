// 보유 게임 객체 타입 정의

export class OwnedGameDto {
  gameId: number;               // 게임의 고유 ID
  title: string;                // 게임 제목
  gameImage?: string;           // 게임 이미지 URL
  playtime_forever?: number;    // 총 플레이 시간 (분 단위)
  playtime_2weeks?: number;     // 최근 2주간 플레이 시간 (분 단위)
  created_at?: number;          // 데이터 생성날짜
  updated_at?: number;          // 데이터 업데이트 날짜
  last_played_at: Date;         // 마지막 플레이 날짜
}

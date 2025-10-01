// 게임 객체 타입 정의

export class GameDto {
  gameId: number; // 게임의 고유 ID
  title: string; // 게임 제목
  gameImage: string; // 게임 이미지 URL
  playtime_forever?: number; // 총 플레이 시간 (분 단위)
  playtime_2weeks?: number; // 최근 2주간 플레이 시간 (분 단위)
  last_played_at: string; // 마지막 플레이 시간
}

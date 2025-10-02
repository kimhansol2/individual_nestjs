// T는 페이징 처리될 데이터의 개별 항목 타입을 나타냅니다.
export interface PaginatedResponse<T> {
  data: T[]; // 실제 데이터 배열
  meta: {
    page: number; // 현재 페이지 번호
    limit: number; // 페이지당 항목 수
    total: number; // 전체 항목 수
    totalPages: number; // 전체 페이지 수
    hasNext: boolean; // 다음 페이지 존재 여부
    hasPrev: boolean; // 이전 페이지 존재 여부
  };
}

// 게시판 타입 (docs/28)
//
// 본문·댓글은 plain text. UI에서 React 자동 escape, 마크다운 미지원.
// ipHash는 작성자 본인 매칭용 (수정·삭제 권한 체크). nickname은 표시용.

export type BoardComment = {
  id: string;
  body: string;
  nickname: string;
  ipHash: string;
  at: number;
};

export type BoardPost = {
  id: string;
  title: string;
  body: string;
  nickname: string;
  ipHash: string;
  at: number;
  updatedAt?: number;
  comments: BoardComment[];
  reportCount: number;
};

// 목록 응답 — body·comments 제외해 페이로드 경량화
export type BoardListItem = {
  id: string;
  title: string;
  nickname: string;
  at: number;
  commentCount: number;
};

// 작성자 본인 식별 결과 — UI에서 수정·삭제 버튼 노출 여부 판단용
export type BoardOwnership = {
  ownerOfPost: boolean;
  ownerOfComments: string[]; // 댓글 ID 리스트
};

// 입력 검증 한도
export const BOARD_TITLE_MAX = 50;
export const BOARD_BODY_MAX = 2000;
export const BOARD_COMMENT_MAX = 500;
export const BOARD_NICKNAME_MAX = 20;
export const BOARD_LIST_CAP = 200; // 최신 N개만 보존
export const BOARD_COMMENTS_PER_POST_CAP = 100;

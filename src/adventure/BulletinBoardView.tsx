"use client";

import { Note } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";

// TODO: 추후 콘텐츠 채울 예정 — 마을 공지 / 플레이어 게시글 / 이벤트 안내 등.
export function BulletinBoardView() {
  return (
    <EmptyState
      icon={<Note size={40} weight="duotone" />}
      title="아직 새로운 글이 없습니다"
      message="이곳은 마을의 게시판입니다. 곧 새 소식이 올라올 예정입니다."
    />
  );
}

// 게시판 KV 저장소 헬퍼 (docs/28)
//
// 채팅 (`@/app/api/chat/route.ts`) 동일 패턴 — list 키 + item 키 분리,
// `hasKv()` 가드로 KV 미설정 환경에서 우아하게 503.

import { kv } from "@vercel/kv";
import { createHash, randomUUID } from "node:crypto";

import type { BoardComment, BoardListItem, BoardPost } from "./types";
import { BOARD_LIST_CAP } from "./types";

export const POSTS_LIST_KEY = "board:posts:list";
export const POST_KEY = (id: string) => `board:post:${id}`;
export const REPORTS_KEY = "board:reports";

export const hasKv = () => !!process.env.KV_REST_API_URL;

export const hashIp = (ip: string): string => {
  const salt = process.env.IP_SALT ?? "default-salt-change-me";
  return createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .slice(0, 16);
};

export const newPostId = (): string => `${Date.now()}-${randomUUID().slice(0, 8)}`;
export const newCommentId = (): string => `c-${Date.now()}-${randomUUID().slice(0, 6)}`;

export const toListItem = (p: BoardPost): BoardListItem => ({
  id: p.id,
  title: p.title,
  nickname: p.nickname,
  at: p.at,
  commentCount: p.comments?.length ?? 0,
});

export async function listPosts(): Promise<BoardPost[]> {
  if (!hasKv()) return [];
  const ids = (await kv.lrange<string>(POSTS_LIST_KEY, 0, BOARD_LIST_CAP - 1)) ?? [];
  if (ids.length === 0) return [];
  const posts = await Promise.all(ids.map((id) => kv.get<BoardPost>(POST_KEY(id))));
  return posts.filter((p): p is BoardPost => p != null);
}

export async function getPost(id: string): Promise<BoardPost | null> {
  if (!hasKv()) return null;
  return (await kv.get<BoardPost>(POST_KEY(id))) ?? null;
}

export async function savePost(post: BoardPost): Promise<void> {
  await kv.set(POST_KEY(post.id), post);
}

export async function pushNewPost(post: BoardPost): Promise<void> {
  // 최신 게시글이 list 맨 앞에 오도록 lpush + 캡 초과분 ltrim.
  await kv.lpush(POSTS_LIST_KEY, post.id);
  await kv.ltrim(POSTS_LIST_KEY, 0, BOARD_LIST_CAP - 1);
  await savePost(post);
}

export async function removePostFromList(id: string): Promise<void> {
  // KV ltrim/lrem 사용 — 목록에서 제거 후 본문 삭제.
  if (!hasKv()) return;
  await kv.lrem(POSTS_LIST_KEY, 0, id);
  await kv.del(POST_KEY(id));
}

export async function addCommentToPost(
  postId: string,
  comment: BoardComment,
): Promise<BoardPost | null> {
  const post = await getPost(postId);
  if (!post) return null;
  const updated: BoardPost = {
    ...post,
    comments: [...(post.comments ?? []), comment],
  };
  await savePost(updated);
  return updated;
}

export async function removeCommentFromPost(
  postId: string,
  commentId: string,
  ipHash: string,
): Promise<BoardPost | null> {
  const post = await getPost(postId);
  if (!post) return null;
  const target = post.comments.find((c) => c.id === commentId);
  if (!target) return null;
  if (target.ipHash !== ipHash) return null; // 본인 매칭 실패
  const updated: BoardPost = {
    ...post,
    comments: post.comments.filter((c) => c.id !== commentId),
  };
  await savePost(updated);
  return updated;
}

export async function incrementReport(postId: string): Promise<BoardPost | null> {
  const post = await getPost(postId);
  if (!post) return null;
  const updated: BoardPost = { ...post, reportCount: (post.reportCount ?? 0) + 1 };
  await savePost(updated);
  // 신고 큐에도 기록 (관리자 콘솔용). 중복 push 방지를 위해 제거 후 추가.
  await kv.lrem(REPORTS_KEY, 0, postId);
  await kv.lpush(REPORTS_KEY, postId);
  return updated;
}

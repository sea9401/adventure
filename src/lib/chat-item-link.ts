import { ITEMS, type ItemId } from "@/adventure/data/items";
import type { CraftTier } from "@/adventure/data/craftQuality";
import type { DropQuality } from "@/adventure/data/dropQuality";

// 채팅 메시지 본문에 보유 아이템을 끼워 넣는 토큰. 형식:
//   [[item:branch_stick]]            — 기본/무등급
//   [[item:baseball_bat:c1]] / :c-1  — 제작 품질 등급 (±1, ±2)
//   [[item:bandit_dagger:d2]]        — 드랍 품질 등급 (정교한=1 / 빼어난=2)
// itemId + 등급만으로 스탯·설명까지 결정적으로 복원되므로 본문에 그것만 싣는다.
// 토큰을 모르는 (구버전) 클라이언트는 그냥 텍스트로 보여준다 — graceful degrade.

export type ChatItemRef = {
  id: ItemId;
  craftTier?: CraftTier;
  dropQuality?: DropQuality;
};

// 한 메시지에 너무 많이 끼우지 못하게 — 파싱 시 이 개수까지만 칩으로 치환.
export const MAX_ITEM_LINKS_PER_MESSAGE = 3;

const TOKEN_RE = /\[\[item:([a-z0-9_]+)(?::([cd])(-?[12]))?\]\]/g;

export function encodeItemLink(ref: ChatItemRef): string {
  if (ref.craftTier) return `[[item:${ref.id}:c${ref.craftTier}]]`;
  if (ref.dropQuality) return `[[item:${ref.id}:d${ref.dropQuality}]]`;
  return `[[item:${ref.id}]]`;
}

export type ChatSegment =
  | { type: "text"; text: string }
  | ({ type: "item" } & ChatItemRef);

// 메시지 본문 → 텍스트/아이템 세그먼트 배열. 알 수 없는 아이템·등급의 토큰은 텍스트로 남긴다.
export function parseChatContent(content: string): ChatSegment[] {
  const out: ChatSegment[] = [];
  let last = 0;
  let used = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(content)) !== null) {
    if (used >= MAX_ITEM_LINKS_PER_MESSAGE) break;
    const ref = toRef(m[1], m[2], m[3]);
    if (!ref) continue;
    if (m.index > last) out.push({ type: "text", text: content.slice(last, m.index) });
    out.push({ type: "item", ...ref });
    last = m.index + m[0].length;
    used++;
  }
  if (last < content.length) out.push({ type: "text", text: content.slice(last) });
  return out;
}

function toRef(
  rawId: string,
  kind: string | undefined,
  rawGrade: string | undefined,
): ChatItemRef | null {
  if (!(rawId in ITEMS)) return null;
  const id = rawId as ItemId;
  if (!kind) return { id };
  const g = Number(rawGrade);
  if (kind === "c" && (g === 1 || g === -1 || g === 2 || g === -2)) {
    return { id, craftTier: g as CraftTier };
  }
  if (kind === "d" && (g === 1 || g === 2)) {
    return { id, dropQuality: g as DropQuality };
  }
  return null;
}

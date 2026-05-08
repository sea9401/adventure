import type { RemoteSave } from "@/lib/storage/remote";
import type { ItemKind, ListResponse, Listing, SortMode } from "./types";

export type ListQuery = {
  q?: string;
  kind?: ItemKind | "all";
  sort?: SortMode;
  mine?: boolean;
  cursor?: string | null;
  limit?: number;
};

export async function fetchListings(q: ListQuery): Promise<ListResponse> {
  const url = new URL("/api/marketplace/listings", window.location.origin);
  if (q.q) url.searchParams.set("q", q.q);
  if (q.kind && q.kind !== "all") url.searchParams.set("kind", q.kind);
  if (q.sort) url.searchParams.set("sort", q.sort);
  if (q.mine) url.searchParams.set("mine", "1");
  if (q.cursor) url.searchParams.set("cursor", q.cursor);
  if (q.limit) url.searchParams.set("limit", String(q.limit));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`목록 로드 실패 (${r.status})`);
  return (await r.json()) as ListResponse;
}

export type CreateParams = {
  itemKind: ItemKind;
  itemId: string;
  quantity: number;
  price: number;
};

export type CreateResult = {
  ok: true;
  listing: Omit<Listing, "sellerId" | "sellerName" | "isMine">;
  inventory: unknown; // 서버가 적용한 inventory.v2 스냅샷
};

// 등록 — 호출 전에 RemoteSave.flush() 로 로컬 보류 PATCH 를 모두 보내서
// 서버측 inventory.v2 가 최신 상태에서 차감되도록 한다.
export async function createListing(
  remote: RemoteSave,
  params: CreateParams,
): Promise<CreateResult> {
  await remote.flush();
  const r = await fetch("/api/marketplace/listings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(translateError(text, r.status));
  }
  return (await r.json()) as CreateResult;
}

export type CancelResult = { ok: true; inventory: unknown };

export async function cancelListing(
  remote: RemoteSave,
  id: number,
): Promise<CancelResult> {
  await remote.flush();
  const r = await fetch(
    `/api/marketplace/listings?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!r.ok) {
    const text = await r.text();
    throw new Error(translateError(text, r.status));
  }
  return (await r.json()) as CancelResult;
}

function translateError(text: string, status: number): string {
  switch (text) {
    case "slot_limit":
      return "동시 등록 슬롯 한도(10개)를 넘었습니다.";
    case "equipped":
      return "장착 중인 장비는 등록할 수 없습니다.";
    case "insufficient":
      return "인벤토리에 해당 수량이 없습니다.";
    case "not_tradable":
    case "not tradable":
      return "이 아이템은 거래할 수 없습니다.";
    case "not_active":
      return "이미 판매되었거나 취소된 listing 입니다.";
    case "not_found":
      return "listing 을 찾을 수 없습니다.";
    case "forbidden":
      return "권한이 없습니다.";
    case "race":
      return "다른 작업과 충돌했습니다. 다시 시도하세요.";
    default:
      return `요청 실패 (${status}): ${text}`;
  }
}

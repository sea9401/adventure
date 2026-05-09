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

export async function fetchListings(
  q: ListQuery,
  signal?: AbortSignal,
): Promise<ListResponse> {
  const url = new URL("/api/marketplace/listings", window.location.origin);
  if (q.q) url.searchParams.set("q", q.q);
  if (q.kind && q.kind !== "all") url.searchParams.set("kind", q.kind);
  if (q.sort) url.searchParams.set("sort", q.sort);
  if (q.mine) url.searchParams.set("mine", "1");
  if (q.cursor) url.searchParams.set("cursor", q.cursor);
  if (q.limit) url.searchParams.set("limit", String(q.limit));
  const r = await fetch(url.toString(), { signal });
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

export type BuyResult = {
  ok: true;
  newGold: number;
  fee: number;
  sellerName: string;
  itemName: string;
  quantity: number;
  inboxId: number;
};

export async function buyListing(
  remote: RemoteSave,
  listingId: number,
): Promise<BuyResult> {
  await remote.flush();
  const r = await fetch("/api/marketplace/listings/buy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: listingId }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(translateError(text, r.status));
  }
  return (await r.json()) as BuyResult;
}

export type InboxItem = {
  id: number;
  kind: "sale_proceeds" | "purchase_item" | "cancel_return" | "user_message";
  payload: Record<string, unknown>;
  message: string | null;
  listingId: number | null;
  fromName: string | null;
  createdAt: string;
};

export type InboxResponse = {
  items: InboxItem[];
  unclaimedCount: number;
};

export async function fetchInbox(): Promise<InboxResponse> {
  const r = await fetch("/api/marketplace/inbox");
  if (!r.ok) throw new Error(`우편함 로드 실패 (${r.status})`);
  return (await r.json()) as InboxResponse;
}

export type ClaimResult = {
  ok: true;
  claimed: number[];
  goldAdded: number;
  itemsAdded: { kind: "equip" | "material"; id: string; quantity: number }[];
  newGold: number | null;
  newInventory: unknown | null;
};

export async function claimInbox(
  remote: RemoteSave,
  ids: number[],
): Promise<ClaimResult> {
  await remote.flush();
  const r = await fetch("/api/marketplace/inbox/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(translateError(text, r.status));
  }
  return (await r.json()) as ClaimResult;
}

export type SendMessageResult = { ok: true; recipientName: string };

export async function sendUserMessage(
  recipientName: string,
  text: string,
): Promise<SendMessageResult> {
  const r = await fetch("/api/inbox/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipientName, text }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(translateError(body, r.status));
  }
  return (await r.json()) as SendMessageResult;
}

function translateError(text: string, status: number): string {
  switch (text) {
    case "slot_limit":
      return "동시 등록 슬롯 한도(10개)를 넘었습니다.";
    case "equipped":
      return "장착 중인 장비는 등록할 수 없습니다.";
    case "insufficient":
      return "인벤토리에 해당 수량이 없습니다.";
    case "insufficient_gold":
      return "골드가 부족합니다.";
    case "self_buy":
      return "본인이 등록한 매물은 구매할 수 없습니다.";
    case "no_character":
      return "캐릭터 데이터가 없습니다.";
    case "no_unclaimed":
      return "수령할 우편이 없습니다.";
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
    case "recipient_not_found":
      return "해당 닉네임의 유저를 찾을 수 없습니다.";
    case "self_send":
      return "자기 자신에게는 보낼 수 없습니다.";
    case "sender_no_name":
      return "닉네임을 먼저 설정해야 합니다.";
    case "empty text":
      return "내용을 입력하세요.";
    case "missing recipient":
      return "받는 사람을 입력하세요.";
    case "rate limited":
      return "조금 천천히 보내주세요.";
    case "daily_cap":
      return "오늘 발송 한도를 초과했습니다.";
    default:
      if (text.startsWith("too long")) return "내용이 너무 깁니다.";
      return `요청 실패 (${status}): ${text}`;
  }
}

// 거래소 클라이언트 타입. 서버 응답 shape 와 1:1.

export type ItemKind = "equip" | "material" | "recipe" | "skill_book";

export type Listing = {
  id: number;
  sellerId: string;
  sellerName: string;
  isMine: boolean;
  itemKind: ItemKind;
  itemId: string;
  itemName: string;
  // 등급 variant — equip 만 의미. 'base'|'c-2'|'c-1'|'c1'|'c2'|'d1'|'d2'.
  // vault variant 키와 동일 규약. (server: marketplace_listings.grade, default 'base')
  grade: string;
  quantity: number;
  price: number;
  createdAt: string;
};

export type ListResponse = {
  items: Listing[];
  nextCursor: string | null;
};

export type SortMode = "recent" | "price_asc" | "price_desc";

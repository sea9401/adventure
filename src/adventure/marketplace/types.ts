// 거래소 클라이언트 타입. 서버 응답 shape 와 1:1.

export type ItemKind = "equip" | "material";

export type Listing = {
  id: number;
  sellerId: string;
  sellerName: string;
  isMine: boolean;
  itemKind: ItemKind;
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  createdAt: string;
};

export type ListResponse = {
  items: Listing[];
  nextCursor: string | null;
};

export type SortMode = "recent" | "price_asc" | "price_desc";

"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ITEMS, type ItemId, type EquipItem } from "@/adventure/data/items";
import {
  MATERIALS,
  type MaterialId,
} from "@/adventure/data/materials";
import { RECIPES, type Recipe } from "@/adventure/data/recipes";
import type { InventoryState } from "@/adventure/inventory/useInventory";
import type { RemoteSave } from "@/lib/storage/remote";
import { createListing } from "./api";

// 서버 MARKETPLACE_FEE_RATE 와 동기화. 0 이면 수수료 표시 숨김.
const FEE_RATE = 0;
const PRICE_MAX = 999_999_999;

type Selection =
  | { kind: "equip"; itemId: ItemId; def: EquipItem; have: number }
  | {
      kind: "material";
      itemId: MaterialId;
      def: (typeof MATERIALS)[MaterialId];
      have: number;
    }
  | { kind: "recipe"; itemId: string; def: Recipe };

export function ListingCreateModal({
  inventory,
  shareableRecipes,
  remote,
  onClose,
  onSuccess,
  onLocalDeduct,
  showError,
}: {
  inventory: InventoryState;
  // 공유 토큰을 보유한 레시피만 등록 가능 — 이미 공유에 쓴 건 다시 습득해야 등록 가능.
  shareableRecipes: string[];
  remote: RemoteSave;
  onClose: () => void;
  onSuccess: () => void;
  onLocalDeduct: (selection: Selection, quantity: number) => void;
  showError: (msg: string) => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  // 입력 중 빈 값/임시 값을 허용하기 위해 string 으로 보관 — 검증은 submit 에서.
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  // inventory.equipment 는 미장착 사본만 카운트 — 동일 ID 가 슬롯에 장착돼 있어도
  // 인벤 스택은 별개라 거래 가능하다. 장착 여부 필터를 두지 않는 이유.
  const equipOptions = useMemo<Selection[]>(() => {
    const out: Selection[] = [];
    for (const [id, count] of Object.entries(inventory.equipment ?? {})) {
      if (!count) continue;
      const def = ITEMS[id as ItemId];
      if (!def) continue;
      if ("tradable" in def && def.tradable === false) continue;
      out.push({ kind: "equip", itemId: id as ItemId, def, have: count });
    }
    return out.sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [inventory.equipment]);

  const materialOptions = useMemo<Selection[]>(() => {
    const out: Selection[] = [];
    for (const [id, count] of Object.entries(inventory.materials ?? {})) {
      if (!count) continue;
      const def = MATERIALS[id as MaterialId];
      if (!def) continue;
      out.push({ kind: "material", itemId: id as MaterialId, def, have: count });
    }
    return out.sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [inventory.materials]);

  const recipeOptions = useMemo<Selection[]>(() => {
    const out: Selection[] = [];
    for (const r of RECIPES) {
      if (r.tradable === false) continue;
      if (!shareableRecipes.includes(r.id)) continue;
      out.push({ kind: "recipe", itemId: r.id, def: r });
    }
    return out.sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [shareableRecipes]);

  const noItems =
    equipOptions.length === 0 &&
    materialOptions.length === 0 &&
    recipeOptions.length === 0;

  const priceNum = Math.floor(Number(price)) || 0;
  const fee = Math.floor(priceNum * FEE_RATE);
  const sellerGets = Math.max(0, priceNum - fee);

  const submit = async () => {
    if (!selection) return;
    const priceN = Math.floor(Number(price));
    if (!Number.isInteger(priceN) || priceN < 1 || priceN > PRICE_MAX) {
      showError("가격은 1 이상의 정수여야 합니다.");
      return;
    }
    const qtyN =
      selection.kind === "material" ? Math.floor(Number(quantity)) : 1;
    if (
      selection.kind === "material" &&
      (!Number.isInteger(qtyN) || qtyN < 1 || qtyN > selection.have)
    ) {
      showError(`수량은 1~${selection.have} 사이여야 합니다.`);
      return;
    }
    setSubmitting(true);
    try {
      await createListing(remote, {
        itemKind: selection.kind,
        itemId: selection.itemId,
        quantity: qtyN,
        price: priceN,
      });
      onLocalDeduct(selection, qtyN);
      onSuccess();
    } catch (e) {
      showError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-create-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2
          id="listing-create-title"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
          매물 등록
        </h2>

        {noItems ? (
          <div className="mt-4 text-sm text-zinc-500">
            거래 가능한 아이템이 없습니다. (장착 중·시작 장비·재료 0개는 제외)
          </div>
        ) : !selection ? (
          <ItemPicker
            equipOptions={equipOptions}
            materialOptions={materialOptions}
            recipeOptions={recipeOptions}
            onPick={(s) => {
              setSelection(s);
              setQuantity("1");
              setPrice(
                s.kind === "material" ? String(Math.max(1, s.def.price)) : "1",
              );
            }}
          />
        ) : (
          <PriceForm
            selection={selection}
            quantity={quantity}
            price={price}
            onQuantity={setQuantity}
            onPrice={setPrice}
            fee={fee}
            sellerGets={sellerGets}
            onBack={() => setSelection(null)}
          />
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            닫기
          </button>
          {selection ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "등록 중…" : "등록"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ItemPicker({
  equipOptions,
  materialOptions,
  recipeOptions,
  onPick,
}: {
  equipOptions: Selection[];
  materialOptions: Selection[];
  recipeOptions: Selection[];
  onPick: (s: Selection) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      {equipOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-zinc-500">장비</h3>
          <ul className="mt-1 space-y-1">
            {equipOptions.map((o) => (
              <li key={`equip-${o.itemId}`}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                >
                  <span>{o.kind === "equip" || o.kind === "material" ? o.def.name : ""}</span>
                  <span className="text-xs text-zinc-500">
                    {o.kind === "equip" || o.kind === "material" ? `${o.have}개 보유` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {materialOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-zinc-500">재료</h3>
          <ul className="mt-1 space-y-1">
            {materialOptions.map((o) => (
              <li key={`material-${o.itemId}`}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                >
                  <span>{o.kind === "equip" || o.kind === "material" ? o.def.name : ""}</span>
                  <span className="text-xs text-zinc-500">
                    {o.kind === "equip" || o.kind === "material" ? `${o.have}개 보유` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recipeOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-zinc-500">제작서</h3>
          <ul className="mt-1 space-y-1">
            {recipeOptions.map((o) => (
              <li key={`recipe-${o.itemId}`}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                >
                  <span>📜 {o.def.name}</span>
                  <span className="text-xs text-zinc-500">제작서</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PriceForm({
  selection,
  quantity,
  price,
  onQuantity,
  onPrice,
  fee,
  sellerGets,
  onBack,
}: {
  selection: Selection;
  quantity: string;
  price: string;
  onQuantity: (s: string) => void;
  onPrice: (s: string) => void;
  fee: number;
  sellerGets: number;
  onBack: () => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {selection.kind === "recipe" ? "📜 " : ""}
            {selection.def.name}
          </span>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            다른 아이템 선택
          </button>
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {selection.kind === "equip"
            ? `장비 · 보유 ${selection.have}개`
            : selection.kind === "material"
              ? `재료 · 보유 ${selection.have}개`
              : "제작서 · 학습된 지식"}
        </div>
      </Card>

      {selection.kind === "material" ? (
        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            수량 (최대 {selection.have})
          </span>
          <input
            type="number"
            min={1}
            max={selection.have}
            value={quantity}
            onChange={(e) => onQuantity(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      ) : null}

      <label className="block">
        <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          가격 (전체 거래액, G)
        </span>
        <input
          type="number"
          min={1}
          max={PRICE_MAX}
          value={price}
          onChange={(e) => onPrice(e.target.value)}
          autoFocus={selection.kind !== "material"}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {fee > 0 ? (
        <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          성사 수수료 차감 후{" "}
          <strong>{sellerGets.toLocaleString()} G</strong> 수령 예정 (수수료{" "}
          {fee.toLocaleString()} G)
        </div>
      ) : null}
    </div>
  );
}

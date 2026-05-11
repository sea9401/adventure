"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../AdminContext";
import { Button, Field, NumberInput, TextInput } from "../ui/Field";
import {
  initialCharacterState,
  type CharacterDynamicState,
} from "@/adventure/character/useCharacterState";
import {
  maxHpForLevel,
  maxMpForLevel,
} from "@/adventure/character/defaults";
import { MAX_LEVEL, requiredExpToNext } from "@/lib/leveling";
import type { Profile } from "@/adventure/profile/useProfile";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import type { StatKey } from "@/adventure/data/stats";
import {
  emptyInventory,
  type InventoryState,
} from "@/adventure/inventory/useInventory";
import { ITEMS, type ItemId } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { POTIONS, type PotionId } from "@/adventure/data/potions";

type TrainingPersisted = {
  endsAt: number | null;
  points: number;
  allocated: Record<StatKey, number>;
  revertPoints: number;
  // 누적 훈련 완료 횟수 — 칭호 마일스톤 트리거 + 단련 포인트 정합성 진단용.
  // 기댓값: (level - 1) + completedCount = points + sum(allocated). 안 맞으면 어딘가 손실.
  completedCount?: number;
};

const emptyTraining = (): TrainingPersisted => ({
  endsAt: null,
  points: 0,
  allocated: { ...ZERO_ALLOCATED },
  revertPoints: 0,
  completedCount: 0,
});

type AdminUserRow = {
  id: string;
  email: string | null;
  gameName: string | null;
  className: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

type SavesMap = {
  "character-profile.v2"?: Profile;
  "character.v2"?: CharacterDynamicState;
  "training.v2"?: TrainingPersisted;
  "inventory.v2"?: InventoryState;
  [key: string]: unknown;
};

function formatLastSeen(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(iso).toLocaleString("ko-KR");
}

export function UsersTab() {
  const { readOnly, showToast } = useAdmin();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [saves, setSaves] = useState<SavesMap | null>(null);
  const [savesLoading, setSavesLoading] = useState(false);
  const [savesError, setSavesError] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const r = await fetch(
        `/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setUsers((await r.json()) as AdminUserRow[]);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "검색 실패");
      setUsers([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    // 초기 1회 — 비동기 fetch 후 setState 라 cascading render 가 아니지만
    // 린트는 호출 그래프만 보고 발화하므로 명시적으로 끈다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSearch("");
  }, [runSearch]);

  const loadSaves = useCallback(async (userId: string) => {
    setSavesLoading(true);
    setSavesError(null);
    setSaves(null);
    try {
      const r = await fetch(
        `/api/admin/saves?userId=${encodeURIComponent(userId)}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSaves((await r.json()) as SavesMap);
    } catch (e) {
      setSavesError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setSavesLoading(false);
    }
  }, []);

  const patchKey = async (userId: string, key: string, value: unknown) => {
    const r = await fetch(
      `/api/admin/saves?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  };

  const updateCharacter = async (next: CharacterDynamicState) => {
    if (!selected) return;
    try {
      await patchKey(selected.id, "character.v2", next);
      setSaves((s) => ({ ...(s ?? {}), "character.v2": next }));
      showToast("저장됨. 대상 유저는 새로고침해야 반영됩니다.");
    } catch (e) {
      showToast(`실패: ${e instanceof Error ? e.message : "오류"}`);
    }
  };

  const updateProfile = async (next: Profile) => {
    if (!selected) return;
    try {
      await patchKey(selected.id, "character-profile.v2", next);
      setSaves((s) => ({ ...(s ?? {}), "character-profile.v2": next }));
      showToast("저장됨.");
    } catch (e) {
      showToast(`실패: ${e instanceof Error ? e.message : "오류"}`);
    }
  };

  const updateTraining = async (next: TrainingPersisted) => {
    if (!selected) return;
    try {
      await patchKey(selected.id, "training.v2", next);
      setSaves((s) => ({ ...(s ?? {}), "training.v2": next }));
      showToast("훈련 데이터 저장됨. 대상 유저는 새로고침해야 반영됩니다.");
    } catch (e) {
      showToast(`실패: ${e instanceof Error ? e.message : "오류"}`);
    }
  };

  const updateInventory = async (next: InventoryState) => {
    if (!selected) return;
    try {
      await patchKey(selected.id, "inventory.v2", next);
      setSaves((s) => ({ ...(s ?? {}), "inventory.v2": next }));
      showToast("인벤토리 저장됨. 대상 유저는 새로고침해야 반영됩니다.");
    } catch (e) {
      showToast(`실패: ${e instanceof Error ? e.message : "오류"}`);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">유저 검색</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query.trim());
          }}
          className="mt-2 flex gap-2"
        >
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="이메일 또는 이름"
          />
          <Button type="submit" disabled={searchLoading}>
            검색
          </Button>
        </form>
        {searchError ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {searchError}
          </div>
        ) : null}
        <ul className="mt-3 max-h-[60vh] divide-y divide-zinc-200 overflow-y-auto rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {searchLoading && users.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">로딩…</li>
          ) : users.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">결과 없음</li>
          ) : (
            users.map((u) => {
              const isSelected = selected?.id === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(u);
                      void loadSaves(u.id);
                    }}
                    className={
                      "block w-full px-3 py-2 text-left text-xs " +
                      (isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60")
                    }
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {u.gameName ?? "(이름 없음)"}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      {u.email ?? u.id}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      마지막 접속 {formatLastSeen(u.lastSeenAt)}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="space-y-3">
        {!selected ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            왼쪽에서 유저를 선택하세요.
          </div>
        ) : (
          <SelectedUserPanel
            user={selected}
            saves={saves}
            loading={savesLoading}
            error={savesError}
            readOnly={readOnly}
            onUpdateProfile={updateProfile}
            onUpdateCharacter={updateCharacter}
            onUpdateTraining={updateTraining}
            onUpdateInventory={updateInventory}
            onReload={() => loadSaves(selected.id)}
          />
        )}
      </section>
    </div>
  );
}

function SelectedUserPanel({
  user,
  saves,
  loading,
  error,
  readOnly,
  onUpdateProfile,
  onUpdateCharacter,
  onUpdateTraining,
  onUpdateInventory,
  onReload,
}: {
  user: AdminUserRow;
  saves: SavesMap | null;
  loading: boolean;
  error: string | null;
  readOnly: boolean;
  onUpdateProfile: (next: Profile) => void;
  onUpdateCharacter: (next: CharacterDynamicState) => void;
  onUpdateTraining: (next: TrainingPersisted) => void;
  onUpdateInventory: (next: InventoryState) => void;
  onReload: () => void;
}) {
  const character = saves?.["character.v2"] ?? initialCharacterState;
  const profile = saves?.["character-profile.v2"] ?? {
    name: user.gameName ?? "모험가",
    gender: "male1" as const,
  };
  const training = saves?.["training.v2"] ?? emptyTraining();
  const inventory = saves?.["inventory.v2"] ?? emptyInventory();
  const requiredExp = requiredExpToNext(character.level) ?? 0;

  return (
    <>
      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{profile.name}</div>
            <div className="font-mono text-[11px] text-zinc-500">
              {user.email ?? "(이메일 없음)"}
            </div>
            <div className="font-mono text-[10px] text-zinc-400">{user.id}</div>
          </div>
          <Button onClick={onReload} disabled={loading}>
            새로고침
          </Button>
        </div>
        {error ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="mt-2 text-xs text-zinc-500">로딩…</div>
        ) : !saves ? null : !saves["character.v2"] ? (
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            ⚠️ 이 유저는 아직 캐릭터 데이터가 서버에 없습니다. 편집 시 새 행이
            생성됩니다.
          </div>
        ) : null}
      </div>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">프로필</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <Field label="이름">
            <TextInput
              value={profile.name}
              disabled={readOnly || loading}
              onChange={(name) => onUpdateProfile({ ...profile, name })}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">동적 상태</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Field label="HP" hint={`최대(레벨기준) ${maxHpForLevel(character.level)}`}>
            <NumberInput
              value={character.hp}
              min={0}
              disabled={readOnly || loading}
              onChange={(hp) => onUpdateCharacter({ ...character, hp })}
            />
          </Field>
          <Field label="MP" hint={`최대(레벨기준) ${maxMpForLevel(character.level)}`}>
            <NumberInput
              value={character.mp}
              min={0}
              disabled={readOnly || loading}
              onChange={(mp) => onUpdateCharacter({ ...character, mp })}
            />
          </Field>
          <Field label="레벨" hint={`만렙 ${MAX_LEVEL}`}>
            <NumberInput
              value={character.level}
              min={1}
              max={MAX_LEVEL}
              disabled={readOnly || loading}
              onChange={(level) =>
                onUpdateCharacter({
                  ...character,
                  level: Math.max(1, Math.min(MAX_LEVEL, level)),
                })
              }
            />
          </Field>
          <Field
            label="EXP"
            hint={requiredExp ? `다음 레벨까지 ${requiredExp}` : "만렙"}
          >
            <NumberInput
              value={character.exp}
              min={0}
              disabled={readOnly || loading}
              onChange={(exp) => onUpdateCharacter({ ...character, exp })}
            />
          </Field>
          <Field label="골드">
            <NumberInput
              value={character.gold}
              min={0}
              disabled={readOnly || loading}
              onChange={(gold) => onUpdateCharacter({ ...character, gold })}
            />
          </Field>
          <Field label="명성">
            <NumberInput
              value={character.fame}
              min={0}
              disabled={readOnly || loading}
              onChange={(fame) => onUpdateCharacter({ ...character, fame })}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={readOnly || loading}
            onClick={() =>
              onUpdateCharacter({
                ...character,
                hp: maxHpForLevel(character.level),
                mp: maxMpForLevel(character.level),
              })
            }
          >
            HP/MP 풀 회복
          </Button>
          <Button
            disabled={readOnly || loading}
            onClick={() =>
              onUpdateCharacter({
                ...character,
                gold: character.gold + 1000,
              })
            }
          >
            +1000 G
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">훈련</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <Field label="단련 포인트 (미사용)">
            <NumberInput
              value={training.points}
              min={0}
              disabled={readOnly || loading}
              onChange={(points) =>
                onUpdateTraining({
                  ...training,
                  points: Math.max(0, Math.floor(points)),
                })
              }
            />
          </Field>
          <Field label="되돌리기 포인트">
            <NumberInput
              value={training.revertPoints}
              min={0}
              disabled={readOnly || loading}
              onChange={(revertPoints) =>
                onUpdateTraining({
                  ...training,
                  revertPoints: Math.max(0, Math.floor(revertPoints)),
                })
              }
            />
          </Field>
          <Field label="누적 훈련 횟수">
            <NumberInput
              value={training.completedCount ?? 0}
              min={0}
              disabled={readOnly || loading}
              onChange={(completedCount) =>
                onUpdateTraining({
                  ...training,
                  completedCount: Math.max(0, Math.floor(completedCount)),
                })
              }
            />
          </Field>
          <Field label="기대 단련 포인트 (진단용)">
            <ExpectedPointsHint
              level={character.level}
              training={training}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={readOnly || loading}
            onClick={() =>
              onUpdateTraining({ ...training, points: training.points + 1 })
            }
          >
            +1 단련
          </Button>
          <Button
            disabled={readOnly || loading}
            onClick={() =>
              onUpdateTraining({ ...training, points: training.points + 5 })
            }
          >
            +5 단련
          </Button>
          <Button
            disabled={readOnly || loading}
            onClick={() =>
              onUpdateTraining({
                ...training,
                revertPoints: training.revertPoints + 1,
              })
            }
          >
            +1 되돌리기
          </Button>
          <Button
            disabled={readOnly || loading}
            onClick={() =>
              onUpdateTraining({
                ...training,
                revertPoints: training.revertPoints + 3,
              })
            }
          >
            +3 되돌리기
          </Button>
        </div>
      </section>

      <ItemGrantSection
        inventory={inventory}
        readOnly={readOnly || loading}
        onUpdateInventory={onUpdateInventory}
      />
    </>
  );
}

// 단련 포인트 손실/복구 진단용. 기대값: (level-1) 회의 레벨업 + completedCount 회의
// 훈련 완료 = 총 획득. 분배(allocated) 와 미사용(points) 의 합과 비교.
// 차이가 음수면 어딘가 손실 — 그 만큼 단련 포인트로 채워주면 복구.
function ExpectedPointsHint({
  level,
  training,
}: {
  level: number;
  training: TrainingPersisted;
}) {
  const earned = Math.max(0, level - 1) + (training.completedCount ?? 0);
  const allocated = Object.values(training.allocated).reduce((a, b) => a + b, 0);
  const held = training.points + allocated;
  const diff = earned - held;
  const tone =
    diff > 0
      ? "text-red-600 dark:text-red-400"
      : diff < 0
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-500";
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
      <span className="font-mono">
        {earned} = ({level} - 1) + {training.completedCount ?? 0}
      </span>
      <span className={`font-mono tabular-nums ${tone}`}>
        보유 {held} · 차이 {diff >= 0 ? `+${diff}` : diff}
      </span>
    </div>
  );
}

type GrantCategory = "potion" | "material" | "equipment";

const CATEGORY_LABEL: Record<GrantCategory, string> = {
  potion: "포션",
  material: "재료",
  equipment: "장비",
};

function ItemGrantSection({
  inventory,
  readOnly,
  onUpdateInventory,
}: {
  inventory: InventoryState;
  readOnly: boolean;
  onUpdateInventory: (next: InventoryState) => void;
}) {
  const [category, setCategory] = useState<GrantCategory>("material");
  const [itemId, setItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  const options = useMemo(() => {
    if (category === "potion") {
      return Object.values(POTIONS).map((p) => ({ id: p.id, name: p.name }));
    }
    if (category === "material") {
      return Object.values(MATERIALS).map((m) => ({ id: m.id, name: m.name }));
    }
    return Object.entries(ITEMS).map(([id, it]) => ({ id, name: it.name }));
  }, [category]);

  // 카테고리 변경 시 첫 항목으로 자동 선택. 외부 입력(category) 변화에 맞춰
  // 종속 state(itemId) 를 재정렬하는 동기화 패턴.
  useEffect(() => {
    if (options.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItemId("");
      return;
    }
    if (!options.some((o) => o.id === itemId)) {
      setItemId(options[0].id);
    }
  }, [options, itemId]);

  const currentCount = (() => {
    if (!itemId) return 0;
    if (category === "potion") {
      return inventory.potions[itemId as PotionId] ?? 0;
    }
    if (category === "material") {
      return inventory.materials[itemId as MaterialId] ?? 0;
    }
    return inventory.equipment[itemId as ItemId] ?? 0;
  })();

  const grant = () => {
    if (!itemId || quantity === 0) return;
    const next: InventoryState = {
      potions: { ...inventory.potions },
      equipment: { ...inventory.equipment },
      craftedEquipment: { ...inventory.craftedEquipment },
      materials: { ...inventory.materials },
      consumables: { ...inventory.consumables },
      potionCapacityBonus: inventory.potionCapacityBonus,
    };
    if (category === "potion") {
      const id = itemId as PotionId;
      next.potions[id] = Math.max(0, (next.potions[id] ?? 0) + quantity);
    } else if (category === "material") {
      const id = itemId as MaterialId;
      next.materials[id] = Math.max(0, (next.materials[id] ?? 0) + quantity);
    } else {
      const id = itemId as ItemId;
      next.equipment[id] = Math.max(0, (next.equipment[id] ?? 0) + quantity);
    }
    onUpdateInventory(next);
  };

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">아이템 지급</h2>
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        수량은 음수도 허용 — 회수 시 사용. 결과는 0 미만으로 떨어지지 않음.
      </p>
      <div className="mt-2 grid gap-3 md:grid-cols-[120px_1fr_120px]">
        <Field label="종류">
          <select
            value={category}
            disabled={readOnly}
            onChange={(e) => setCategory(e.target.value as GrantCategory)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {(Object.keys(CATEGORY_LABEL) as GrantCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="아이템"
          hint={itemId ? `현재 보유 ${currentCount}` : undefined}
        >
          <select
            value={itemId}
            disabled={readOnly}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.id})
              </option>
            ))}
          </select>
        </Field>
        <Field label="수량">
          <NumberInput
            value={quantity}
            disabled={readOnly}
            onChange={(n) => setQuantity(Math.floor(n))}
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={readOnly || !itemId || quantity === 0} onClick={grant}>
          {quantity > 0 ? `+${quantity} 지급` : `${quantity} 회수`}
        </Button>
        <Button
          disabled={readOnly || !itemId}
          onClick={() => setQuantity(1)}
        >
          1
        </Button>
        <Button
          disabled={readOnly || !itemId}
          onClick={() => setQuantity(10)}
        >
          10
        </Button>
        <Button
          disabled={readOnly || !itemId}
          onClick={() => setQuantity(100)}
        >
          100
        </Button>
      </div>
    </section>
  );
}

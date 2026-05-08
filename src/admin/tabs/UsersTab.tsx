"use client";

import { useCallback, useEffect, useState } from "react";
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

type AdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  className: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

type SavesMap = {
  "character-profile.v2"?: Profile;
  "character.v2"?: CharacterDynamicState;
  // 다른 동기화 키도 있지만 이 탭에서는 프로필/캐릭터만 편집.
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
                      {u.name ?? "(이름 없음)"}
                      {u.className ? (
                        <span className="ml-1 text-zinc-500">
                          [{u.className}]
                        </span>
                      ) : null}
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
  onReload,
}: {
  user: AdminUserRow;
  saves: SavesMap | null;
  loading: boolean;
  error: string | null;
  readOnly: boolean;
  onUpdateProfile: (next: Profile) => void;
  onUpdateCharacter: (next: CharacterDynamicState) => void;
  onReload: () => void;
}) {
  const character = saves?.["character.v2"] ?? initialCharacterState;
  const profile = saves?.["character-profile.v2"] ?? {
    name: user.name ?? "모험가",
    gender: "male1" as const,
  };
  const requiredExp = requiredExpToNext(character.level) ?? 0;

  return (
    <>
      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {profile.name}
              {user.className ? (
                <span className="ml-2 text-zinc-500">[{user.className}]</span>
              ) : null}
            </div>
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
    </>
  );
}

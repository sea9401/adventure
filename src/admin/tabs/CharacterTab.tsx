"use client";

import { useEffect, useState } from "react";
import {
  loadBundle,
  writeBundleKey,
  type SaveBundleData,
} from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import {
  Button,
  Field,
  NumberInput,
  Select,
  TextInput,
} from "../ui/Field";
import { ITEMS, type ItemId, type EquipSlot } from "@/adventure/data/items";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { MAX_LEVEL, requiredExpToNext } from "@/lib/leveling";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import { initialCharacterState } from "@/adventure/character/useCharacterState";

export function CharacterTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [data, setData] = useState<SaveBundleData | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(loadBundle().data);
  }, [bumpVersion]);

  if (!data) return <div className="text-sm">로딩 중…</div>;

  const profile = data.profile ?? { name: "모험가", gender: "male" as const };
  const character = data.character ?? initialCharacterState;
  const training = data.training ?? { endsAt: null, points: 0, allocated: {} };

  const allocated: Record<StatKey, number> = {
    ...ZERO_ALLOCATED,
    ...(training.allocated ?? {}),
  };

  const requiredExp = requiredExpToNext(character.level) ?? 0;

  const save = (next: Partial<SaveBundleData>) => {
    if (next.profile !== undefined) writeBundleKey("profile", next.profile);
    if (next.character !== undefined) writeBundleKey("character", next.character);
    if (next.training !== undefined) writeBundleKey("training", next.training);
    bump();
    showToast("저장됨. 게임은 새로고침해야 반영됩니다.");
  };

  const slotOptions = (slot: EquipSlot) => {
    const entries = (Object.entries(ITEMS) as [ItemId, (typeof ITEMS)[ItemId]][])
      .filter(([, def]) => def.slot === slot)
      .map(([id, def]) => ({ value: id as string, label: `${def.name} (${id})` }));
    return [{ value: "", label: "(비우기)" }, ...entries];
  };

  const findItemIdByName = (name: string | undefined): ItemId | "" => {
    if (!name) return "";
    const found = (Object.entries(ITEMS) as [ItemId, (typeof ITEMS)[ItemId]][])
      .find(([, def]) => def.name === name);
    return found ? found[0] : "";
  };

  const setSlot = (slot: EquipSlot, itemId: string) => {
    const equipped = character.equipped ?? {
      weapon: null,
      armor: null,
      accessory: null,
    };
    const item = itemId
      ? ITEMS[itemId as ItemId]
      : null;
    save({
      character: {
        ...character,
        equipped: { ...equipped, [slot]: item },
      },
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">프로필</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <Field label="이름">
            <TextInput
              value={profile.name}
              disabled={readOnly}
              onChange={(name) =>
                save({ profile: { ...profile, name } })
              }
            />
          </Field>
          <Field label="성별">
            <Select<"male" | "female">
              value={profile.gender}
              disabled={readOnly}
              options={[
                { value: "male", label: "남" },
                { value: "female", label: "여" },
              ]}
              onChange={(gender) => save({ profile: { ...profile, gender } })}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">동적 상태</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Field label="HP">
            <NumberInput
              value={character.hp}
              min={0}
              disabled={readOnly}
              onChange={(hp) => save({ character: { ...character, hp } })}
            />
          </Field>
          <Field label="MP">
            <NumberInput
              value={character.mp}
              min={0}
              disabled={readOnly}
              onChange={(mp) => save({ character: { ...character, mp } })}
            />
          </Field>
          <Field label="레벨" hint={`만렙 ${MAX_LEVEL}`}>
            <NumberInput
              value={character.level}
              min={1}
              max={MAX_LEVEL}
              disabled={readOnly}
              onChange={(level) =>
                save({
                  character: {
                    ...character,
                    level: Math.max(1, Math.min(MAX_LEVEL, level)),
                  },
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
              disabled={readOnly}
              onChange={(exp) => save({ character: { ...character, exp } })}
            />
          </Field>
          <Field label="골드">
            <NumberInput
              value={character.gold}
              min={0}
              disabled={readOnly}
              onChange={(gold) => save({ character: { ...character, gold } })}
            />
          </Field>
          <Field label="명성">
            <NumberInput
              value={character.fame}
              min={0}
              disabled={readOnly}
              onChange={(fame) => save({ character: { ...character, fame } })}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={readOnly}
            onClick={() =>
              save({ character: { ...character, hp: 9999, mp: 9999 } })
            }
          >
            HP/MP 풀 회복(9999)
          </Button>
          <Button
            disabled={readOnly}
            onClick={() => save({ character: { ...character, gold: character.gold + 1000 } })}
          >
            +1000 G
          </Button>
          <Button
            disabled={readOnly}
            onClick={() => save({ character: { ...character, exp: 0, level: 1 } })}
          >
            레벨/EXP 초기화
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">훈련</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Field label="훈련 종료 시각 (epoch ms)" hint={training.endsAt ? new Date(training.endsAt).toLocaleString() : "비활성"}>
            <NumberInput
              value={training.endsAt ?? 0}
              min={0}
              disabled={readOnly}
              onChange={(endsAt) =>
                save({
                  training: {
                    ...training,
                    endsAt: endsAt > 0 ? endsAt : null,
                  },
                })
              }
            />
          </Field>
          <Field label="남은 단련 포인트">
            <NumberInput
              value={training.points ?? 0}
              min={0}
              disabled={readOnly}
              onChange={(points) => save({ training: { ...training, points } })}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button
              disabled={readOnly}
              onClick={() => save({ training: { ...training, endsAt: null } })}
            >
              훈련 즉시 종료
            </Button>
            <Button
              disabled={readOnly}
              onClick={() =>
                save({
                  training: {
                    ...training,
                    points: (training.points ?? 0) + 1,
                  },
                })
              }
            >
              +1 포인트
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            누적 분배 (allocated)
          </h3>
          <div className="mt-2 grid gap-2 md:grid-cols-5">
            {STAT_KEYS.map((k) => (
              <Field key={k} label={k}>
                <NumberInput
                  value={allocated[k]}
                  min={0}
                  disabled={readOnly}
                  onChange={(v) =>
                    save({
                      training: {
                        ...training,
                        allocated: { ...allocated, [k]: v },
                      },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">장착 (직접 부여)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          인벤토리는 변경하지 않음 — 장비를 회수하려면 인벤토리 탭에서 별도로 추가하세요.
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {(["weapon", "armor", "accessory"] as EquipSlot[]).map((slot) => (
            <Field key={slot} label={slot}>
              <Select
                value={findItemIdByName(character.equipped?.[slot]?.name)}
                disabled={readOnly}
                options={slotOptions(slot)}
                onChange={(v) => setSlot(slot, v)}
              />
            </Field>
          ))}
        </div>
      </section>
    </div>
  );
}

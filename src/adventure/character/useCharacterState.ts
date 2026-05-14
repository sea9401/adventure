import { useState } from "react";
import { applyExpGain, MAX_LEVEL } from "@/lib/leveling";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import { baseCharacter, maxHpForLevel, maxMpForLevel } from "./defaults";
import { rehydrateEquippedItem } from "./rehydrateEquip";
import type { EquippedItem, EquippedSlots } from "./types";

export type CharacterDynamicState = {
  hp: number;
  mp: number;
  level: number;
  exp: number;
  gold: number;
  fame: number;
  /** 길드 시스템에서 자동 갱신. 미가입 시 "무소속". */
  affiliation?: string;
  equipped?: EquippedSlots;
  /** 장착 중인 칭호 ID. null/미지정 = 미장착. */
  equippedTitleId?: string | null;
  /** 장착 중인 일반 스킬 이름 목록 (최대 skillLayout().normalSlots). undefined = 자동 (보유 첫 N개). */
  equippedSkills?: string[];
  /** 장착 중인 특기 이름들 — 슬롯 인덱스 0..featSlots-1. null = 그 슬롯 미장착. undefined/[] = 모두 미장착. */
  equippedFeats?: (string | null)[];
  /**
   * region 단위 일일 보스 입장 카운터.
   * date 는 클라이언트 로컬 'YYYY-MM-DD'. 다른 날짜로 보면 0 부터 새로 카운트.
   */
  bossAttempts?: Partial<Record<string, { date: string; count: number }>>;
};

// 클라이언트 로컬 자정 기준 'YYYY-MM-DD' (sv-SE 가 ISO-like 안전한 포맷).
function todayLocalDateKey(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export const initialCharacterState: CharacterDynamicState = {
  hp: 97,
  mp: 30,
  level: 1,
  exp: 0,
  gold: 50,
  fame: 0,
  equippedTitleId: null,
};

// 저장된 EquipItem 슬롯 매핑을 "지금" 데이터 정의로 다시 만들어 옛 인스턴스가 남지 않게.
// 실제 변환은 rehydrateEquippedItem 공용 헬퍼 — 서버측 autoHunt/derivePlayerCombatFromSaves
// 도 동일 헬퍼를 써야 craftTier/dropQuality 가 일관되게 반영된다.
function rehydrateEquipped(
  saved: CharacterDynamicState["equipped"],
): CharacterDynamicState["equipped"] {
  if (!saved) return undefined;
  return {
    weapon: rehydrateEquippedItem(saved.weapon),
    armor: rehydrateEquippedItem(saved.armor),
    accessory: rehydrateEquippedItem(saved.accessory),
  };
}

function readInitial(raw: unknown): CharacterDynamicState {
  if (!raw || typeof raw !== "object") return initialCharacterState;
  const parsed = raw as Partial<CharacterDynamicState> & {
    /** 레거시 — 단일 특기 슬롯 시절 저장 필드. 읽기 호환만 유지하고 즉시 배열로 정규화. */
    equippedFeat?: string;
  };
  // 레거시 equippedFeat (단일 string) → equippedFeats 배열 마이그레이션.
  let feats: (string | null)[] | undefined = parsed.equippedFeats;
  if (!feats && parsed.equippedFeat) {
    feats = [parsed.equippedFeat];
  }
  return {
    hp: parsed.hp ?? initialCharacterState.hp,
    mp: parsed.mp ?? initialCharacterState.mp,
    level: Math.min(
      MAX_LEVEL,
      Math.max(1, parsed.level ?? initialCharacterState.level),
    ),
    exp: parsed.exp ?? initialCharacterState.exp,
    gold: parsed.gold ?? initialCharacterState.gold,
    fame: parsed.fame ?? initialCharacterState.fame,
    affiliation: parsed.affiliation,
    equipped: rehydrateEquipped(parsed.equipped),
    equippedTitleId: parsed.equippedTitleId ?? null,
    equippedSkills: parsed.equippedSkills,
    equippedFeats: feats,
    bossAttempts: parsed.bossAttempts,
  };
}

export function useCharacterState() {
  const initial = useSavedValue("character.v2");
  const [state, setState] = useState<CharacterDynamicState>(() =>
    readInitial(initial),
  );
  useRemotePatch("character.v2", state);

  const equippedSlots = state.equipped ?? baseCharacter.equipped;

  // maxHp/maxMp는 호출 측이 스탯(VIT 등) 보정을 합쳐 넘겨주면 그 값으로 회복.
  // 미지정이면 레벨 기준만 사용 (스탯 보정 없는 레거시 동작).
  const heal = (cost = 0, maxHp?: number, maxMp?: number) =>
    setState((prev) => ({
      ...prev,
      gold: Math.max(0, prev.gold - cost),
      hp: maxHp ?? maxHpForLevel(prev.level),
      mp: maxMp ?? maxMpForLevel(prev.level),
    }));

  const restoreHpFull = (maxHp?: number) =>
    setState((prev) => ({ ...prev, hp: maxHp ?? maxHpForLevel(prev.level) }));

  const setHp = (hp: number) => setState((prev) => ({ ...prev, hp }));

  const addGoldFame = (gold: number, fame: number) =>
    setState((prev) => ({
      ...prev,
      gold: prev.gold + gold,
      fame: prev.fame + fame,
    }));

  const addGold = (delta: number) =>
    setState((prev) => ({ ...prev, gold: prev.gold + delta }));

  // vitHpBonus: 레벨업 풀회복 시 VIT(스탯+장비) 보너스만큼 maxHp에 더해 회복.
  // 기본 0 — 호출 측에서 안 넘기면 레벨 기준 max 까지만 회복 (퀘스트 보상 등).
  const addExp = (n: number, vitHpBonus = 0) =>
    setState((prev) => {
      const next = applyExpGain(prev.level, prev.exp, n);
      // 레벨업 시 HP/MP 를 새 max 로 풀회복 — 보상감 + max 증가만 했을 때 발생하는
      // "현재값이 max 보다 낮은 채 정체" 문제 회피.
      if (next.levelsGained > 0) {
        return {
          ...prev,
          level: next.level,
          exp: next.exp,
          hp: maxHpForLevel(next.level) + vitHpBonus,
          mp: maxMpForLevel(next.level),
        };
      }
      return { ...prev, level: next.level, exp: next.exp };
    });

  const setSlot = (slot: keyof EquippedSlots, item: EquippedItem | null) =>
    setState((prev) => {
      const current = prev.equipped ?? baseCharacter.equipped;
      return { ...prev, equipped: { ...current, [slot]: item } };
    });

  const setEquippedTitle = (titleId: string | null) =>
    setState((prev) => ({ ...prev, equippedTitleId: titleId }));

  const setEquippedSkills = (names: string[]) =>
    setState((prev) => ({ ...prev, equippedSkills: names }));

  // 슬롯 인덱스 별로 특기 장착/해제. UI 가 슬롯 번호와 함께 호출.
  // 결과 배열 길이는 항상 max(prev.length, index+1) — null 패딩으로 슬롯 자리 유지.
  const setEquippedFeatAt = (slotIndex: number, name: string | null) =>
    setState((prev) => {
      const next = (prev.equippedFeats ?? []).slice();
      while (next.length <= slotIndex) next.push(null);
      next[slotIndex] = name ?? null;
      return { ...prev, equippedFeats: next };
    });

  // 길드 가입/탈퇴/해체/위임 시 호출. 서버는 이미 character.v2 에 affiliation 을
  // 반영했지만 클라이언트의 in-memory state 도 같이 끌어줘야 AdventurerCard 등이
  // 즉시 새 값을 표시.
  const setAffiliation = (affiliation: string) =>
    setState((prev) => ({ ...prev, affiliation }));

  // 서버 권위 액션(상점 등)의 응답으로 받은 character.v2 값으로 통째 교체.
  // readInitial 로 정규화 (level 클램프 / equipped rehydrate). 이후 useRemotePatch 가
  // 동일 값을 다시 PATCH 하지만 서버 version 과 409 재시도로 자가 수렴.
  const replaceFromSaved = (raw: unknown) => setState(readInitial(raw));

  // 오늘 기준 region 의 보스 입장 카운터. 다른 날짜 데이터는 0 으로 처리.
  const getBossAttemptsToday = (regionId: string): number => {
    const entry = state.bossAttempts?.[regionId];
    if (!entry || entry.date !== todayLocalDateKey()) return 0;
    return entry.count;
  };

  // 입장 1회 소비 — 날짜가 바뀌었으면 0 부터 1 로 리셋. 호출자가 한도 검사를 했다고 가정.
  const consumeBossAttempt = (regionId: string) => {
    const today = todayLocalDateKey();
    setState((prev) => {
      const cur = prev.bossAttempts?.[regionId];
      const nextCount = cur && cur.date === today ? cur.count + 1 : 1;
      return {
        ...prev,
        bossAttempts: {
          ...(prev.bossAttempts ?? {}),
          [regionId]: { date: today, count: nextCount },
        },
      };
    });
  };

  return {
    state,
    hydrated: true,
    equippedSlots,
    equippedTitleId: state.equippedTitleId ?? null,
    heal,
    restoreHpFull,
    setHp,
    addGold,
    addGoldFame,
    addExp,
    setSlot,
    setEquippedTitle,
    setEquippedSkills,
    setEquippedFeatAt,
    setAffiliation,
    replaceFromSaved,
    getBossAttemptsToday,
    consumeBossAttempt,
  };
}

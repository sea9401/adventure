import { useState } from "react";
import { AVATARS, type Avatar, type Gender } from "@/components/NameSetupModal";
import { useSavedValue } from "@/lib/storage/SaveProvider";

export const DEFAULT_NAME = "모험가";
export const DEFAULT_AVATAR: Avatar = "male1";

export type Profile = { name: string; gender: Avatar };

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "taken" | "invalid" | "network" };

// 저장된 gender 값을 정규화. 구버전("male"/"female")은 male1/female1 으로 마이그레이션.
function normalizeAvatar(raw: unknown): Avatar | null {
  if (typeof raw !== "string") return null;
  if (AVATARS.includes(raw as Avatar)) return raw as Avatar;
  if (raw === "male") return "male1";
  if (raw === "female") return "female1";
  return null;
}

function readInitial(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { name?: unknown; gender?: unknown };
  const normalized = normalizeAvatar(obj.gender);
  if (typeof obj.name === "string" && obj.name.length > 0 && normalized) {
    return { name: obj.name, gender: normalized };
  }
  return null;
}

export function useProfile() {
  const initial = useSavedValue("character-profile.v2");
  const [profile, setProfile] = useState<Profile | null>(() =>
    readInitial(initial),
  );

  // 서버 /api/profile/setup 호출 — 중복 닉네임 검증·users.name 등록·savesKv 갱신.
  // 성공 시 로컬 state 도 갱신.
  const submit = async (next: Profile): Promise<SubmitResult> => {
    let res: Response;
    try {
      res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      return { ok: false, reason: "network" };
    }
    if (res.status === 409) return { ok: false, reason: "taken" };
    if (res.status === 400) return { ok: false, reason: "invalid" };
    if (!res.ok) return { ok: false, reason: "network" };
    setProfile(next);
    return { ok: true };
  };

  const name = profile?.name ?? DEFAULT_NAME;
  const gender: Gender = profile?.gender ?? DEFAULT_AVATAR;
  // SaveProvider 가 children 마운트 전에 hydrate 를 끝내므로 needsSetup 은 단순.
  const needsSetup = !profile;

  return { profile, name, gender, hydrated: true, needsSetup, submit };
}

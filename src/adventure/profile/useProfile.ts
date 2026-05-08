import { useState } from "react";
import { AVATARS, type Avatar, type Gender } from "@/components/NameSetupModal";
import { useRemoteSave, useSavedValue } from "@/lib/storage/SaveProvider";

export const DEFAULT_NAME = "모험가";
export const DEFAULT_AVATAR: Avatar = "male1";

export type Profile = { name: string; gender: Avatar };

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
  const remote = useRemoteSave();
  const [profile, setProfile] = useState<Profile | null>(() =>
    readInitial(initial),
  );

  const submit = (next: Profile) => {
    setProfile(next);
    remote.patch("character-profile.v2", next);
  };

  const name = profile?.name ?? DEFAULT_NAME;
  const gender: Gender = profile?.gender ?? DEFAULT_AVATAR;
  // SaveProvider 가 children 마운트 전에 hydrate 를 끝내므로 needsSetup 은 단순.
  const needsSetup = !profile;

  return { profile, name, gender, hydrated: true, needsSetup, submit };
}

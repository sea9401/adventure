import { useEffect, useState } from "react";
import {
  PROFILE_STORAGE_KEY,
  LEGACY_PROFILE_KEYS,
} from "@/lib/storage-keys";
import { AVATARS, type Avatar, type Gender } from "@/components/NameSetupModal";

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

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      // 신규 키가 비어 있으면 옛 키(`characterProfile.v1` 등)에서 한 번 옮겨온 뒤 정리.
      let raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) {
        for (const key of LEGACY_PROFILE_KEYS) {
          const legacy = localStorage.getItem(key);
          if (legacy) {
            raw = legacy;
            localStorage.setItem(PROFILE_STORAGE_KEY, legacy);
            break;
          }
        }
      }
      for (const key of LEGACY_PROFILE_KEYS) localStorage.removeItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          name: string;
          gender: unknown;
        }>;
        const normalized = normalizeAvatar(parsed?.gender);
        if (parsed?.name && normalized) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProfile({ name: parsed.name, gender: normalized });
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  const submit = (next: Profile) => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    setProfile(next);
  };

  const name = profile?.name ?? DEFAULT_NAME;
  const gender: Gender = profile?.gender ?? DEFAULT_AVATAR;
  const needsSetup = hydrated && !profile;

  return { profile, name, gender, hydrated, needsSetup, submit };
}

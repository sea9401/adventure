import { useEffect, useState } from "react";
import {
  PROFILE_STORAGE_KEY,
  LEGACY_PROFILE_KEYS,
} from "@/lib/storage-keys";
import type { Gender } from "@/components/NameSetupModal";

export const DEFAULT_NAME = "모험가";

export type Profile = { name: string; gender: Gender };

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
        const parsed = JSON.parse(raw) as Partial<Profile>;
        if (
          parsed?.name &&
          (parsed.gender === "male" || parsed.gender === "female")
        ) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProfile({ name: parsed.name, gender: parsed.gender });
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
  const gender: Gender = profile?.gender ?? "male";
  const needsSetup = hydrated && !profile;

  return { profile, name, gender, hydrated, needsSetup, submit };
}

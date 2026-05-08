"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminContextValue = {
  readOnly: boolean;
  setReadOnly: (next: boolean) => void;
  // 어드민에서 localStorage 변경이 일어났음을 다른 탭/컴포넌트에 알리는 카운터.
  // 각 탭은 이 값을 의존해 데이터를 다시 load 한다.
  bumpVersion: number;
  bump: () => void;
  toast: string | null;
  showToast: (text: string) => void;
};

const Ctx = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [readOnly, setReadOnly] = useState(true);
  const [bumpVersion, setBumpVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const bump = useCallback(() => {
    setBumpVersion((v) => v + 1);
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const value = useMemo(
    () => ({ readOnly, setReadOnly, bumpVersion, bump, toast, showToast }),
    [readOnly, bumpVersion, bump, toast, showToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin must be used inside <AdminProvider>");
  return v;
}

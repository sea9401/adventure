"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Gear,
  Moon,
  Question,
  Sun,
  SignOut,
  User,
  UserMinus,
} from "@phosphor-icons/react";
import { signIn, signOut } from "next-auth/react";
import { HelpModal } from "./HelpModal";
import { NotificationPrefsModal } from "./NotificationPrefsModal";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { AvatarChangeModal } from "./AvatarChangeModal";

export function SettingsMenu({ gameName }: { gameName: string | null }) {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifPrefsOpen, setNotifPrefsOpen] = useState(false);
  const [avatarChangeOpen, setAvatarChangeOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [linkedProviders, setLinkedProviders] = useState<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const initial = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/linked-accounts")
      .then((r) => (r.ok ? r.json() : { providers: [] }))
      .then((data: { providers: string[] }) =>
        setLinkedProviders(data.providers),
      )
      .catch(() => setLinkedProviders([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  const handleSignOut = () => {
    setOpen(false);
    signOut({ redirectTo: "/sign-in" });
  };

  const handleLink = async (provider: string) => {
    setOpen(false);
    await fetch("/api/auth/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    signIn(provider, { callbackUrl: "/" });
  };

  const handleOpenHelp = () => {
    setOpen(false);
    setHelpOpen(true);
  };

  const handleOpenNotifPrefs = () => {
    setOpen(false);
    setNotifPrefsOpen(true);
  };

  const handleOpenAvatarChange = () => {
    setOpen(false);
    setAvatarChangeOpen(true);
  };

  const handleOpenDeleteAccount = () => {
    setOpen(false);
    setDeleteAccountOpen(true);
  };

  const isDark = theme === "dark";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="설정"
        title="설정"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Gear size={20} weight="duotone" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(12rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            설정
          </div>
          <ul className="py-1">
            <li>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {isDark ? (
                  <Sun size={18} weight="duotone" />
                ) : (
                  <Moon size={18} weight="duotone" />
                )}
                {isDark ? "라이트 모드" : "다크 모드"}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={handleOpenAvatarChange}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <User size={18} weight="duotone" />
                프로필 이미지 변경
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={handleOpenNotifPrefs}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Bell size={18} weight="duotone" />
                알림 설정
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={handleOpenHelp}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Question size={18} weight="duotone" />
                도움말
              </button>
            </li>
          </ul>
          <div className="border-t border-zinc-200 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            계정 연동
          </div>
          <ul className="py-1">
            {(["google", "kakao"] as const).map((provider) => {
              const linked = linkedProviders?.includes(provider);
              const label = provider === "google" ? "Google" : "카카오";
              return (
                <li key={provider}>
                  {linked ? (
                    <span className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-400 dark:text-zinc-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {label} 연동됨
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLink(provider)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <span className="h-2 w-2 rounded-full bg-zinc-400" />
                      {label} 연동하기
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <ul className="border-t border-zinc-200 py-1 dark:border-zinc-800">
            <li>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <SignOut size={18} weight="duotone" />
                로그아웃
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={handleOpenDeleteAccount}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-400"
              >
                <UserMinus size={14} weight="duotone" />
                회원 탈퇴
              </button>
            </li>
          </ul>
        </div>
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {notifPrefsOpen && (
        <NotificationPrefsModal onClose={() => setNotifPrefsOpen(false)} />
      )}
      {avatarChangeOpen && (
        <AvatarChangeModal onClose={() => setAvatarChangeOpen(false)} />
      )}
      {deleteAccountOpen && (
        <DeleteAccountModal
          gameName={gameName}
          onClose={() => setDeleteAccountOpen(false)}
        />
      )}
    </div>
  );
}

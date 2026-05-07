"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const initial = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "라이트 모드로" : "다크 모드로"}
      title={isDark ? "라이트 모드로" : "다크 모드로"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  Barbell,
  BookOpen,
  CaretDown,
  CaretRight,
  Coins,
  Compass,
  Crosshair,
  Crown,
  Diamond,
  Drop,
  Flame,
  GameController,
  Heart,
  House,
  Lightning,
  MapPin,
  Moon,
  Mountains,
  Pause,
  Play,
  Scroll,
  Shield,
  ShieldCheck,
  Skull,
  Snowflake,
  Sparkle,
  Star,
  Sun,
  Sword,
  TShirt,
  Tree,
  Trophy,
  User,
  Users,
  type Icon,
} from "@phosphor-icons/react";

const WEIGHTS = ["thin", "light", "regular", "bold", "fill", "duotone"] as const;
type Weight = (typeof WEIGHTS)[number];

type IconEntry = { name: string; Component: Icon };

const sections: { title: string; icons: IconEntry[] }[] = [
  {
    title: "전투/장비",
    icons: [
      { name: "Sword", Component: Sword },
      { name: "Shield", Component: Shield },
      { name: "ShieldCheck", Component: ShieldCheck },
      { name: "Crosshair", Component: Crosshair },
      { name: "Lightning", Component: Lightning },
      { name: "Flame", Component: Flame },
      { name: "Snowflake", Component: Snowflake },
      { name: "Backpack", Component: Backpack },
      { name: "TShirt", Component: TShirt },
      { name: "Skull", Component: Skull },
    ],
  },
  {
    title: "캐릭터/스탯",
    icons: [
      { name: "User", Component: User },
      { name: "Users", Component: Users },
      { name: "Heart", Component: Heart },
      { name: "Drop", Component: Drop },
      { name: "Coins", Component: Coins },
      { name: "Barbell", Component: Barbell },
      { name: "Star", Component: Star },
      { name: "Crown", Component: Crown },
      { name: "Sparkle", Component: Sparkle },
      { name: "Trophy", Component: Trophy },
      { name: "Diamond", Component: Diamond },
    ],
  },
  {
    title: "장소/지도",
    icons: [
      { name: "House", Component: House },
      { name: "Tree", Component: Tree },
      { name: "Mountains", Component: Mountains },
      { name: "Compass", Component: Compass },
      { name: "MapPin", Component: MapPin },
      { name: "Moon", Component: Moon },
      { name: "Sun", Component: Sun },
    ],
  },
  {
    title: "UI/액션",
    icons: [
      { name: "Play", Component: Play },
      { name: "Pause", Component: Pause },
      { name: "ArrowLeft", Component: ArrowLeft },
      { name: "ArrowRight", Component: ArrowRight },
      { name: "CaretDown", Component: CaretDown },
      { name: "CaretRight", Component: CaretRight },
      { name: "Scroll", Component: Scroll },
      { name: "BookOpen", Component: BookOpen },
      { name: "GameController", Component: GameController },
    ],
  },
];

export default function IconsPage() {
  const [weight, setWeight] = useState<Weight>("regular");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Phosphor 아이콘 갤러리</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          weight를 바꿔가며 비교해 보세요. 적용은 따로 말씀해 주시면 코드에 반영합니다.
          (전체 검색은{" "}
          <a
            href="https://phosphoricons.com/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            phosphoricons.com
          </a>
          )
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {WEIGHTS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWeight(w)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              weight === w
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {section.title}
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {section.icons.map(({ name, Component }) => (
              <div
                key={name}
                className="flex flex-col items-center gap-1.5 rounded-md border border-zinc-200 bg-white/40 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <Component size={32} weight={weight} />
                <span className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";

type CardPadding = "none" | "sm" | "md" | "lg";

const PAD: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const SURFACE =
  "rounded-lg border border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90";

type CardOwnProps = {
  padding?: CardPadding;
  className?: string;
  children?: ReactNode;
};

export type CardProps<T extends ElementType = "div"> = CardOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps | "as">;

export function Card<T extends ElementType = "div">({
  as,
  padding = "sm",
  className,
  children,
  ...rest
}: CardProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  const cls = [SURFACE, PAD[padding], className].filter(Boolean).join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}

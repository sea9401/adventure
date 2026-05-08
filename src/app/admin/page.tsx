import { notFound } from "next/navigation";
import { AdminShell } from "@/admin/AdminShell";
import { isCurrentUserAdmin } from "@/lib/server/isAdmin";

export const metadata = {
  title: "관리자 도구 — 무슨무슨게임",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isCurrentUserAdmin())) notFound();
  return <AdminShell />;
}

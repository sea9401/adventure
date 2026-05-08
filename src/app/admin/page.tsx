import { AdminShell } from "@/admin/AdminShell";

export const metadata = {
  title: "관리자 도구 — 무슨무슨게임",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminShell />;
}

import { redirect } from "next/navigation";
import { DEFAULT_MANUAL_SLUG } from "./sections";

// /manual → 첫 섹션으로 리다이렉트. 사이드바 / select 의 진입점을 단일화한다.
export default function Page() {
  redirect(`/manual/${DEFAULT_MANUAL_SLUG}`);
}

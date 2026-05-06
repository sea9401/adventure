// 글로벌 키보드 단축키. input/textarea 포커스 시 비활성, 수정자 키 조합 시 비활성.

export type KeyHandler = {
  key: string;
  action: () => void;
  description: string;
};

export function attachShortcuts(handlers: KeyHandler[]): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable
    ) {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const handler = handlers.find((h) => h.key === e.key);
    if (handler) {
      e.preventDefault();
      handler.action();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}

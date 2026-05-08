import { describe, it, expect, vi } from "vitest";
import { createRemoteSave } from "./remote";

type Recorded = {
  url: string;
  method: string;
  body: unknown;
};

function makeFakeFetch(opts: {
  patchStatuses?: number[];
  loadResponse?: unknown;
}) {
  const recorded: Recorded[] = [];
  let patchCallIndex = 0;
  const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
    recorded.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    if (init?.method === "PATCH") {
      const status =
        opts.patchStatuses?.[patchCallIndex++] ?? 200;
      return new Response(JSON.stringify({ ok: true }), { status });
    }
    return new Response(JSON.stringify(opts.loadResponse ?? {}), {
      status: 200,
    });
  });
  return { fakeFetch, recorded };
}

describe("createRemoteSave", () => {
  it("디바운스 — 같은 키 연속 patch 는 한 번만 보내고 최신값", async () => {
    vi.useFakeTimers();
    const { fakeFetch, recorded } = makeFakeFetch({});
    const remote = createRemoteSave({
      flushDelayMs: 100,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    remote.patch("character.v2", { hp: 50 });
    remote.patch("character.v2", { hp: 48 });
    remote.patch("character.v2", { hp: 45 });

    expect(recorded).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].method).toBe("PATCH");
    expect(recorded[0].url).toContain("key=character.v2");
    expect(recorded[0].body).toEqual({ value: { hp: 45 } });

    vi.useRealTimers();
  });

  it("서로 다른 키는 한 사이클에 모두 전송", async () => {
    vi.useFakeTimers();
    const { fakeFetch, recorded } = makeFakeFetch({});
    const remote = createRemoteSave({
      flushDelayMs: 100,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    remote.patch("character.v2", { hp: 50 });
    remote.patch("inventory.v2", { potions: {} });
    await vi.advanceTimersByTimeAsync(100);

    expect(recorded).toHaveLength(2);
    const keys = recorded.map((r) => new URL(r.url, "http://x").searchParams.get("key"));
    expect(keys).toContain("character.v2");
    expect(keys).toContain("inventory.v2");

    vi.useRealTimers();
  });

  it("실패 시 backoff 재시도", async () => {
    vi.useFakeTimers();
    const { fakeFetch } = makeFakeFetch({ patchStatuses: [500, 200] });
    const remote = createRemoteSave({
      flushDelayMs: 100,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    remote.patch("character.v2", { hp: 50 });
    await vi.advanceTimersByTimeAsync(100);
    expect(remote.status().kind).toBe("error");

    // 1s backoff 후 재시도 → 성공.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(remote.status().kind).toBe("idle");
    expect(fakeFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("401 수신 시 session-expired 로 전환 + 큐 보존", async () => {
    vi.useFakeTimers();
    const { fakeFetch } = makeFakeFetch({ patchStatuses: [401] });
    const remote = createRemoteSave({
      flushDelayMs: 100,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    remote.patch("character.v2", { hp: 50 });
    await vi.advanceTimersByTimeAsync(100);

    expect(remote.status().kind).toBe("session-expired");
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("loadAll — 알 수 없는 키 필터링", async () => {
    const { fakeFetch } = makeFakeFetch({
      loadResponse: {
        "character.v2": { hp: 50 },
        "unknown.v2": "ignored",
      },
    });
    const remote = createRemoteSave({
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    const data = await remote.loadAll();
    expect(data).toEqual({ "character.v2": { hp: 50 } });
  });
});

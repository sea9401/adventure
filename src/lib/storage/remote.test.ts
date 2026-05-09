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
      const status = opts.patchStatuses?.[patchCallIndex++] ?? 200;
      // 200 응답에는 새 version 동봉 — createRemoteSave 가 내부 추적에 사용.
      const body =
        status === 200
          ? { ok: true, version: 1 }
          : { error: "stale" };
      return new Response(JSON.stringify(body), { status });
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
    expect(recorded[0].body).toEqual({
      value: { hp: 45 },
      expectedVersion: null,
    });

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

  it("loadAll — 알 수 없는 키 필터링 + version 추출", async () => {
    const { fakeFetch } = makeFakeFetch({
      loadResponse: {
        "character.v2": { hp: 50 },
        "unknown.v2": "ignored",
        _version: { "character.v2": 7, "unknown.v2": 99 },
      },
    });
    const remote = createRemoteSave({
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    const result = await remote.loadAll();
    expect(result.data).toEqual({ "character.v2": { hp: 50 } });
    expect(result.versions).toEqual({ "character.v2": 7 });
  });

  it("seedVersions 후 PATCH 는 expectedVersion 동봉", async () => {
    vi.useFakeTimers();
    const { fakeFetch, recorded } = makeFakeFetch({});
    const remote = createRemoteSave({
      flushDelayMs: 100,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    remote.seedVersions({ "character.v2": 7 });
    remote.patch("character.v2", { hp: 50 });
    await vi.advanceTimersByTimeAsync(100);

    expect(recorded[0].body).toEqual({
      value: { hp: 50 },
      expectedVersion: 7,
    });

    vi.useRealTimers();
  });

  it("409 stale 수신 시 status 가 stale 로 전환 + 큐 폐기", async () => {
    vi.useFakeTimers();
    const { fakeFetch } = makeFakeFetch({ patchStatuses: [409] });
    const remote = createRemoteSave({
      flushDelayMs: 100,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    remote.patch("character.v2", { hp: 50 });
    await vi.advanceTimersByTimeAsync(100);

    expect(remote.status().kind).toBe("stale");
    // 추가 patch 도 stale 상태에선 안 보냄.
    remote.patch("character.v2", { hp: 60 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("성공 응답의 version 으로 다음 PATCH expectedVersion 갱신", async () => {
    vi.useFakeTimers();
    const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(init.body as string) as { expectedVersion?: number | null };
        const next = (body.expectedVersion ?? 0) + 1;
        return new Response(JSON.stringify({ ok: true, version: next }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 200 });
    });
    const remote = createRemoteSave({
      flushDelayMs: 100,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    remote.patch("character.v2", { hp: 50 });
    await vi.advanceTimersByTimeAsync(100);
    // 첫 PATCH: expectedVersion null → 응답 version 1.

    remote.patch("character.v2", { hp: 45 });
    await vi.advanceTimersByTimeAsync(100);
    // 두 번째 PATCH: expectedVersion 1 (직전 응답에서 받은 값).

    const calls = fakeFetch.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "PATCH",
    );
    const bodies = calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string),
    );
    expect(bodies[0]).toEqual({ value: { hp: 50 }, expectedVersion: null });
    expect(bodies[1]).toEqual({ value: { hp: 45 }, expectedVersion: 1 });

    vi.useRealTimers();
  });
});

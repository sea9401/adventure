import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { REPORT_SYSTEM_PROMPT, REPORT_MODEL, REPORT_MAX_TOKENS } from "@/lib/prompts/report";

export const runtime = "nodejs";

// Anthropic 호출은 비용 발생 → 분당 IP당 30회 제한 (한 명의 활발한 플레이도 충분)
const REPORT_RATE_LIMIT = 30;
const REPORT_RATE_WINDOW_MS = 60_000;

type ReportBody = {
  region: { name: string; flavor: string };
  character: { name: string; level: number; className: string };
  dispatch?: {
    durationSec: number;
    kills: { name: string; count: number }[];
    totalKills: number;
    damageDealt: number;
    damageTaken: number;
    dodgesByPlayer: number;
    dodgesByEnemy: number;
    skillActivations?: Record<string, number>;
    diedEarly: boolean;
  };
  boss?: {
    name: string;
    defeated: boolean;
    turns: number;
    damageDealt: number;
    damageTaken: number;
    dodgesByPlayer: number;
    dodgesByEnemy: number;
    skillActivations?: Record<string, number>;
    diedEarly: boolean;
  };
  gained: { gold?: number; iron?: number };
  droppedMaterials: Record<string, number>;
  treasure?: {
    name: string;
    gold?: number;
    iron?: number;
    materials?: Record<string, number>;
  } | null;
  guildReputation: number;
};

const hasApiKey = () => {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "sk-ant-...";
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function killSummary(kills: { name: string; count: number }[]): string {
  return kills.map((k) => `${k.name} ${k.count}마리`).join(", ");
}

function mockReport(body: ReportBody): string {
  const { region, character, dispatch, boss, gained } = body;
  const cls = character.className;

  if (boss) {
    if (boss.defeated) {
      return pick([
        `${cls} ${character.name}이(가) ${region.name}의 ${boss.name}을(를) ${boss.turns}턴 만에 무너뜨렸다. 가한 ${boss.damageDealt} / 받은 ${boss.damageTaken}. 보상은 ${formatGains(gained)}.`,
        `처절한 격투 끝에 ${boss.name}이(가) 쓰러졌다. ${cls}는 ${boss.damageTaken}의 데미지를 견뎌내고 ${formatGains(gained)}을(를) 챙겨 돌아왔다.`,
        `${region.name}이(가) 흔들렸다. ${cls} ${character.name}의 손에 ${boss.name}이(가) 떨어진 것이다. 가방엔 ${formatGains(gained)}.`,
      ]);
    }
    return pick([
      `${cls} ${character.name}은(는) ${boss.name}의 위세에 압도당했다. ${boss.damageTaken}의 데미지를 받고 후퇴할 수밖에 없었다.`,
      `${boss.turns}턴의 격투. ${cls}는 ${boss.name}을(를) 끝내 쓰러뜨리지 못하고 빈손으로 돌아왔다.`,
    ]);
  }

  if (!dispatch) {
    return `${region.name}에서 별일 없이 돌아왔다.`;
  }

  if (dispatch.diedEarly && dispatch.totalKills === 0) {
    return pick([
      `${cls} ${character.name}은 ${region.name}에 발을 들이자마자 위협에 직면했다. 한 마리도 처치하지 못한 채 정신을 잃었다.`,
      `${region.name}은 ${cls}에게 너무 험난했다. 첫 적과의 교전에서 무릎을 꿇었다.`,
    ]);
  }

  if (dispatch.diedEarly) {
    return pick([
      `${cls} ${character.name}은 ${region.name}에서 ${killSummary(dispatch.kills)}를 처치한 끝에 결국 쓰러졌다. 가져온 것: ${formatGains(gained)}.`,
      `격렬한 사냥 끝에 ${cls}은 한계에 부딪혔다. ${dispatch.totalKills}마리를 베어내고 의식을 잃기 전 챙긴 것은 ${formatGains(gained)}.`,
    ]);
  }

  if (dispatch.totalKills === 0) {
    return `${cls} ${character.name}은 ${region.name}을 ${dispatch.durationSec}초간 돌았지만 적을 마주치지 못했다.`;
  }

  const intensity =
    dispatch.totalKills / dispatch.durationSec >= 1
      ? "쉴 새 없이"
      : dispatch.totalKills / dispatch.durationSec >= 0.3
        ? "꾸준히"
        : "신중하게";

  const base = pick([
    `${cls} ${character.name}은 ${dispatch.durationSec}초간 ${region.name}을 ${intensity} 누볐다. ${killSummary(dispatch.kills)}를 처치하고 ${formatGains(gained)}을 챙겨 돌아왔다.`,
    `${region.name}에서의 ${dispatch.durationSec}초. ${cls}는 ${killSummary(dispatch.kills)}를 정리했고, 가방엔 ${formatGains(gained)}이 담겼다.`,
    `${cls} ${character.name}은 ${region.name}을 ${intensity} 사냥했다. ${dispatch.totalKills}마리를 쓰러뜨린 후 ${formatGains(gained)}을 들고 귀환.`,
  ]);

  const extras: string[] = [];
  if (dispatch.dodgesByPlayer >= 5) {
    extras.push(`적의 공격을 ${dispatch.dodgesByPlayer}번이나 흘려넘겼다.`);
  }
  const matCount = Object.values(body.droppedMaterials ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  if (matCount > 0 && !body.treasure) {
    extras.push("쓸만한 재료도 몇 개 손에 넣었다.");
  }
  if (body.treasure) {
    extras.push(
      pick([
        `그 중에 ${body.treasure.name}을(를) 발견한 건 큰 행운이었다.`,
        `발 끝에 무언가 걸렸다. ${body.treasure.name}. 오늘은 운이 따랐다.`,
        `${body.treasure.name}을(를) 발견했다. ${cls} ${character.name}의 가방이 묵직해졌다.`,
      ]),
    );
  }
  return [base, ...extras].join(" ");
}

function formatGains(gained: { gold?: number; iron?: number }): string {
  const parts: string[] = [];
  if (gained.gold) parts.push(`골드 ${gained.gold}`);
  if (gained.iron) parts.push(`철 ${gained.iron}`);
  return parts.length > 0 ? parts.join(", ") : "약간의 노획물";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReportBody;

    if (!hasApiKey()) {
      return Response.json({ report: mockReport(body), source: "mock" });
    }

    // Rate limit (Anthropic 호출만)
    const ip = getClientIp(req);
    const rl = await rateLimit(`report:${ip}`, REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_MS);
    if (!rl.allowed) {
      return tooManyRequests(rl.resetAt);
    }

    const client = new Anthropic();
    const message = await client.messages.create({
      model: REPORT_MODEL,
      max_tokens: REPORT_MAX_TOKENS,
      system: REPORT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(body, null, 2),
        },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    return Response.json({ report: text, source: "claude" });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/report" } });
    const msg = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

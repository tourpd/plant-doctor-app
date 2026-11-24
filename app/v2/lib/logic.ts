// 포토닥터 2 — 알림·교호 살포·추천 규칙
// AI를 쓰지 않는 고정 규칙이다. 비용 0원, 엉뚱한 안내 방지.

import type { Entry } from "./store";

export function today(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}

export function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((b - a) / 86400000);
}

export function niceDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
}

const ROTATION_CATEGORIES = ["살충제", "살균제", "제초제"];

function normMoa(moa: string | null | undefined): string {
  return (moa ?? "").replace(/\s+/g, "").toLowerCase();
}

/** 같은 밭에서 같은 종류(살충제·살균제)로 직전에 친 약 */
export function lastSameCategory(
  entries: Entry[],
  field: string,
  category: string
): Entry | undefined {
  return entries
    .filter(
      (e) => e.kind === "spray" && e.field === field && e.category === category
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

/** 지금 찍은 약이 직전 약과 같은 계통인지 */
export function rotationWarning(
  entries: Entry[],
  field: string,
  category: string,
  moa: string | null | undefined
): string | null {
  if (!ROTATION_CATEGORIES.includes(category)) return null;
  const cur = normMoa(moa);
  if (!cur) return null;
  const last = lastSameCategory(entries, field, category);
  if (!last || !normMoa(last.moa)) return null;
  if (normMoa(last.moa) === cur) {
    return `지난번(${niceDate(last.date)}) ${last.product ?? "약"}도 같은 계통(${last.moa})입니다. 같은 계통을 이어 치면 내성이 생깁니다. 표시기호가 다른 약으로 바꿔 치세요.`;
  }
  return null;
}

/** 올해 같은 밭에 같은 약을 친 횟수 */
export function sprayCount(
  entries: Entry[],
  field: string,
  product: string
): number {
  const year = today().slice(0, 4);
  return entries.filter(
    (e) =>
      e.kind === "spray" &&
      e.field === field &&
      e.product === product &&
      e.date.startsWith(year)
  ).length;
}

export type Alert = {
  level: "warn" | "info";
  title: string;
  body: string;
  calendarUrl?: string;
};

/** 구글 캘린더에 알람으로 넣는 링크 (앱을 닫아도 휴대폰이 울린다) */
export function calendarUrl(title: string, date: string, details: string): string {
  const start = date.replace(/-/g, "");
  const end = addDays(date, 1).replace(/-/g, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** 일지에서 오늘 알려 줄 것들을 뽑는다 */
export function buildAlerts(entries: Entry[]): Alert[] {
  const now = today();
  const alerts: Alert[] = [];
  const sprays = entries.filter((e) => e.kind === "spray");
  const fields = Array.from(new Set(sprays.map((e) => e.field)));

  for (const field of fields) {
    const mine = sprays
      .filter((e) => e.field === field)
      .sort((a, b) => b.createdAt - a.createdAt);

    // 1) 다음 방제 예정일 (가장 최근 기록 기준)
    const latest = mine[0];
    if (latest?.nextDate) {
      const left = diffDays(now, latest.nextDate);
      if (left <= 2) {
        const when =
          left < 0 ? `${-left}일 지났습니다` : left === 0 ? "오늘입니다" : `${left}일 남았습니다`;
        const rot =
          latest.category && ROTATION_CATEGORIES.includes(latest.category) && latest.moa
            ? ` 지난번은 ${latest.moa} 계통이었으니 이번에는 표시기호가 다른 약을 고르세요.`
            : "";
        alerts.push({
          level: "warn",
          title: `${field} 방제 예정일이 ${when}`,
          body: `지난번 방제: ${niceDate(latest.date)}, ${latest.product ?? "약"}.${rot}`,
        });
      }
    }

    // 2) 수확 가능일
    let safe = "";
    for (const e of mine) {
      if (typeof e.phiDays === "number" && e.phiDays > 0) {
        const d = addDays(e.date, e.phiDays);
        if (d > safe) safe = d;
      }
    }
    if (safe && safe >= now) {
      alerts.push({
        level: "info",
        title: `${field} 수확은 ${niceDate(safe)}부터`,
        body: "라벨의 '수확 전 사용 시기'로 계산한 날짜입니다. 그 전에 수확하면 잔류농약이 나올 수 있습니다.",
        calendarUrl: calendarUrl(
          `${field} 수확 가능`,
          safe,
          "포토닥터 농사일지: 라벨의 수확 전 사용 시기 기준"
        ),
      });
    }
  }
  return alerts;
}

// ───────── 약량 계산 (라벨 숫자 × 내 밭 면적) ─────────
// AI가 아니라 산수로만 계산한다. 라벨에 숫자가 없으면 계산하지 않는다.
export const PYEONG_PER_10A = 302.5; // 10a = 1,000㎡ = 약 302.5평

export type DoseInput = {
  dilution_x: number | null; // 희석배수 (1000배면 1000)
  per_10a_amount: number | null; // 10a당 사용량 숫자
  per_10a_unit: string | null; // 그 단위 (kg, g, ml, L 등)
  spray_l_per_10a: number | null; // 10a당 살포 물량(L)
};

function fmt(n: number): string {
  if (n >= 100) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

function fmtMl(ml: number): string {
  return ml >= 1000 ? `${fmt(ml / 1000)}L(kg)` : `${fmt(ml)}ml(g)`;
}

export function doseLines(
  use: DoseInput,
  areaPyeong: number | undefined,
  tankL: number
): string[] {
  const lines: string[] = [];
  const x = use.dilution_x;
  if (x && x > 0 && tankL > 0) {
    lines.push(`물 ${fmt(tankL)}L에 약 ${fmtMl((tankL * 1000) / x)} (${fmt(x)}배)`);
  }
  if (areaPyeong && areaPyeong > 0) {
    const ratio = areaPyeong / PYEONG_PER_10A;
    if (use.spray_l_per_10a && use.spray_l_per_10a > 0) {
      const water = use.spray_l_per_10a * ratio;
      const chem = x && x > 0 ? `, 약은 모두 ${fmtMl((water * 1000) / x)}` : "";
      lines.push(`${fmt(areaPyeong)}평 전체: 물 약 ${fmt(water)}L${chem}`);
    }
    if (use.per_10a_amount && use.per_10a_amount > 0) {
      lines.push(
        `${fmt(areaPyeong)}평 전체: 약 ${fmt(use.per_10a_amount * ratio)}${use.per_10a_unit ?? ""} (라벨: 10a당 ${fmt(use.per_10a_amount)}${use.per_10a_unit ?? ""})`
      );
    }
  }
  return lines;
}

/** 라벨의 작물 이름이 내 작물과 같은 줄 찾기 (AI가 못 골랐을 때 대비) */
export function matchUseIndex(uses: { crop: string }[], crop: string): number {
  const c = crop.replace(/\s+/g, "");
  if (!c) return -1;
  return uses.findIndex((u) => {
    const uc = (u.crop ?? "").replace(/\s+/g, "");
    return uc.length > 0 && (uc.includes(c) || c.includes(uc));
  });
}

// ───────── 도프 제품 추천표 ─────────
// 문구는 효능을 단정하지 않는다. 도프 공식 표현을 받으면 note만 바꾸면 된다.
export type Product = { name: string; note: string; url: string };

const EXPO = "https://kagri-expo.com/expo";

const DOF: Record<string, Product> = {
  ssak: {
    name: "싹쓰리충",
    note: "도프 유기농업자재",
    url: `${EXPO}/product/ssaksseurichung`,
  },
  ssakGold: {
    name: "싹쓰리충 골드",
    note: "도프 유기농업자재",
    url: `${EXPO}/product/ssaksseurichung-gold`,
  },
  mel: {
    name: "멸규니",
    note: "도프 유기농업자재",
    url: `${EXPO}/product/melgyuni`,
  },
};

/** 방금 기록한 약 종류에 맞춰 보여 줄 도프 제품 */
export function recommendFor(category: string | undefined): Product[] {
  if (category === "살충제") return [DOF.ssak, DOF.ssakGold];
  if (category === "살균제") return [DOF.mel];
  return [];
}

/** 영농일지 CSV (인증·출하 서류용) */
export function toCsv(entries: Entry[]): string {
  const head = ["날짜", "밭", "작물", "종류", "제품", "계통", "대상", "사용량", "메모"];
  const kindOf = (e: Entry) =>
    e.kind === "spray"
      ? e.category ?? kindName.spray
      : e.kind === "work"
        ? e.work ?? kindName.work
        : kindName.growth;
  const kindName = { spray: "약·영양제", growth: "작물 사진", work: "작업" } as const;
  const esc = (v: string | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [...entries]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) =>
      [
        e.date,
        e.field,
        e.crop,
        kindOf(e),
        e.product,
        e.moa,
        e.target,
        e.amount,
        e.memo,
      ]
        .map(esc)
        .join(",")
    );
  return "﻿" + [head.map(esc).join(","), ...rows].join("\r\n");
}

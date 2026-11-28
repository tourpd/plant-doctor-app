// 포토닥터 2 — 알림·교호 살포·추천 규칙
// AI를 쓰지 않는 고정 규칙이다. 비용 0원, 엉뚱한 안내 방지.

import type { Entry, FarmMode, Field, Sprayer } from "./store";

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
  drone?: boolean; // 드론(무인항공) 전용으로 등록된 사용법
  dilution_x: number | null; // 희석배수 (1000배면 1000)
  per_10a_amount: number | null; // 10a당 사용량 숫자
  per_10a_unit: string | null; // 그 단위 (kg, g, ml, L 등)
  spray_l_per_10a: number | null; // 10a당 살포 물량(L)
};

function fmt(n: number): string {
  if (n >= 100) return String(Math.round(n));
  if (n < 1) return String(Math.round(n * 100) / 100); // 베란다처럼 아주 적은 양
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
        `${fmt(areaPyeong)}평 전체: 약 ${fmt(use.per_10a_amount * ratio)}${use.per_10a_unit ?? ""} (기준: 10a(약 300평)당 ${fmt(use.per_10a_amount)}${use.per_10a_unit ?? ""})`
      );
    }
  }
  return lines;
}

// ───────── 내 통에 맞춘 살포 계획 ─────────

export type TankOption = { sprayer: Sprayer; liters: number; label: string };

/** 밭 등록 때 고르는 통. 직접 입력도 받는다 */
export function tankOptions(mode: FarmMode): TankOption[] {
  if (mode === "베란다")
    return [
      { sprayer: "분무기", liters: 0.5, label: "분무기 0.5L" },
      { sprayer: "분무기", liters: 1, label: "분무기 1L" },
      { sprayer: "분무기", liters: 2, label: "분무기 2L" },
    ];
  if (mode === "텃밭")
    return [
      { sprayer: "분무기", liters: 2, label: "분무기 2L" },
      { sprayer: "분무기", liters: 5, label: "압축 분무기 5L" },
      { sprayer: "등짐", liters: 20, label: "등짐 분무기 20L" },
    ];
  return [
    { sprayer: "등짐", liters: 20, label: "등짐 분무기 20L" },
    { sprayer: "동력", liters: 200, label: "동력분무기 200L 통" },
    { sprayer: "동력", liters: 500, label: "동력분무기 500L 통" },
    { sprayer: "동력", liters: 1000, label: "동력분무기 1,000L 통" },
    { sprayer: "드론", liters: 16, label: "드론 16L 통" },
  ];
}

const FRUIT_TREES = ["사과", "배", "복숭아", "포도", "감", "감귤", "귤", "자두", "매실", "대추", "밤", "체리", "살구", "유자", "키위", "참다래", "블루베리", "무화과", "석류", "호두"];

/**
 * 10a(약 300평)에 드는 물량의 일반 기준. 공식 자료에도 라벨에도 없는 숫자라
 * 화면에 "일반 기준"이라고 밝히고, 농민이 실제로 쓴 물량을 기록하면 그 값으로 바꾼다.
 */
export function defaultWaterPer10a(crop: string): number {
  const c = crop.replace(/\s+/g, "");
  if (FRUIT_TREES.some((f) => c.includes(f))) return 300;
  if (c.includes("벼")) return 120;
  return 150;
}

export type SprayPlan = {
  lines: string[]; // 크게 보여 줄 줄
  waterL: number | null; // 이번에 필요한 물(희석액) 양
  basis: string; // 물량이 어디서 나온 숫자인지
  blocked: string; // 계산하면 안 되는 이유 (드론 미등록 등)
};

function fmtAmt(mlOrG: number): string {
  return mlOrG >= 1000 ? `${fmt(mlOrG / 1000)}L(kg)` : `${fmt(mlOrG)}ml(g)`;
}

function tanksText(waterL: number, tankL: number): string {
  const n = waterL / tankL;
  if (n <= 1.05) {
    const part = Math.round(n * 10) / 10;
    return part >= 0.95 ? "한 통" : `한 통에 못 미칩니다. 통에 물을 ${fmt(waterL)}L만 받으세요`;
  }
  const full = Math.floor(n + 0.05);
  const rest = waterL - full * tankL;
  return rest > tankL * 0.08 ? `${full}통 가득 + 마지막 통은 ${fmt(rest)}L만` : `${full}통`;
}

/**
 * 내 통 크기와 평수에 맞춘 답.
 * 희석배수·사용량은 자료 숫자 그대로 쓰고, 여기서 정하는 것은 물량뿐이다.
 */
export function sprayPlan(
  use: DoseInput,
  opts: {
    areaPyeong?: number;
    sprayer?: Sprayer;
    tankL?: number;
    waterPer10a?: number; // 이 밭에서 배운 값
    crop?: string;
    product?: string;
    adjust?: number; // 물량 조절(적게 0.7 · 보통 1 · 많이 1.4)
  }
): SprayPlan {
  const lines: string[] = [];
  const name = opts.product || "약";
  const tank = opts.tankL && opts.tankL > 0 ? opts.tankL : 20;
  const area = opts.areaPyeong && opts.areaPyeong > 0 ? opts.areaPyeong : 0;
  const ratio = area / PYEONG_PER_10A;
  const x = use.dilution_x && use.dilution_x > 0 ? use.dilution_x : 0;
  const isDrone = opts.sprayer === "드론";

  if (isDrone && !use.drone) {
    return {
      lines: [],
      waterL: null,
      basis: "",
      blocked: "이 사용법은 드론(무인항공)용으로 등록된 것이 아닙니다. 드론으로 치지 말고, 드론 전용 등록 약제인지 라벨을 확인하세요.",
    };
  }
  if (!isDrone && use.drone) {
    return {
      lines: [],
      waterL: null,
      basis: "",
      blocked: "이 줄은 드론(무인항공) 전용 사용법입니다. 등짐·동력분무기로 칠 때는 다른 줄을 고르세요.",
    };
  }

  // 드론: 자료에 적힌 10a당 살포량(희석액)을 그대로 쓴다
  if (isDrone) {
    const per10a = use.spray_l_per_10a && use.spray_l_per_10a > 0 ? use.spray_l_per_10a : 0;
    if (!x || !per10a) return { lines: [], waterL: null, basis: "", blocked: "드론용 희석배수나 살포량이 자료에 없어 계산하지 않았습니다. 라벨을 확인하세요." };
    lines.push(`드론 ${fmt(tank)}L 통 가득이면 → ${name} ${fmtAmt((tank * 1000) / x)} (${fmt(x)}배)`);
    if (area) {
      const liquid = per10a * ratio;
      const flights = Math.ceil(liquid / tank - 0.02);
      lines.push(`내 밭 ${fmt(area)}평 → 뿌릴 양 약 ${fmt(liquid)}L, ${name} ${fmtAmt((liquid * 1000) / x)}`);
      lines.push(flights <= 1 ? "한 번 비행으로 끝납니다" : `${fmt(tank)}L 통으로 ${flights}번 떠야 합니다`);
      return { lines, waterL: liquid, basis: `등록 기준: 10a당 ${fmt(per10a)}L`, blocked: "" };
    }
    return { lines, waterL: null, basis: `등록 기준: 10a당 ${fmt(per10a)}L`, blocked: "" };
  }

  // 물에 타서 뿌리는 약
  if (x) {
    lines.push(`${fmt(tank)}L 통 한 통에 → ${name} ${fmtAmt((tank * 1000) / x)} (${fmt(x)}배)`);
    if (area) {
      const learned = opts.waterPer10a && opts.waterPer10a > 0 ? opts.waterPer10a : 0;
      const per10a =
        use.spray_l_per_10a && use.spray_l_per_10a > 0
          ? use.spray_l_per_10a
          : (learned || defaultWaterPer10a(opts.crop ?? "")) * (opts.adjust && !learned ? opts.adjust : 1);
      const water = per10a * ratio;
      lines.push(`내 밭 ${fmt(area)}평 → 물 약 ${fmt(water)}L에 ${name} ${fmtAmt((water * 1000) / x)}`);
      lines.push(`${fmt(tank)}L 통으로 ${tanksText(water, tank)}`);
      const basis =
        use.spray_l_per_10a && use.spray_l_per_10a > 0
          ? `물량은 등록 기준(10a당 ${fmt(use.spray_l_per_10a)}L)`
          : learned
            ? `물량은 이 밭에서 실제로 쓴 기록 기준(300평당 약 ${fmt(learned)}L)`
            : `물량은 일반 기준(300평당 약 ${fmt(per10a)}L)입니다. 치고 나서 실제로 쓴 물을 적으면 다음부터 내 밭에 맞춰 계산합니다`;
      return { lines, waterL: water, basis, blocked: "" };
    }
    return { lines, waterL: null, basis: "", blocked: "" };
  }

  // 입제처럼 물에 타지 않고 면적당 양으로 주는 것
  if (use.per_10a_amount && use.per_10a_amount > 0) {
    const u = use.per_10a_unit ?? "";
    if (area) lines.push(`내 밭 ${fmt(area)}평 → ${name} 약 ${fmt(use.per_10a_amount * ratio)}${u}`);
    return { lines, waterL: null, basis: `기준: 10a(약 300평)당 ${fmt(use.per_10a_amount)}${u}`, blocked: "" };
  }
  return { lines: [], waterL: null, basis: "", blocked: "" };
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

/** 방금 기록한 약 종류와 입구(농사·텃밭·베란다)에 맞춰 보여 줄 도프 제품 */
export function recommendFor(category: string | undefined, mode: FarmMode = "농사"): Product[] {
  const home = mode !== "농사";
  const tag = (p: Product): Product =>
    home ? { ...p, note: "도프 텃밭·가정원예용" } : p;
  if (category === "살충제") return home ? [tag(DOF.ssakGold)] : [DOF.ssak, DOF.ssakGold];
  if (category === "살균제") return [tag(DOF.mel)];
  return [];
}

// ───────── 입구별 설정 ─────────
export function tankPresets(mode: FarmMode): string[] {
  if (mode === "베란다") return ["0.5", "1", "2"];
  if (mode === "텃밭") return ["1", "5", "20"];
  return ["20", "100", "500"];
}

export function worksFor(mode: FarmMode): string[] {
  if (mode === "베란다")
    return ["💧 물주기", "🪴 분갈이", "🧺 영양제·비료 주기", "✂️ 가지치기·순지르기", "🍅 수확", "📝 그 밖의 일"];
  return [
    "🌱 심기·씨뿌리기",
    "💧 물주기",
    "🧺 거름·비료 주기",
    "🌿 풀 뽑기",
    "✂️ 가지치기·순지르기",
    "🍎 수확",
    "📝 그 밖의 일",
  ];
}

// ───────── 날씨에 맞춘 살포 안내 ─────────
export type WeatherDay = {
  date: string;
  rainMm: number;
  rainProb: number;
  windMs: number;
  tMax: number;
  tMin: number;
};

/** 오늘·내일 예보로 약 치기 좋은지 알려 준다. 고정 규칙이다. */
export function weatherAdvice(days: WeatherDay[], field: Field): string[] {
  const mode = field.mode ?? "농사";
  if (mode === "베란다" || days.length === 0) return [];
  const covered = field.type === "시설하우스" || field.type === "스마트팜";
  const out: string[] = [];
  const names = ["오늘", "내일"];
  days.slice(0, 2).forEach((d, i) => {
    const day = names[i];
    if (!covered && (d.rainProb >= 60 || d.rainMm >= 1)) {
      out.push(`☔ ${day} 비 예보(확률 ${Math.round(d.rainProb)}%). 약이 씻겨 내려가니 비가 그친 뒤에 치세요.`);
    }
    if (!covered && d.windMs >= 5) {
      out.push(`💨 ${day} 바람이 셉니다(최대 초속 ${Math.round(d.windMs)}m). 약이 날리니 바람이 잔 아침·저녁에 치세요.`);
    }
    if (d.tMax >= 30) {
      out.push(`🌡 ${day} 낮 최고 ${Math.round(d.tMax)}도. 한낮은 피하고 아침·저녁에 치세요.`);
    }
  });
  if (out.length === 0) {
    out.push(
      covered
        ? "🌤 오늘·내일 한낮 더위 걱정은 없습니다."
        : "🌤 오늘·내일 비와 센 바람 예보가 없어 약 치기 무난합니다."
    );
  }
  return out;
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

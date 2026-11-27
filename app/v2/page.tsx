"use client";

// 포토닥터 2 — 사진만 찍으면 농사일지가 되는 화면
// 기존 진단 화면(/)은 건드리지 않고 /v2 에 따로 둔다.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, RefObject } from "react";
import Link from "next/link";
import {
  deleteEntry,
  getCurrentField,
  getEntries,
  getFields,
  newId,
  putEntry,
  safeThumb,
  saveFields,
  setCurrentField,
} from "./lib/store";
import { prepareImageForUpload, SERVER_LIMIT } from "../../lib/clientImage";
import type { Entry, FarmMode, FarmType, Field } from "./lib/store";
import { nearestRegion, searchRegions } from "./lib/regions";
import type { Region } from "./lib/regions";
import {
  addDays,
  buildAlerts,
  calendarUrl,
  doseLines,
  matchUseIndex,
  niceDate,
  recommendFor,
  rotationWarning,
  sprayCount,
  tankPresets,
  toCsv,
  today,
  weatherAdvice,
  worksFor,
} from "./lib/logic";
import type { WeatherDay } from "./lib/logic";

type LabelUse = {
  crop: string;
  target: string | null;
  dilution: string | null;
  dilution_x: number | null;
  per_10a_amount: number | null;
  per_10a_unit: string | null;
  spray_l_per_10a: number | null;
  timing: string | null;
  max_count: number | null;
  phi_days: number | null;
};

type Label = {
  readable: boolean;
  need_more: string | null;
  product_name: string | null;
  maker: string | null;
  category: string;
  ingredient: string | null;
  moa_code: string | null;
  summary: {
    where: string | null;
    how_much: string | null;
    when: string | null;
    caution: string | null;
  } | null;
  uses: LabelUse[];
  my_use_index: number | null;
  source?: "official"; // 공식 등록 자료에서 찾은 제품
  variant?: string; // 같은 상표의 여러 제형을 구분하는 말
};

/** 브라우저 음성 인식 (크롬·삼성 인터넷). 없는 브라우저도 있다 */
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type Mode = "home" | "field" | "pick" | "label" | "record" | "saved" | "growth" | "work" | "diary";

const GREEN = "#16a34a";
const NOT_ON_LABEL = "라벨에서 확인되지 않음";
const NOT_IN_DATA = "공식 자료에 적혀 있지 않음";
const FARM_TYPES: FarmType[] = ["노지", "시설하우스", "스마트팜"];
const FARM_MODES: { mode: FarmMode; icon: string; desc: string }[] = [
  { mode: "농사", icon: "🚜", desc: "논밭·과수원·하우스" },
  { mode: "텃밭", icon: "🥬", desc: "주말농장·마당 텃밭" },
  { mode: "베란다", icon: "🪴", desc: "화분·반려식물" },
];

const S: Record<string, CSSProperties> = {
  wrap: {
    maxWidth: 560,
    margin: "0 auto",
    padding: "16px 14px 80px",
    fontSize: 18,
    lineHeight: 1.5,
    color: "#111",
    background: "#f6fff9",
    minHeight: "100vh",
  },
  bigBtn: {
    width: "100%",
    minHeight: 72,
    borderRadius: 16,
    border: "none",
    background: GREEN,
    color: "#fff",
    fontSize: 22,
    fontWeight: 900,
    marginTop: 12,
  },
  subBtn: {
    width: "100%",
    minHeight: 54,
    borderRadius: 14,
    border: "2px solid #cbd5e1",
    background: "#fff",
    color: "#111",
    fontSize: 18,
    fontWeight: 800,
    marginTop: 10,
  },
  card: {
    background: "#fff",
    border: "1px solid #d1fae5",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  warn: {
    background: "#fef2f2",
    border: "2px solid #fca5a5",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    minHeight: 50,
    borderRadius: 12,
    border: "2px solid #cbd5e1",
    padding: "8px 12px",
    fontSize: 18,
    marginTop: 6,
    background: "#fff",
    boxSizing: "border-box",
  },
  label: { display: "block", fontWeight: 800, marginTop: 14 },
  linkBtn: {
    width: "100%",
    minHeight: 54,
    borderRadius: 14,
    border: "2px solid #cbd5e1",
    background: "#fff",
    color: "#111",
    fontSize: 18,
    fontWeight: 800,
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    boxSizing: "border-box",
  },
};

function chip(on: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    minHeight: 48,
    borderRadius: 999,
    border: `2px solid ${on ? GREEN : "#cbd5e1"}`,
    background: on ? "#dcfce7" : "#fff",
    color: "#111",
    fontSize: 17,
    fontWeight: 800,
  };
}

function modeOf(f: Field | null | undefined): FarmMode {
  return f?.mode ?? "농사";
}

function fieldLine(f: Field): string {
  const mode = modeOf(f);
  return [
    mode === "농사" ? "" : mode,
    f.crop,
    f.area ? `${f.area}평` : "",
    f.pots ? `화분 ${f.pots}개` : "",
    mode === "농사" ? f.type ?? "" : "",
    f.region ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 사진 찍기 + 앨범에서 고르기 두 버튼 */
function PhotoButtons(props: {
  onFile: (f: File) => void;
  testid: string;
  disabled?: boolean;
  guard?: () => boolean;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) props.onFile(f);
  };
  const open = (ref: RefObject<HTMLInputElement | null>) => {
    if (props.guard && !props.guard()) return;
    ref.current?.click();
  };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <input
        ref={cam}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid={`${props.testid}-camera`}
        onChange={onChange}
      />
      <input
        ref={album}
        type="file"
        accept="image/*"
        hidden
        data-testid={`${props.testid}-album`}
        onChange={onChange}
      />
      <button
        style={{ ...S.bigBtn, marginTop: 0, flex: 1, minHeight: 62, fontSize: 19 }}
        disabled={props.disabled}
        onClick={() => open(cam)}
      >
        📷 사진 찍기
      </button>
      <button
        style={{ ...S.subBtn, marginTop: 0, flex: 1, minHeight: 62 }}
        disabled={props.disabled}
        onClick={() => open(album)}
      >
        🖼 앨범에서 고르기
      </button>
    </div>
  );
}

export default function PhotoDoctorV2() {
  const [mode, setMode] = useState<Mode>("home");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [curName, setCurName] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 밭 등록
  const [fName, setFName] = useState("");
  const [fCrop, setFCrop] = useState("");
  const [fArea, setFArea] = useState("");
  const [fType, setFType] = useState<FarmType>("노지");
  const [fMode, setFMode] = useState<FarmMode>("농사");
  const [fPots, setFPots] = useState("");
  const [fRegion, setFRegion] = useState<Region | null>(null);
  const [regionQ, setRegionQ] = useState("");
  const [locating, setLocating] = useState(false);
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [weatherSource, setWeatherSource] = useState("");

  // 라벨 읽기
  const [label, setLabel] = useState<Label | null>(null);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [thumb, setThumb] = useState("");
  const [nameQ, setNameQ] = useState("");
  const [candidates, setCandidates] = useState<Label[]>([]);
  const [officialSource, setOfficialSource] = useState("");
  const [listening, setListening] = useState(false);

  // 기록 입력
  const [useIdx, setUseIdx] = useState(-1);
  const [tankL, setTankL] = useState("20");
  const [amount, setAmount] = useState("");
  const [nextDays, setNextDays] = useState(0);
  const [memo, setMemo] = useState("");
  const [work, setWork] = useState("");
  const [saved, setSaved] = useState<Entry | null>(null);
  const [diaryField, setDiaryField] = useState("");


  useEffect(() => {
    const fs = getFields();
    setFields(fs);
    const cur = getCurrentField();
    setCurName(fs.some((f) => f.name === cur) ? cur : fs[0]?.name ?? "");
    setReady(true);
    getEntries()
      .then(setEntries)
      .catch(() => setError("이 휴대폰에서는 일지를 저장할 수 없습니다."));
  }, []);

  const cur = fields.find((f) => f.name === curName) ?? null;
  const curMode = modeOf(cur);
  const alerts = useMemo(() => buildAlerts(entries), [entries]);

  // 밭 위치의 날씨 (베란다는 실내라 보지 않는다)
  const wLat = curMode === "베란다" ? undefined : cur?.lat;
  const wLon = curMode === "베란다" ? undefined : cur?.lon;
  useEffect(() => {
    if (wLat === undefined || wLon === undefined) return;
    let alive = true;
    fetch(`/api/v2/weather?lat=${wLat}&lon=${wLon}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setWeather(d?.ok && Array.isArray(d.days) ? (d.days as WeatherDay[]) : []);
        setWeatherSource(typeof d?.source === "string" ? d.source : "");
      })
      .catch(() => {
        if (alive) setWeather([]);
      });
    return () => {
      alive = false;
    };
  }, [wLat, wLon]);
  const hasWeather = wLat !== undefined && wLon !== undefined && weather.length > 0;
  const advice = cur && hasWeather ? weatherAdvice(weather, cur) : [];

  function resetForm() {
    setCandidates([]);
    setNameQ("");
    setLabel(null);
    setLabelFiles([]);
    setThumb("");
    setUseIdx(-1);
    setTankL(tankPresets(curMode)[0]);
    setAmount("");
    setNextDays(0);
    setMemo("");
    setWork("");
    setError("");
  }

  function goHome() {
    resetForm();
    setSaved(null);
    setMode("home");
  }

  function chooseField(name: string) {
    setCurName(name);
    setCurrentField(name);
  }

  function openFieldForm(f?: Field) {
    setFName(f?.name ?? "");
    setFCrop(f?.crop ?? "");
    setFArea(f?.area ? String(f.area) : "");
    setFType(f?.type ?? "노지");
    setFMode(modeOf(f));
    setFPots(f?.pots ? String(f.pots) : "");
    setFRegion(
      f?.region && f.lat !== undefined && f.lon !== undefined
        ? { name: f.region, lat: f.lat, lon: f.lon }
        : null
    );
    setRegionQ("");
    setError("");
    setMode("field");
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setError("이 휴대폰에서는 위치를 쓸 수 없습니다. 지역 이름을 적어 주세요.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestRegion(pos.coords.latitude, pos.coords.longitude);
        setFRegion({ name: near.name, lat: pos.coords.latitude, lon: pos.coords.longitude });
        setRegionQ("");
        setLocating(false);
      },
      () => {
        setError("위치를 가져오지 못했습니다. 지역 이름을 적어 주세요.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  function saveField() {
    const name = fName.trim();
    const crop = fCrop.trim();
    if (!name || !crop) {
      setError("밭 이름과 작물은 꼭 적어 주세요.");
      return;
    }
    if (fMode !== "베란다" && !fRegion) {
      setError("지역을 골라 주세요. 지역에 따라 날씨와 방제 시기가 달라집니다.");
      return;
    }
    const area = Number(fArea);
    const pots = Number(fPots);
    const next: Field[] = [
      {
        name,
        crop,
        mode: fMode,
        area: fMode !== "베란다" && area > 0 ? area : undefined,
        pots: fMode === "베란다" && pots > 0 ? pots : undefined,
        type: fMode === "농사" ? fType : undefined,
        region: fRegion?.name,
        lat: fRegion?.lat,
        lon: fRegion?.lon,
      },
      ...fields.filter((f) => f.name !== name),
    ];
    setFields(next);
    saveFields(next);
    chooseField(name);
    setError("");
    setMode("home");
  }

  // ───── 라벨 사진 → AI 읽기 ─────
  /** 제품 하나를 결과 화면에 올린다 (공식 자료·라벨 읽기 공통) */
  function showProduct(raw: Label, files: File[]) {
    if (!cur) return;
    const uses = Array.isArray(raw.uses) ? raw.uses : [];
    const ai = raw.my_use_index;
    const idx =
      typeof ai === "number" && ai >= 0 && ai < uses.length ? ai : matchUseIndex(uses, cur.crop);
    setLabel({ ...raw, uses });
    setUseIdx(idx >= 0 ? idx : uses.length > 0 ? -2 : -1);
    setTankL(tankPresets(modeOf(cur))[0]);
    setLabelFiles(files.slice(0, 2));
    setMode("label");
  }

  // ───── 제품 이름으로 찾기 (공식 등록 자료, AI를 쓰지 않는다) ─────
  async function searchName(raw: string) {
    const q = raw.trim();
    if (!cur) return;
    if (q.replace(/\s+/g, "").length < 2) {
      setError("제품 이름을 두 글자 이상 넣어 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v2/product?q=${encodeURIComponent(q)}&crop=${encodeURIComponent(cur.crop)}`);
      const data = await res.json().catch(() => null);
      if (!data) throw new Error(`서버가 응답하지 못했습니다. 잠시 뒤 다시 해 주세요. (코드: HTTP ${res.status})`);
      if (!data.ok) {
        throw new Error(`${data.error || "제품을 찾지 못했습니다."}${data.code ? ` (코드: ${data.code})` : ""}${data.detail ? ` [${data.detail}]` : ""}`);
      }
      const list = (Array.isArray(data.products) ? data.products : []) as Label[];
      setOfficialSource(typeof data.source === "string" ? data.source : "");
      setThumb("");
      if (list.length === 0) {
        throw new Error(`'${q}'은(는) 공식 등록 자료에서 찾지 못했습니다. 이름을 다시 확인하거나, 라벨 뒷면의 사용법 표를 찍어 주세요.`);
      }
      if (list.length === 1) {
        showProduct(list[0], []);
      } else {
        setCandidates(list);
        setLabelFiles([]);
        setMode("pick");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "제품을 찾지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ───── 말로 제품 이름 넣기 ─────
  function startVoice() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) {
      setError("이 휴대폰 브라우저는 말로 넣기가 안 됩니다. 이름을 글자로 넣어 주세요.");
      return;
    }
    try {
      const rec = new Rec();
      rec.lang = "ko-KR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const said = (e.results[0][0].transcript || "").replace(/[.?!]/g, "").trim();
        setNameQ(said);
        if (said) void searchName(said);
      };
      rec.onerror = () => {
        setListening(false);
        setError("말소리를 듣지 못했습니다. 마이크 사용을 허용했는지 확인하고 다시 눌러 주세요.");
      };
      rec.onend = () => setListening(false);
      setError("");
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setError("말로 넣기를 시작하지 못했습니다. 이름을 글자로 넣어 주세요.");
    }
  }

  /** skipOfficial: 공식 자료에 사용량이 없어 뒷면 표를 직접 읽을 때 */
  async function readLabel(files: File[], skipOfficial = false) {
    if (files.length === 0 || !cur) return;
    setLoading(true);
    setError("");
    try {
      // 갤럭시 고화소·HEIC 사진도 받도록 운영 진단과 같은 방식으로 정리해서 보낸다
      const form = new FormData();
      let total = 0;
      let firstPrepared: File | null = null;
      for (const f of files.slice(0, 2)) {
        const prepared = await prepareImageForUpload(f);
        total += prepared.file.size;
        if (!firstPrepared) firstPrepared = prepared.file;
        form.append("images", prepared.file, prepared.file.name || "label.jpg");
      }
      if (total > SERVER_LIMIT) {
        throw new Error("사진 용량이 너무 큽니다. '사진 찍기'로 다시 찍어 주세요.");
      }
      form.append("crop", cur.crop);
      form.append("farmType", cur.type ?? "");
      setThumb((await safeThumb(firstPrepared ?? files[0], 480, 0.6)) ?? "");
      const res = await fetch("/api/v2/label", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!data) throw new Error(`서버가 응답하지 못했습니다. 잠시 뒤 다시 해 주세요. (코드: HTTP ${res.status})`);
      if (!data.ok) {
        throw new Error(
          `${data.error || "라벨을 읽지 못했습니다."}${data.code ? ` (코드: ${data.code})` : ""}${data.detail ? ` [${data.detail}]` : ""}`
        );
      }
      const raw = data.label as Label;
      // 상표 이름이 공식 등록 자료에 있으면 그 사용법을 쓴다 (앞면 한 장으로 끝)
      const off = skipOfficial
        ? null
        : (data.official as { source?: string; products?: Label[]; picked?: number } | undefined);
      const offList = Array.isArray(off?.products) ? off.products : [];
      if (offList.length > 0) {
        setOfficialSource(off?.source ?? "");
        const picked = typeof off?.picked === "number" ? off.picked : -1;
        if (offList.length === 1 || picked >= 0) {
          showProduct(offList[picked >= 0 ? picked : 0], files);
        } else {
          setCandidates(offList);
          setLabelFiles(files.slice(0, 2));
          setMode("pick");
        }
      } else {
        showProduct(raw, files);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "라벨을 읽지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function speak(l: Label) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const s = l.summary;
    const text = [
      l.product_name,
      s?.where && `어디에 쓰나. ${s.where}`,
      s?.how_much && `얼마나 쓰나. ${s.how_much}`,
      s?.when && `언제 치나. ${s.when}`,
      s?.caution && `주의할 점. ${s.caution}`,
    ]
      .filter(Boolean)
      .join(". ");
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  // ───── 내 밭 기준 계산 ─────
  const chosenUse = label && useIdx >= 0 ? label.uses[useIdx] : null;
  const offLabel = !!label && label.uses.length > 0 && useIdx === -2;
  const official = label?.source === "official";
  const missing = official ? NOT_IN_DATA : NOT_ON_LABEL;
  // 내 작물에 등록된 줄이 여러 개면(병해충별) 골라서 본다
  const myUses =
    label && cur
      ? label.uses
          .map((u, i) => ({ u, i }))
          .filter(({ u }) => matchUseIndex([u], cur.crop) === 0)
      : [];
  // 최근에 기록한 제품 (다시 찾기 쉽게)
  const recentProducts = Array.from(
    new Set(entries.filter((e) => e.kind === "spray" && e.product && e.product !== "이름 모름").map((e) => e.product as string))
  ).slice(0, 6);
  const dose = chosenUse ? doseLines(chosenUse, cur?.area, Number(tankL) || 0) : [];
  const rotation =
    label && cur ? rotationWarning(entries, cur.name, label.category, label.moa_code) : null;
  const usedCount =
    label?.product_name && cur ? sprayCount(entries, cur.name, label.product_name) : 0;
  const overCount =
    !!chosenUse && typeof chosenUse.max_count === "number" && usedCount >= chosenUse.max_count;
  const indoorNote =
    curMode === "베란다"
      ? "🪴 베란다에서는 창문을 열어 환기하고, 아이와 반려동물이 닿지 않게 하세요."
      : cur?.type === "시설하우스" || cur?.type === "스마트팜"
        ? `🏠 ${cur.type}에서는 마스크와 보호구를 쓰고, 뿌린 뒤 충분히 환기한 다음 들어가세요.`
        : "";
  const weatherCard = advice.length > 0 && cur && (
    <div style={S.card}>
      <div style={{ fontWeight: 900 }}>{cur.region} 날씨와 약 치기</div>
      {advice.map((a) => (
        <div key={a} style={{ marginTop: 4 }}>
          {a}
        </div>
      ))}
      {weatherSource && <div style={{ fontSize: 13, color: "#777", marginTop: 6 }}>자료: {weatherSource}</div>}
    </div>
  );

  async function saveSpray() {
    if (!label || !cur) return;
    const date = today();
    const entry: Entry = {
      id: newId(),
      createdAt: Date.now(),
      date,
      kind: "spray",
      field: cur.name,
      crop: cur.crop,
      thumb,
      memo: memo.trim() || undefined,
      product: label.product_name ?? "이름 모름",
      category: label.category,
      moa: label.moa_code,
      ingredient: label.ingredient,
      target: chosenUse?.target ?? null,
      amount: amount.trim() || undefined,
      phiDays: chosenUse?.phi_days ?? null,
      maxCount: chosenUse?.max_count ?? null,
      nextDate: nextDays > 0 ? addDays(date, nextDays) : null,
    };
    await putEntry(entry);
    setEntries(await getEntries());
    setSaved(entry);
    setMode("saved");
  }

  async function savePhoto(kind: "growth" | "work", file: File | null) {
    if (!cur) return;
    if (kind === "work" && !work) {
      setError("어떤 일을 했는지 골라 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const entry: Entry = {
        id: newId(),
        createdAt: Date.now(),
        date: today(),
        kind,
        field: cur.name,
        crop: cur.crop,
        thumb: file ? await safeThumb(file, 640, 0.65) : undefined,
        memo: memo.trim() || undefined,
        work: kind === "work" ? work : undefined,
      };
      await putEntry(entry);
      setEntries(await getEntries());
      setSaved(entry);
      setMode("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function removeEntry(id: string) {
    await deleteEntry(id);
    setEntries(await getEntries());
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(entries)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `농사일지_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const curCard = cur && (
    <div style={{ ...S.card, background: "#ecfdf5" }}>
      <b>{cur.name}</b> · {fieldLine(cur)}
    </div>
  );

  return (
    <main style={S.wrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {mode !== "home" && fields.length > 0 && (
          <button
            onClick={goHome}
            style={{ ...S.subBtn, width: "auto", minHeight: 44, marginTop: 0, padding: "0 14px" }}
          >
            ← 처음
          </button>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🌱 포토닥터 농사일지</h1>
      </div>

      {/* 알림은 화면 어디를 보고 있어도 보이게 고정해서 띄운다 */}
      {error && (
        <div
          role="alert"
          style={{
            ...S.warn,
            position: "fixed",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 60,
            marginTop: 0,
            boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
          }}
        >
          ⚠️ {error}
          <button
            onClick={() => setError("")}
            style={{ ...S.subBtn, minHeight: 44, marginTop: 8 }}
          >
            확인
          </button>
        </div>
      )}
      {loading && (
        <div
          role="status"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ ...S.card, textAlign: "center", fontSize: 22, fontWeight: 900, marginTop: 0 }}>
            ⏳ 사진을 읽고 있습니다
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>10~30초쯤 걸립니다. 화면을 닫지 마세요.</div>
          </div>
        </div>
      )}

      {/* ───────── 밭 등록 (처음 한 번) ───────── */}
      {ready && (mode === "field" || fields.length === 0) && (
        <>
          <div style={S.card}>
            <b>먼저 어디서 키우는지 알려 주세요</b>
            <div style={{ fontSize: 16, color: "#555" }}>
              작물·넓이·지역을 알아야 라벨에서 내 작물 사용법을 찾고, 필요한 약량과 날씨에 맞는 때를 알려 드립니다. 한 번만 적으면 됩니다.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {FARM_MODES.map((m) => (
              <button
                key={m.mode}
                onClick={() => setFMode(m.mode)}
                style={{ ...chip(fMode === m.mode), flex: 1, borderRadius: 16, padding: "10px 4px" }}
              >
                <div style={{ fontSize: 26 }}>{m.icon}</div>
                {m.mode}
                <div style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>{m.desc}</div>
              </button>
            ))}
          </div>
          <label style={S.label}>{fMode === "베란다" ? "이름" : "밭 이름"}</label>
          <input
            style={S.input}
            data-testid="f-name"
            placeholder={fMode === "베란다" ? "예: 거실 베란다" : fMode === "텃밭" ? "예: 주말농장" : "예: 집 앞 고추밭"}
            value={fName}
            onChange={(e) => setFName(e.target.value)}
          />
          <label style={S.label}>{fMode === "베란다" ? "식물·작물" : "작물"}</label>
          <input
            style={S.input}
            data-testid="f-crop"
            placeholder={fMode === "베란다" ? "예: 방울토마토, 몬스테라" : "예: 고추"}
            value={fCrop}
            onChange={(e) => setFCrop(e.target.value)}
          />
          {fMode === "베란다" ? (
            <>
              <label style={S.label}>화분 개수</label>
              <input
                style={S.input}
                data-testid="f-pots"
                inputMode="numeric"
                placeholder="예: 5"
                value={fPots}
                onChange={(e) => setFPots(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </>
          ) : (
            <>
              <label style={S.label}>면적 (평)</label>
              <input
                style={S.input}
                data-testid="f-area"
                inputMode="numeric"
                placeholder={fMode === "텃밭" ? "예: 5" : "예: 300"}
                value={fArea}
                onChange={(e) => setFArea(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </>
          )}
          {fMode === "농사" && (
            <>
              <label style={S.label}>재배 방식</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {FARM_TYPES.map((t) => (
                  <button key={t} onClick={() => setFType(t)} style={{ ...chip(fType === t), flex: 1 }}>
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
          {fMode !== "베란다" && (
            <>
              <label style={S.label}>지역 (시·군)</label>
              {fRegion ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <span style={chip(true)}>📍 {fRegion.name}</span>
                  <button onClick={() => setFRegion(null)} style={chip(false)}>
                    바꾸기
                  </button>
                </div>
              ) : (
                <>
                  <input
                    style={S.input}
                    data-testid="f-region"
                    placeholder="예: 홍성, 경주, 제주"
                    value={regionQ}
                    onChange={(e) => setRegionQ(e.target.value)}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {searchRegions(regionQ).map((r) => (
                      <button key={r.name} onClick={() => setFRegion(r)} style={chip(false)}>
                        {r.name}
                      </button>
                    ))}
                    <button onClick={locateMe} disabled={locating} style={chip(false)}>
                      {locating ? "위치 찾는 중…" : "📍 지금 있는 곳으로"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          <button style={S.bigBtn} onClick={saveField}>
            💾 저장
          </button>
        </>
      )}

      {/* ───────── 처음 화면 ───────── */}
      {ready && mode === "home" && fields.length > 0 && (
        <>
          <div style={S.card}>
            <div style={{ fontWeight: 900 }}>지금 기록할 곳</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {fields.map((f) => (
                <button key={f.name} onClick={() => chooseField(f.name)} style={chip(curName === f.name)}>
                  {f.name}
                </button>
              ))}
              <button onClick={() => openFieldForm()} style={chip(false)}>
                ＋ 추가
              </button>
            </div>
            {cur && (
              <div style={{ marginTop: 8, color: "#333" }}>
                {fieldLine(cur)}{" "}
                <button
                  onClick={() => openFieldForm(cur)}
                  style={{ border: "none", background: "none", color: GREEN, fontSize: 16, fontWeight: 800 }}
                >
                  고치기
                </button>
              </div>
            )}
          </div>

          {alerts.map((a, i) => (
            <div key={i} style={a.level === "warn" ? S.warn : S.card}>
              <div style={{ fontWeight: 900 }}>
                {a.level === "warn" ? "🔔 " : "📅 "}
                {a.title}
              </div>
              <div style={{ fontWeight: 500, marginTop: 4 }}>{a.body}</div>
              {a.calendarUrl && (
                <a href={a.calendarUrl} target="_blank" rel="noreferrer" style={{ color: GREEN, fontWeight: 800 }}>
                  휴대폰 달력에 알람 넣기
                </a>
              )}
            </div>
          ))}

          {weatherCard}

          <div style={{ ...S.card, border: `2px solid ${GREEN}` }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>💊 약·영양제 사용법</div>
            <div style={{ fontSize: 15, color: "#555" }}>
              상표(앞면)만 찍거나 이름만 넣으면 내 작물 사용법과 약량을 알려 드려요
            </div>
            <PhotoButtons testid="label" disabled={loading} onFile={(f) => void readLabel([f])} />
            <form
              style={{ display: "flex", gap: 8, marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                void searchName(nameQ);
              }}
            >
              <input
                data-testid="name-q"
                value={nameQ}
                onChange={(e) => setNameQ(e.target.value)}
                placeholder="제품 이름 (예: 코니도)"
                enterKeyHint="search"
                style={{ ...S.input, flex: 1, minWidth: 0, marginTop: 0 }}
              />
              <button
                type="button"
                data-testid="name-voice"
                aria-label="말로 넣기"
                disabled={loading || listening}
                onClick={startVoice}
                style={{ ...chip(listening), fontSize: 22, padding: "0 14px" }}
              >
                {listening ? "👂" : "🎤"}
              </button>
              <button type="submit" data-testid="name-go" disabled={loading} style={{ ...chip(true), padding: "0 16px" }}>
                찾기
              </button>
            </form>
            {listening && <div style={{ marginTop: 6, fontWeight: 800 }}>듣고 있어요. 제품 이름을 말해 주세요.</div>}
            {recentProducts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 14, color: "#555" }}>최근 쓴 것</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {recentProducts.map((n) => (
                    <button key={n} style={chip(false)} disabled={loading} onClick={() => void searchName(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            style={S.bigBtn}
            onClick={() => {
              resetForm();
              setMode("growth");
            }}
          >
            🌿 작물 사진 남기기
            <div style={{ fontSize: 15, fontWeight: 600 }}>자라는 모습을 날짜별로 남겨요</div>
          </button>
          <button
            style={S.bigBtn}
            onClick={() => {
              resetForm();
              setMode("work");
            }}
          >
            🚜 오늘 한 일 남기기
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {curMode === "베란다" ? "물주기·분갈이·영양제를 버튼으로 기록해요" : "심기·물주기·비료·수확을 버튼으로 기록해요"}
            </div>
          </button>
          <button style={S.subBtn} onClick={() => setMode("diary")}>
            📖 내 일지 보기 ({entries.length}건)
          </button>
          <Link href="/ai" style={S.linkBtn}>
            🧠 작물이 이상해요 (병해충 진단)
          </Link>
          <p style={{ fontSize: 14, color: "#555", marginTop: 16 }}>
            일지는 이 휴대폰에만 저장됩니다. 사용법과 약량은 공식 등록 자료나 라벨에 적힌 숫자로 계산한 것이니, 치기 전에 라벨을 한 번 더 확인하세요.
          </p>
        </>
      )}

      {/* ───────── 같은 이름의 제품이 여러 개일 때 고르기 ───────── */}
      {mode === "pick" && cur && (
        <>
          {curCard}
          <div style={S.card}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>어느 제품인가요?</div>
            <div style={{ fontSize: 15, color: "#555" }}>
              이름이 같아도 제형과 회사에 따라 사용법이 다릅니다. 포장에 적힌 것과 같은 것을 눌러 주세요.
            </div>
            {candidates.map((p, i) => (
              <button
                key={`${p.product_name}-${p.variant}-${i}`}
                data-testid={`pick-${i}`}
                style={{ ...S.subBtn, textAlign: "left" }}
                onClick={() => showProduct(p, labelFiles)}
              >
                <div style={{ fontWeight: 900 }}>
                  {p.product_name}
                  {p.my_use_index !== null ? ` · ${cur.crop} 등록` : ""}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {[p.category, p.variant].filter(Boolean).join(" · ")}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ───────── 라벨 읽은 결과 ───────── */}
      {mode === "label" && label && cur && (
        <>
          {curCard}
          {!label.readable ? (
            <div style={S.warn}>
              라벨 글씨를 읽지 못했습니다. 밝은 곳에서 제품 이름이 크게 보이게 다시 찍어 주세요.
            </div>
          ) : (
            <div style={S.card}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{label.product_name ?? "제품 이름을 읽지 못함"}</div>
              <div style={{ color: "#555", fontSize: 16 }}>
                {[label.category, label.maker, label.ingredient].filter(Boolean).join(" · ")}
              </div>
              {official && (
                <div data-testid="official-badge" style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: GREEN }}>
                  ✔ 공식 등록 자료{officialSource ? ` (${officialSource})` : ""}
                </div>
              )}
              {label.moa_code && (
                <div style={{ marginTop: 6, fontWeight: 800 }}>계통(작용기작 표시기호): {label.moa_code}</div>
              )}
              {(
                [
                  ["어디에 쓰나", label.summary?.where],
                  ["얼마나 쓰나", label.summary?.how_much],
                  ["언제 치나", label.summary?.when],
                  ["주의할 점", label.summary?.caution],
                ] as const
              ).map(([k, v]) => (
                <div key={k} style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 900, color: GREEN }}>{k}</div>
                  <div style={{ fontSize: 20, color: v ? "#111" : "#888" }}>{v ?? missing}</div>
                </div>
              ))}
              <button style={S.subBtn} onClick={() => speak(label)}>
                🔊 읽어 주기
              </button>
            </div>
          )}

          {chosenUse && (
            <div style={{ ...S.card, border: `2px solid ${GREEN}` }}>
              <div style={{ fontWeight: 900 }}>
                내 {cur.crop} 기준{chosenUse.target ? ` · ${chosenUse.target}` : ""}
              </div>
              {myUses.length > 1 && (
                <div style={{ margin: "8px 0" }}>
                  <div style={{ fontSize: 15, color: "#555" }}>무엇 때문에 치시나요?</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {myUses.map(({ u, i }) => (
                      <button key={i} data-testid={`use-${i}`} style={chip(useIdx === i)} onClick={() => setUseIdx(i)}>
                        {u.target ?? u.crop}
                        {u.dilution ? ` ${u.dilution}` : u.per_10a_amount !== null ? ` ${u.per_10a_amount}${u.per_10a_unit}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                {[
                  chosenUse.dilution && `희석 ${chosenUse.dilution}`,
                  chosenUse.timing,
                  typeof chosenUse.max_count === "number" && `${chosenUse.max_count}회 이내`,
                  typeof chosenUse.phi_days === "number" && `수확 ${chosenUse.phi_days}일 전까지`,
                ]
                  .filter(Boolean)
                  .join(" / ") || missing}
              </div>
              {dose.map((d) => (
                <div key={d} style={{ fontSize: 21, fontWeight: 900, marginTop: 6 }}>
                  🧮 {d}
                </div>
              ))}
              {dose.length === 0 && (
                <div style={{ color: "#888" }}>
                  {official ? "공식 자료에" : "라벨에"} 희석배수·사용량 숫자가 없어 약량은 계산하지 않았습니다.
                </div>
              )}
            </div>
          )}
          {offLabel && (
            <div style={S.warn}>
              {official && label.category === "유기농업자재"
                ? `공식 자료에는 이 자재의 시험 작물(${Array.from(new Set(label.uses.map((u) => u.crop))).slice(0, 4).join(", ")})만 올라 있습니다. ${cur.crop}에 쓰는 양과 방법은 라벨 뒷면을 확인하세요.`
                : official
                ? `공식 등록 자료에서 이 제품의 ${cur.crop} 사용법을 찾지 못했습니다. 이 자료에 빠진 작물도 있으니 라벨 뒷면의 적용 작물을 확인하고, 라벨에도 없으면 쓰지 마세요.`
                : `이 라벨의 사용 표에 ${cur.crop}이(가) 없습니다. 등록되지 않은 작물에는 쓰면 안 되니, 치기 전에 농약사에 꼭 확인하세요.`}
            </div>
          )}
          {label.readable && indoorNote && <div style={S.card}>{indoorNote}</div>}
          {label.readable && weatherCard}

          {label.uses.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight: 900 }}>{official ? "공식 등록 사용 표 (전체)" : "라벨의 사용 표 (전체)"}</div>
              {label.uses.map((u, i) => (
                <div key={i} style={{ borderTop: i ? "1px solid #e5e7eb" : "none", padding: "8px 0", fontSize: 17 }}>
                  <b>{u.crop}</b>
                  {u.target ? ` · ${u.target}` : ""}
                  <div>
                    {[
                      u.dilution && `희석 ${u.dilution}`,
                      u.timing,
                      typeof u.max_count === "number" && `${u.max_count}회 이내`,
                      typeof u.phi_days === "number" && `수확 ${u.phi_days}일 전까지`,
                    ]
                      .filter(Boolean)
                      .join(" / ") || missing}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!official && (label.need_more || label.uses.length === 0) && labelFiles.length < 2 && (
            <div style={S.card}>
              <b>{label.need_more ?? "사용법 표가 있는 면을 한 장 더 넣어 주세요"}</b>
              <PhotoButtons
                testid="more"
                disabled={loading}
                onFile={(f) => void readLabel(labelFiles[0] ? [labelFiles[0], f] : [f], true)}
              />
            </div>
          )}
          {official && (offLabel || (chosenUse && dose.length === 0)) && (
            <div style={S.card}>
              <b>라벨 뒷면의 사용법 표를 한 장 찍으면 라벨에 적힌 대로 다시 알려 드려요</b>
              <PhotoButtons testid="more" disabled={loading} onFile={(f) => void readLabel([f], true)} />
            </div>
          )}

          {label.readable && (
            <button style={S.bigBtn} onClick={() => setMode("record")}>
              ✅ {label.category === "비료" || label.category === "영양제" ? "오늘 이것 줬어요" : "오늘 이 약 쳤어요"} (기록하기)
            </button>
          )}
        </>
      )}

      {/* ───────── 살포 기록 입력 ───────── */}
      {mode === "record" && label && cur && (
        <>
          <div style={S.card}>
            <b>{label.product_name}</b> · 오늘({niceDate(today())}) · {cur.name}
          </div>

          {label.uses.length > 0 && (
            <>
              <label style={S.label}>어디에 쳤나요?</label>
              <select style={S.input} value={useIdx} onChange={(e) => setUseIdx(Number(e.target.value))}>
                <option value={-1}>고르기</option>
                {label.uses.map((u, i) => (
                  <option key={i} value={i}>
                    {u.crop}
                    {u.target ? ` · ${u.target}` : ""}
                  </option>
                ))}
                <option value={-2}>이 목록에 없음</option>
              </select>
            </>
          )}
          {offLabel && (
            <div style={S.warn}>
              라벨의 사용 표에 없는 작물·병해충입니다. 등록되지 않은 작물에 쓰면 안 되니, 치기 전에 농약사에 꼭 확인하세요.
            </div>
          )}
          {rotation && <div style={S.warn}>🔁 {rotation}</div>}
          {overCount && chosenUse && (
            <div style={S.warn}>
              이 밭에 올해 이미 {usedCount}번 기록했습니다. 라벨의 사용 횟수는 {chosenUse.max_count}회 이내입니다.
            </div>
          )}

          {chosenUse?.dilution_x ? (
            <>
              <label style={S.label}>물 몇 리터에 타나요?</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {tankPresets(curMode).map((v) => (
                  <button key={v} onClick={() => setTankL(v)} style={{ ...chip(tankL === v), flex: 1 }}>
                    {v}L
                  </button>
                ))}
              </div>
              <input
                style={S.input}
                inputMode="numeric"
                value={tankL}
                onChange={(e) => setTankL(e.target.value.replace(/[^0-9.]/g, ""))}
              />
              {dose.map((d) => (
                <div key={d} style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
                  🧮 {d}
                </div>
              ))}
            </>
          ) : null}

          <label style={S.label}>실제로 얼마나 쳤나요?</label>
          <input
            style={S.input}
            placeholder={curMode === "농사" ? "예: 20리터 3통" : "예: 분무기 1통"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label style={S.label}>다음 방제 알림</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {[0, 7, 10, 14].map((d) => (
              <button key={d} onClick={() => setNextDays(d)} style={{ ...chip(nextDays === d), flex: 1 }}>
                {d === 0 ? "안 함" : `${d}일 뒤`}
              </button>
            ))}
          </div>

          <label style={S.label}>메모 (자판의 마이크로 말해도 됩니다)</label>
          <input style={S.input} value={memo} onChange={(e) => setMemo(e.target.value)} />

          <button style={S.bigBtn} onClick={() => void saveSpray()}>
            💾 일지에 저장
          </button>
        </>
      )}

      {/* ───────── 작물 사진 ───────── */}
      {mode === "growth" && cur && (
        <>
          {curCard}
          <label style={S.label}>메모 (자판의 마이크로 말해도 됩니다)</label>
          <input
            style={S.input}
            placeholder="예: 꽃이 피기 시작"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <PhotoButtons testid="growth" disabled={loading} onFile={(f) => void savePhoto("growth", f)} />
        </>
      )}

      {/* ───────── 오늘 한 일 ───────── */}
      {mode === "work" && cur && (
        <>
          {curCard}
          <label style={S.label}>오늘 무슨 일을 했나요?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {worksFor(curMode).map((w) => (
              <button key={w} onClick={() => setWork(w)} style={chip(work === w)}>
                {w}
              </button>
            ))}
          </div>
          <label style={S.label}>메모 (자판의 마이크로 말해도 됩니다)</label>
          <input
            style={S.input}
            placeholder="예: 복합비료 2포"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <PhotoButtons
            testid="work"
            disabled={loading}
            guard={() => {
              if (!work) {
                setError("어떤 일을 했는지 골라 주세요.");
                return false;
              }
              return true;
            }}
            onFile={(f) => void savePhoto("work", f)}
          />
          <button style={S.subBtn} disabled={loading} onClick={() => void savePhoto("work", null)}>
            사진 없이 저장
          </button>
        </>
      )}

      {/* ───────── 저장 완료 ───────── */}
      {mode === "saved" && saved && (
        <>
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>✅ 일지에 남겼습니다</div>
            <div>
              {niceDate(saved.date)} · {saved.field}
              {saved.product ? ` · ${saved.product}` : ""}
              {saved.work ? ` · ${saved.work}` : ""}
            </div>
          </div>

          {saved.kind === "spray" && typeof saved.phiDays === "number" && saved.phiDays > 0 && (
            <div style={S.card}>
              <b>📅 수확은 {niceDate(addDays(saved.date, saved.phiDays))}부터</b>
              <div>라벨 기준: 수확 {saved.phiDays}일 전까지 사용</div>
            </div>
          )}

          {saved.nextDate && (
            <div style={S.card}>
              <b>🔔 다음 방제 예정일: {niceDate(saved.nextDate)}</b>
              {saved.moa && (saved.category === "살충제" || saved.category === "살균제") && (
                <div>오늘은 {saved.moa} 계통을 쳤으니, 다음에는 표시기호가 다른 약을 고르세요.</div>
              )}
              <a
                href={calendarUrl(
                  `${saved.field} 방제하는 날`,
                  saved.nextDate,
                  `포토닥터 농사일지: 지난번 ${saved.product ?? ""}${saved.moa ? ` (${saved.moa} 계통)` : ""}. 이번에는 다른 계통으로 바꿔 치세요.`
                )}
                target="_blank"
                rel="noreferrer"
                style={S.linkBtn}
              >
                휴대폰 달력에 알람 넣기
              </a>
            </div>
          )}

          {saved.kind === "spray" &&
            recommendFor(saved.category, curMode).map((p) => (
              <div key={p.name} style={S.card}>
                <span style={{ fontSize: 13, background: "#e5e7eb", borderRadius: 6, padding: "2px 6px" }}>광고</span>
                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>{p.name}</div>
                <div style={{ color: "#555" }}>{p.note} · 한국농수산TV 협찬 제품</div>
                <a href={p.url} target="_blank" rel="noreferrer" style={S.linkBtn}>
                  제품 보기·구매 상담
                </a>
              </div>
            ))}

          <button style={S.bigBtn} onClick={goHome}>
            처음으로
          </button>
          <button
            style={S.subBtn}
            onClick={() => {
              setDiaryField(saved.field);
              setMode("diary");
            }}
          >
            📖 이 밭 일지 보기
          </button>
        </>
      )}

      {/* ───────── 일지 ───────── */}
      {mode === "diary" && (
        <>
          <select style={S.input} value={diaryField} onChange={(e) => setDiaryField(e.target.value)}>
            <option value="">모든 밭</option>
            {Array.from(new Set(entries.map((e) => e.field))).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {entries.length === 0 && <div style={S.card}>아직 기록이 없습니다. 사진을 찍어 보세요.</div>}
          {entries
            .filter((e) => !diaryField || e.field === diaryField)
            .map((e) => (
              <div key={e.id} style={{ ...S.card, display: "flex", gap: 12 }}>
                {e.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.thumb}
                    alt=""
                    style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900 }}>
                    {niceDate(e.date)} · {e.field}
                    {e.crop ? ` (${e.crop})` : ""}
                  </div>
                  {e.kind === "spray" ? (
                    <div>
                      💊 {e.product}
                      {e.moa ? ` [${e.moa}]` : ""}
                      {e.amount ? ` · ${e.amount}` : ""}
                      {e.target ? ` · ${e.target}` : ""}
                    </div>
                  ) : (
                    <div>{e.kind === "growth" ? "🌿 작물 사진" : e.work ?? "🚜 작업"}</div>
                  )}
                  {e.memo && <div style={{ color: "#555" }}>{e.memo}</div>}
                  <button
                    onClick={() => void removeEntry(e.id)}
                    style={{ border: "none", background: "none", color: "#b91c1c", fontSize: 15, padding: "6px 0" }}
                  >
                    지우기
                  </button>
                </div>
              </div>
            ))}
          {entries.length > 0 && (
            <button style={S.subBtn} onClick={downloadCsv}>
              📄 영농일지 파일로 내려받기
            </button>
          )}
        </>
      )}
    </main>
  );
}

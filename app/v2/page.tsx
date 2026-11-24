"use client";

// 포토닥터 2 — 사진만 찍으면 농사일지가 되는 화면
// 기존 진단 화면(/)은 건드리지 않고 /v2 에 따로 둔다.

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  blobToDataUrl,
  deleteEntry,
  getCurrentField,
  getEntries,
  getFields,
  newId,
  putEntry,
  saveFields,
  setCurrentField,
  shrinkImage,
} from "./lib/store";
import type { Entry, FarmType, Field } from "./lib/store";
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
  toCsv,
  today,
} from "./lib/logic";

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
};

type Mode = "home" | "field" | "label" | "record" | "saved" | "growth" | "work" | "diary";

const GREEN = "#16a34a";
const NOT_ON_LABEL = "라벨에서 확인되지 않음";
const FARM_TYPES: FarmType[] = ["노지", "시설하우스", "스마트팜"];
const WORKS = [
  "🌱 심기·씨뿌리기",
  "💧 물주기",
  "🧺 거름·비료 주기",
  "🌿 풀 뽑기",
  "✂️ 가지치기·순지르기",
  "🍎 수확",
  "📝 그 밖의 일",
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

function fieldLine(f: Field): string {
  return [f.crop, f.area ? `${f.area}평` : "", f.type ?? ""].filter(Boolean).join(" · ");
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

  // 라벨 읽기
  const [label, setLabel] = useState<Label | null>(null);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [thumb, setThumb] = useState("");

  // 기록 입력
  const [useIdx, setUseIdx] = useState(-1);
  const [tankL, setTankL] = useState("20");
  const [amount, setAmount] = useState("");
  const [nextDays, setNextDays] = useState(0);
  const [memo, setMemo] = useState("");
  const [work, setWork] = useState("");
  const [saved, setSaved] = useState<Entry | null>(null);
  const [diaryField, setDiaryField] = useState("");

  const labelInput = useRef<HTMLInputElement>(null);
  const moreInput = useRef<HTMLInputElement>(null);
  const growthInput = useRef<HTMLInputElement>(null);
  const workInput = useRef<HTMLInputElement>(null);

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
  const alerts = useMemo(() => buildAlerts(entries), [entries]);

  function resetForm() {
    setLabel(null);
    setLabelFiles([]);
    setThumb("");
    setUseIdx(-1);
    setTankL("20");
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
    setError("");
    setMode("field");
  }

  function saveField() {
    const name = fName.trim();
    const crop = fCrop.trim();
    if (!name || !crop) {
      setError("밭 이름과 작물은 꼭 적어 주세요.");
      return;
    }
    const area = Number(fArea);
    const next: Field[] = [
      { name, crop, area: area > 0 ? area : undefined, type: fType },
      ...fields.filter((f) => f.name !== name),
    ];
    setFields(next);
    saveFields(next);
    chooseField(name);
    setError("");
    setMode("home");
  }

  // ───── 라벨 사진 → AI 읽기 ─────
  async function readLabel(files: File[]) {
    if (files.length === 0 || !cur) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      for (const f of files.slice(0, 2)) {
        form.append("images", await shrinkImage(f, 1400, 0.8), "label.jpg");
      }
      form.append("crop", cur.crop);
      form.append("farmType", cur.type ?? "");
      setThumb(await blobToDataUrl(await shrinkImage(files[0], 480, 0.6)));
      const res = await fetch("/api/v2/label", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "라벨을 읽지 못했습니다.");
      const raw = data.label as Label;
      const uses = Array.isArray(raw.uses) ? raw.uses : [];
      const ai = raw.my_use_index;
      const idx =
        typeof ai === "number" && ai >= 0 && ai < uses.length
          ? ai
          : matchUseIndex(uses, cur.crop);
      setLabel({ ...raw, uses });
      setUseIdx(idx >= 0 ? idx : uses.length > 0 ? -2 : -1);
      setLabelFiles(files.slice(0, 2));
      setMode("label");
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
  const dose = chosenUse ? doseLines(chosenUse, cur?.area, Number(tankL) || 0) : [];
  const rotation =
    label && cur ? rotationWarning(entries, cur.name, label.category, label.moa_code) : null;
  const usedCount =
    label?.product_name && cur ? sprayCount(entries, cur.name, label.product_name) : 0;
  const overCount =
    !!chosenUse && typeof chosenUse.max_count === "number" && usedCount >= chosenUse.max_count;
  const indoor = cur?.type === "시설하우스" || cur?.type === "스마트팜";

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
        thumb: file ? await blobToDataUrl(await shrinkImage(file, 640, 0.65)) : undefined,
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

      {error && <div style={S.warn}>{error}</div>}
      {loading && (
        <div style={{ ...S.card, textAlign: "center", fontWeight: 800 }}>
          읽는 중입니다… 잠시만 기다려 주세요
        </div>
      )}

      {/* ───────── 밭 등록 (처음 한 번) ───────── */}
      {ready && (mode === "field" || fields.length === 0) && (
        <>
          <div style={S.card}>
            <b>먼저 내 밭을 알려 주세요</b>
            <div style={{ fontSize: 16, color: "#555" }}>
              작물과 평수를 알아야 라벨에서 내 작물 사용법을 찾고, 내 밭에 필요한 약량을 계산해 드립니다. 한 번만 적으면 됩니다.
            </div>
          </div>
          <label style={S.label}>밭 이름</label>
          <input
            style={S.input}
            placeholder="예: 집 앞 고추밭"
            value={fName}
            onChange={(e) => setFName(e.target.value)}
          />
          <label style={S.label}>작물</label>
          <input
            style={S.input}
            placeholder="예: 고추"
            value={fCrop}
            onChange={(e) => setFCrop(e.target.value)}
          />
          <label style={S.label}>면적 (평)</label>
          <input
            style={S.input}
            inputMode="numeric"
            placeholder="예: 300"
            value={fArea}
            onChange={(e) => setFArea(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <label style={S.label}>재배 방식</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {FARM_TYPES.map((t) => (
              <button key={t} onClick={() => setFType(t)} style={{ ...chip(fType === t), flex: 1 }}>
                {t}
              </button>
            ))}
          </div>
          <button style={S.bigBtn} onClick={saveField}>
            💾 밭 저장
          </button>
        </>
      )}

      {/* ───────── 처음 화면 ───────── */}
      {ready && mode === "home" && fields.length > 0 && (
        <>
          <div style={S.card}>
            <div style={{ fontWeight: 900 }}>지금 기록할 밭</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {fields.map((f) => (
                <button key={f.name} onClick={() => chooseField(f.name)} style={chip(curName === f.name)}>
                  {f.name}
                </button>
              ))}
              <button onClick={() => openFieldForm()} style={chip(false)}>
                ＋ 밭 추가
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

          <input
            ref={labelInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            data-testid="label-input"
            onChange={(e) => {
              const f = Array.from(e.target.files ?? []);
              e.target.value = "";
              void readLabel(f);
            }}
          />
          <button style={S.bigBtn} disabled={loading} onClick={() => labelInput.current?.click()}>
            💊 약·영양제 찍기
            <div style={{ fontSize: 15, fontWeight: 600 }}>라벨을 찍으면 내 작물 사용법과 약량을 알려 드려요</div>
          </button>
          <button
            style={S.bigBtn}
            onClick={() => {
              resetForm();
              setMode("growth");
            }}
          >
            🌿 작물 찍기
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
            <div style={{ fontSize: 15, fontWeight: 600 }}>심기·물주기·비료·수확을 버튼으로 기록해요</div>
          </button>
          <button style={S.subBtn} onClick={() => setMode("diary")}>
            📖 내 농사일지 보기 ({entries.length}건)
          </button>
          <Link href="/" style={S.linkBtn}>
            🧠 작물이 이상해요 (병해충 진단)
          </Link>
          <p style={{ fontSize: 14, color: "#555", marginTop: 16 }}>
            일지는 이 휴대폰에만 저장됩니다. 사용법과 약량은 라벨에 적힌 숫자로 계산한 것이니, 치기 전에 라벨을 한 번 더 확인하세요.
          </p>
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
                  <div style={{ fontSize: 20, color: v ? "#111" : "#888" }}>{v ?? NOT_ON_LABEL}</div>
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
              <div>
                {[
                  chosenUse.dilution && `희석 ${chosenUse.dilution}`,
                  chosenUse.timing,
                  typeof chosenUse.max_count === "number" && `${chosenUse.max_count}회 이내`,
                  typeof chosenUse.phi_days === "number" && `수확 ${chosenUse.phi_days}일 전까지`,
                ]
                  .filter(Boolean)
                  .join(" / ") || NOT_ON_LABEL}
              </div>
              {dose.map((d) => (
                <div key={d} style={{ fontSize: 21, fontWeight: 900, marginTop: 6 }}>
                  🧮 {d}
                </div>
              ))}
              {dose.length === 0 && (
                <div style={{ color: "#888" }}>라벨에 희석배수·사용량 숫자가 없어 약량은 계산하지 않았습니다.</div>
              )}
            </div>
          )}
          {offLabel && (
            <div style={S.warn}>
              이 라벨의 사용 표에 {cur.crop}이(가) 없습니다. 등록되지 않은 작물에는 쓰면 안 되니, 치기 전에 농약사에 꼭 확인하세요.
            </div>
          )}
          {label.readable && indoor && (
            <div style={S.card}>
              🏠 {cur.type}에서는 마스크와 보호구를 쓰고, 뿌린 뒤 충분히 환기한 다음 들어가세요.
            </div>
          )}

          {label.uses.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight: 900 }}>라벨의 사용 표 (전체)</div>
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
                      .join(" / ") || NOT_ON_LABEL}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(label.need_more || label.uses.length === 0) && labelFiles.length < 2 && (
            <>
              <input
                ref={moreInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void readLabel([labelFiles[0], f]);
                }}
              />
              <button style={S.subBtn} disabled={loading} onClick={() => moreInput.current?.click()}>
                📷 {label.need_more ?? "사용법 표가 있는 면을 한 장 더 찍기"}
              </button>
            </>
          )}

          {label.readable && (
            <button style={S.bigBtn} onClick={() => setMode("record")}>
              ✅ 오늘 이 약 쳤어요 (기록하기)
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
                {["20", "100", "500"].map((v) => (
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
            placeholder="예: 20리터 3통"
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
          <input
            ref={growthInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            data-testid="growth-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void savePhoto("growth", f);
            }}
          />
          <button style={S.bigBtn} disabled={loading} onClick={() => growthInput.current?.click()}>
            📷 작물 사진 찍기
          </button>
        </>
      )}

      {/* ───────── 오늘 한 일 ───────── */}
      {mode === "work" && cur && (
        <>
          {curCard}
          <label style={S.label}>오늘 무슨 일을 했나요?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {WORKS.map((w) => (
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
          <input
            ref={workInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void savePhoto("work", f);
            }}
          />
          <button
            style={S.bigBtn}
            disabled={loading}
            onClick={() => {
              if (!work) {
                setError("어떤 일을 했는지 골라 주세요.");
                return;
              }
              workInput.current?.click();
            }}
          >
            📷 사진 찍고 저장
          </button>
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
            recommendFor(saved.category).map((p) => (
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

"use client";

// 포토닥터 2 — 사진만 찍으면 농사일지가 되는 화면
// 기존 진단 화면(/)은 건드리지 않고 /v2 에 따로 둔다.

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  blobToDataUrl,
  deleteEntry,
  getEntries,
  getFields,
  newId,
  putEntry,
  saveFields,
  shrinkImage,
} from "./lib/store";
import type { Entry, EntryKind, Field } from "./lib/store";
import {
  addDays,
  buildAlerts,
  calendarUrl,
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
};

type Mode = "home" | "label" | "record" | "saved" | "photo" | "diary";

const GREEN = "#16a34a";
const NOT_ON_LABEL = "라벨에서 확인되지 않음";

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
};

export default function PhotoDoctorV2() {
  const [mode, setMode] = useState<Mode>("home");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 라벨 읽기
  const [label, setLabel] = useState<Label | null>(null);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [thumb, setThumb] = useState<string>("");

  // 기록 입력
  const [fieldName, setFieldName] = useState("");
  const [crop, setCrop] = useState("");
  const [useIdx, setUseIdx] = useState(-1);
  const [amount, setAmount] = useState("");
  const [nextDays, setNextDays] = useState(0);
  const [memo, setMemo] = useState("");
  const [photoKind, setPhotoKind] = useState<EntryKind>("growth");
  const [saved, setSaved] = useState<Entry | null>(null);
  const [diaryField, setDiaryField] = useState("");

  const labelInput = useRef<HTMLInputElement>(null);
  const moreInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFields(getFields());
    getEntries()
      .then(setEntries)
      .catch(() => setError("이 휴대폰에서는 일지를 저장할 수 없습니다."));
  }, []);

  const alerts = useMemo(() => buildAlerts(entries), [entries]);

  function resetForm() {
    setLabel(null);
    setLabelFiles([]);
    setThumb("");
    setUseIdx(-1);
    setAmount("");
    setNextDays(0);
    setMemo("");
    setError("");
  }

  function goHome() {
    resetForm();
    setSaved(null);
    setMode("home");
  }

  function pickField(name: string) {
    setFieldName(name);
    const f = fields.find((x) => x.name === name);
    if (f) setCrop(f.crop);
  }

  function rememberField(name: string, cropName: string) {
    const rest = fields.filter((f) => f.name !== name);
    const next = [{ name, crop: cropName }, ...rest];
    setFields(next);
    saveFields(next);
  }

  // ───── 라벨 사진 → AI 읽기 ─────
  async function readLabel(files: File[]) {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      for (const f of files.slice(0, 2)) {
        form.append("images", await shrinkImage(f, 1400, 0.8), "label.jpg");
      }
      setThumb(await blobToDataUrl(await shrinkImage(files[0], 480, 0.6)));
      const res = await fetch("/api/v2/label", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "라벨을 읽지 못했습니다.");
      const l = data.label as Label;
      setLabel({ ...l, uses: Array.isArray(l.uses) ? l.uses : [] });
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

  // ───── 기록 저장 ─────
  const chosenUse = label && useIdx >= 0 ? label.uses[useIdx] : null;
  const offLabel = !!label && label.uses.length > 0 && useIdx === -2;
  const rotation =
    label && fieldName
      ? rotationWarning(entries, fieldName, label.category, label.moa_code)
      : null;
  const usedCount =
    label?.product_name && fieldName
      ? sprayCount(entries, fieldName, label.product_name)
      : 0;
  const overCount =
    !!chosenUse &&
    typeof chosenUse.max_count === "number" &&
    usedCount >= chosenUse.max_count;

  async function saveSpray() {
    if (!label) return;
    if (!fieldName.trim()) {
      setError("어느 밭인지 적어 주세요.");
      return;
    }
    const date = today();
    const entry: Entry = {
      id: newId(),
      createdAt: Date.now(),
      date,
      kind: "spray",
      field: fieldName.trim(),
      crop: (chosenUse?.crop || crop).trim(),
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
    rememberField(entry.field, entry.crop);
    setEntries(await getEntries());
    setSaved(entry);
    setMode("saved");
  }

  async function savePhoto(file: File) {
    if (!fieldName.trim()) {
      setError("어느 밭인지 먼저 적어 주세요.");
      return;
    }
    setLoading(true);
    try {
      const entry: Entry = {
        id: newId(),
        createdAt: Date.now(),
        date: today(),
        kind: photoKind,
        field: fieldName.trim(),
        crop: crop.trim(),
        thumb: await blobToDataUrl(await shrinkImage(file, 640, 0.65)),
        memo: memo.trim() || undefined,
      };
      await putEntry(entry);
      rememberField(entry.field, entry.crop);
      setEntries(await getEntries());
      setSaved(entry);
      setMode("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 저장하지 못했습니다.");
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

  // ───── 화면 조각 ─────
  const fieldPicker = (
    <>
      <label style={S.label}>어느 밭인가요?</label>
      {fields.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {fields.map((f) => (
            <button
              key={f.name}
              onClick={() => pickField(f.name)}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: `2px solid ${fieldName === f.name ? GREEN : "#cbd5e1"}`,
                background: fieldName === f.name ? "#dcfce7" : "#fff",
                fontSize: 17,
                fontWeight: 800,
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      <input
        style={S.input}
        placeholder="밭 이름 (예: 집 앞 고추밭)"
        value={fieldName}
        onChange={(e) => setFieldName(e.target.value)}
      />
      <input
        style={S.input}
        placeholder="작물 (예: 고추)"
        value={crop}
        onChange={(e) => setCrop(e.target.value)}
      />
    </>
  );

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {mode !== "home" && (
        <button
          onClick={goHome}
          style={{ ...S.subBtn, width: "auto", minHeight: 44, marginTop: 0, padding: "0 14px" }}
        >
          ← 처음
        </button>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🌱 포토닥터 농사일지</h1>
    </div>
  );

  return (
    <main style={S.wrap}>
      {header}

      {error && <div style={S.warn}>{error}</div>}
      {loading && (
        <div style={{ ...S.card, textAlign: "center", fontWeight: 800 }}>
          읽는 중입니다… 잠시만 기다려 주세요
        </div>
      )}

      {/* ───────── 처음 화면 ───────── */}
      {mode === "home" && (
        <>
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
            onChange={(e) => {
              const f = Array.from(e.target.files ?? []);
              e.target.value = "";
              void readLabel(f);
            }}
          />
          <button style={S.bigBtn} disabled={loading} onClick={() => labelInput.current?.click()}>
            💊 약·영양제 찍기
            <div style={{ fontSize: 15, fontWeight: 600 }}>라벨을 찍으면 사용법을 알려 드려요</div>
          </button>
          <button
            style={S.bigBtn}
            onClick={() => {
              resetForm();
              setPhotoKind("growth");
              setMode("photo");
            }}
          >
            🌿 작물 찍기
            <div style={{ fontSize: 15, fontWeight: 600 }}>자라는 모습을 날짜별로 남겨요</div>
          </button>
          <button
            style={S.bigBtn}
            onClick={() => {
              resetForm();
              setPhotoKind("work");
              setMode("photo");
            }}
          >
            🚜 작업 찍기
            <div style={{ fontSize: 15, fontWeight: 600 }}>오늘 한 일을 사진으로 남겨요</div>
          </button>
          <button style={S.subBtn} onClick={() => setMode("diary")}>
            📖 내 농사일지 보기 ({entries.length}건)
          </button>
          <Link href="/" style={{ ...S.subBtn, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            🧠 작물이 이상해요 (병해충 진단)
          </Link>
          <p style={{ fontSize: 14, color: "#555", marginTop: 16 }}>
            일지는 이 휴대폰에만 저장됩니다. 사용법 설명은 라벨에 적힌 내용을 옮긴 것이니,
            치기 전에 라벨을 한 번 더 확인하세요.
          </p>
        </>
      )}

      {/* ───────── 라벨 읽은 결과 ───────── */}
      {mode === "label" && label && (
        <>
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

          {label.uses.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight: 900 }}>라벨의 사용 표</div>
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
      {mode === "record" && label && (
        <>
          <div style={S.card}>
            <b>{label.product_name}</b> · 오늘({niceDate(today())}) 사용
          </div>
          {fieldPicker}

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

          <label style={S.label}>얼마나 쳤나요?</label>
          <input
            style={S.input}
            placeholder="예: 20리터 한 통"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label style={S.label}>다음 방제 알림</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {[0, 7, 10, 14].map((d) => (
              <button
                key={d}
                onClick={() => setNextDays(d)}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 12,
                  border: `2px solid ${nextDays === d ? GREEN : "#cbd5e1"}`,
                  background: nextDays === d ? "#dcfce7" : "#fff",
                  fontSize: 17,
                  fontWeight: 800,
                }}
              >
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

      {/* ───────── 작물·작업 사진 ───────── */}
      {mode === "photo" && (
        <>
          {fieldPicker}
          <label style={S.label}>메모 (자판의 마이크로 말해도 됩니다)</label>
          <input
            style={S.input}
            placeholder={photoKind === "growth" ? "예: 꽃이 피기 시작" : "예: 비닐 씌우기"}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void savePhoto(f);
            }}
          />
          <button
            style={S.bigBtn}
            disabled={loading}
            onClick={() => {
              if (!fieldName.trim()) {
                setError("어느 밭인지 먼저 적어 주세요.");
                return;
              }
              setError("");
              photoInput.current?.click();
            }}
          >
            📷 {photoKind === "growth" ? "작물 사진 찍기" : "작업 사진 찍기"}
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
                style={{ ...S.subBtn, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
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
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.subBtn, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                >
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
                    <div>{e.kind === "growth" ? "🌿 작물 사진" : "🚜 작업"}</div>
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

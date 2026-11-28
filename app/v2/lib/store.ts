// 포토닥터 2 — 사진 농사일지 저장소
// 일지는 농민 휴대폰(IndexedDB)에만 저장한다. 서버 비용 0원, 로그인 불필요.

export type EntryKind = "spray" | "growth" | "work" | "diag";

export type Entry = {
  id: string;
  createdAt: number;
  date: string; // YYYY-MM-DD (휴대폰 현지 날짜)
  kind: EntryKind;
  field: string; // 밭 이름
  crop: string;
  thumb?: string; // 작은 사진(dataURL)
  memo?: string;
  work?: string; // 작업 종류 (심기·물주기·수확 등)
  // 아래는 약·영양제 기록(spray)일 때만
  product?: string;
  category?: string; // 살충제 | 살균제 | 제초제 | 영양제 | 비료 | 기타
  moa?: string | null; // 작용기작 표시기호 (라벨에 적힌 그대로)
  ingredient?: string | null;
  target?: string | null; // 대상 병해충
  amount?: string;
  phiDays?: number | null; // 수확 며칠 전까지 사용
  maxCount?: number | null; // 라벨의 사용 횟수 한도
  nextDate?: string | null; // 다음 방제 예정일
};

export type FarmType = "노지" | "시설하우스" | "스마트팜";

// 밭 정보: 작물·면적·재배 방식을 알아야 라벨에서 내 작물 줄을 찾고 약량을 계산할 수 있다
export type FarmMode = "농사" | "텃밭" | "베란다";

export type Field = {
  name: string;
  crop: string;
  mode?: FarmMode; // 없으면 농사
  area?: number; // 평 (농사·텃밭)
  pots?: number; // 화분 개수 (베란다)
  type?: FarmType; // 재배 방식 (농사)
  region?: string; // 시·군
  lat?: number;
  lon?: number;
  sprayer?: Sprayer; // 기본으로 쓰는 통의 종류
  tankL?: number; // 그 통의 크기(L)
  rigs?: Rig[]; // 이 밭에서 쓰는 장비 전부 (등짐 + 드론처럼 여러 개)
  waterPer10a?: number; // 이 밭에서 실제로 쓴 물량에서 배운 값 (10a당 L)
};

/** 약 치는 도구. 드론은 희석배수·살포량 체계가 달라 따로 다룬다 */
export type Sprayer = "등짐" | "동력" | "드론" | "분무기";

/** 농민이 실제로 쓰는 장비 한 대 */
export type Rig = { sprayer: Sprayer; tankL: number };

const DB_NAME = "photodoctor2";
const STORE = "entries";
const FIELDS_KEY = "pd2_fields";
const CUR_KEY = "pd2_cur_field";

export function getCurrentField(): string {
  try {
    return localStorage.getItem(CUR_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setCurrentField(name: string): void {
  try {
    localStorage.setItem(CUR_KEY, name);
  } catch {
    /* 무시 */
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getEntries(): Promise<Entry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as Entry[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function putEntry(e: Entry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(e);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getFields(): Field[] {
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Field[]) : [];
  } catch {
    return [];
  }
}

export function saveFields(fields: Field[]): void {
  try {
    localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
  } catch {
    /* 저장 공간이 막힌 휴대폰에서는 밭 목록만 다시 입력하면 된다 */
  }
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 사진을 줄여서 Blob으로 (AI 전송용·썸네일용) */
export async function shrinkImage(
  file: File,
  maxSide: number,
  quality: number
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("사진을 열 수 없습니다"));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진 처리를 할 수 없습니다");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("사진 변환 실패"))),
        "image/jpeg",
        quality
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** 일지에 넣을 작은 사진. 휴대폰이 못 여는 형식(HEIC 등)이면 사진 없이 기록만 남긴다 */
export async function safeThumb(file: Blob, maxSide: number, quality: number): Promise<string | undefined> {
  try {
    return await blobToDataUrl(await shrinkImage(file as File, maxSide, quality));
  } catch {
    return undefined;
  }
}

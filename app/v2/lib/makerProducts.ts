// app/v2/lib/makerProducts.ts
// 공식 등록 자료(농약·유기농업자재)에 없는 영양제·비료는 제조사가 낸 자료로 안내한다.
// 숫자는 제조사 카탈로그에 적힌 그대로만 넣는다. 출처를 화면에 표시한다.
import type { OfficialProduct, OfficialUse } from "./official";

type MakerEntry = {
  name: string;
  aliases: string[]; // 사진·말로 넣을 때 나올 수 있는 다른 표기
  maker: string;
  category: string;
  ingredient: string;
  source: string;
  crops: string; // 카탈로그의 대상 작물 설명
  uses: { way: string; dilution_x: number | null; per_10a_amount: number | null; per_10a_unit: string | null; timing: string }[];
  caution: string;
};

const ENTRIES: MakerEntry[] = [
  {
    name: "아미65",
    aliases: ["아미 65", "아미육오", "아미육십오", "ami65", "ami 65"],
    maker: "㈜도프",
    category: "영양제",
    ingredient: "총 아미노산 65% (유리아미노산 40%, 펩타이드 아미노산 25%)",
    source: "도프 2025 카탈로그 93쪽",
    crops: "과채류·엽근채류·과수류·벼·보리·밀·옥수수·인삼 등 기타 작물",
    uses: [
      {
        way: "잎에 뿌리기(엽면시비)",
        dilution_x: 1000,
        per_10a_amount: null,
        per_10a_unit: null,
        timing:
          "육묘기·뿌리 활착기·개화 전후·착과 후 비대기·생육 부진·스트레스 때 · 생육 단계마다 1회, 문제가 생기면 7일 간격 2~3회",
      },
      {
        way: "물 줄 때 섞어 주기(관주)",
        dilution_x: null,
        per_10a_amount: 1,
        per_10a_unit: "L",
        timing: "300평당 1L · 5~7일 간격 2회",
      },
    ],
    caution:
      "권장량보다 진하게 쓰면 생장이 억제될 수 있습니다 · 점도가 있으니 저온에 두지 마세요 · 수세가 좋아지면 양을 줄이세요",
  },
];

const norm = (v: string): string => v.replace(/\s+/g, "").toLowerCase();

/** 제조사 자료에 있는 제품을 찾는다. 이름이 같거나 검색어가 이름의 일부일 때만 */
export function findMakerProducts(rawName: string, crop = ""): OfficialProduct[] {
  const q = norm(rawName);
  if (q.length < 2) return [];
  const out: OfficialProduct[] = [];
  for (const e of ENTRIES) {
    const names = [e.name, ...e.aliases].map(norm);
    if (!names.some((n) => n === q || n.includes(q))) continue;
    const cropName = crop.trim() || "모든 작물";
    const uses: OfficialUse[] = e.uses.map((u) => ({
      crop: cropName,
      target: u.way,
      dilution: u.dilution_x ? `${u.dilution_x.toLocaleString("ko-KR")}배` : null,
      dilution_x: u.dilution_x,
      per_10a_amount: u.per_10a_amount,
      per_10a_unit: u.per_10a_unit,
      spray_l_per_10a: null,
      timing: u.timing,
      max_count: null,
      phi_days: null,
    }));
    const first = e.uses[0];
    out.push({
      readable: true,
      need_more: null,
      source: "official",
      source_label: `제조사 자료 (${e.source})`,
      variant: e.maker,
      product_name: e.name,
      maker: e.maker,
      category: e.category,
      ingredient: e.ingredient,
      moa_code: null,
      summary: {
        where: e.crops,
        how_much: first.dilution_x
          ? `물에 ${first.dilution_x.toLocaleString("ko-KR")}배로 타서 (물 20L에 ${Math.round(20000 / first.dilution_x)}ml)`
          : null,
        when: first.timing,
        caution: e.caution,
      },
      uses,
      my_use_index: 0,
    });
  }
  return out;
}

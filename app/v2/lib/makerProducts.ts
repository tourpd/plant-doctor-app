// app/v2/lib/makerProducts.ts
// 공식 등록 자료(농약·유기농업자재)에 없는 영양제·비료·친환경 자재는 제조사가 낸 자료로 안내한다.
// 숫자는 제조사 카탈로그에 적힌 그대로만 넣는다. 출처를 화면에 표시한다.
import type { OfficialProduct, OfficialUse } from "./official";
import { matchUseIndex } from "./logic";

/** 작물·병해충이 표로 적힌 제품 (진자비골드·멸규니처럼) */
type MakerRow = {
  crop: string;
  target: string;
  dilution_x: number;
  per_10a_ml: number; // 10a(약 300평)당 제품 양 (카탈로그의 "500ml당 ○○평"에서 환산)
  timing: string;
};

/** 주는 방법만 적힌 제품 (영양제처럼) */
type MakerUse = {
  way: string;
  dilution_x: number | null;
  per_10a_amount: number | null;
  per_10a_unit: string | null;
  timing: string;
  drone?: boolean; // 드론 전용 사용법
  spray_l_per_10a?: number; // 10a당 뿌리는 희석액 양
};

type MakerEntry = {
  name: string;
  aliases: string[]; // 사진·말로 넣을 때 나올 수 있는 다른 표기
  maker: string;
  category: string;
  ingredient: string;
  source: string;
  crops: string; // 카탈로그의 대상 작물 설명
  rows?: MakerRow[];
  uses?: MakerUse[];
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
  {
    name: "진자비골드",
    aliases: ["진자비 골드", "진자비"],
    maker: "㈜도프",
    category: "유기농업자재(해충)",
    ingredient: "고삼추출물, 할미꽃추출물 등 (유기농업자재 공시 2-5-275)",
    source: "도프 2025 카탈로그 133쪽",
    crops: "감귤·사과·배·포도·딸기·오이·고추·수박·가지·배추·벼",
    rows: [
      { crop: "감귤", target: "귤응애", dilution_x: 1000, per_10a_ml: 252, timing: "한 잎당 2~3마리 발생 시 · 7일 간격 3회" },
      { crop: "감귤", target: "꽃노랑총채벌레", dilution_x: 1000, per_10a_ml: 252, timing: "발생 초기 · 7일 간격 2회" },
      { crop: "사과", target: "응애류", dilution_x: 1000, per_10a_ml: 252, timing: "한 잎당 2~3마리 발생 시 · 7일 간격 3회" },
      { crop: "사과", target: "사과유리나방", dilution_x: 1000, per_10a_ml: 252, timing: "발생 초기 · 10일 간격 2회" },
      { crop: "배", target: "점박이응애", dilution_x: 1000, per_10a_ml: 252, timing: "한 잎당 2~3마리 발생 시 · 7일 간격 3회" },
      { crop: "포도", target: "응애류", dilution_x: 1000, per_10a_ml: 252, timing: "한 잎당 2~3마리 발생 시 · 7일 간격 3회" },
      { crop: "포도", target: "진딧물류", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 10일 간격 2회" },
      { crop: "딸기", target: "응애류", dilution_x: 1000, per_10a_ml: 168, timing: "한 잎당 2~3마리 발생 시 · 7일 간격 3회" },
      { crop: "오이", target: "총채벌레", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 7일 간격 2회" },
      { crop: "고추", target: "진딧물류", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 10일 간격 2회" },
      { crop: "고추", target: "총채벌레", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 10일 간격 2회" },
      { crop: "고추", target: "담배나방", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 10일 간격 2회" },
      { crop: "수박", target: "응애류", dilution_x: 1000, per_10a_ml: 168, timing: "한 잎당 2~3마리 발생 시 · 7일 간격 3회" },
      { crop: "가지", target: "응애류", dilution_x: 1000, per_10a_ml: 168, timing: "한 잎당 2~3마리 발생 시 · 7일 간격 3회" },
      { crop: "배추", target: "배추좀나방", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 7일 간격 2회" },
      { crop: "벼", target: "혹명나방", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 7일 간격 2회" },
      { crop: "벼", target: "멸구", dilution_x: 1000, per_10a_ml: 168, timing: "발생 초기 · 10일 간격 2회" },
    ],
    caution: "꿀벌이 활동하는 시간은 피하세요 · 반드시 흔들어 쓰세요 · 연속 4회 이상 쓰지 마세요 · 1회 최대 물 20L에 40ml · 딸기는 반드시 1,000배",
  },
  {
    name: "싹쓰리-I",
    aliases: ["싹쓰리I", "싹쓰리아이", "싹쓰리 I"],
    maker: "㈜도프",
    category: "친환경 해충 관리(응애)",
    ingredient: "고삼 뿌리·할미꽃·유칼립투스·백리향 추출물, 살리실산 등",
    source: "도프 2025 카탈로그 134쪽",
    crops: "과수류, 딸기·고추·오이·토마토·수박 등",
    rows: [
      { crop: "감귤·사과·배·포도 등 과수류", target: "응애", dilution_x: 1000, per_10a_ml: 252, timing: "생육 초기부터 수확기까지 · 500ml를 물 500L에 타서 600평" },
      { crop: "딸기·고추·오이·토마토·수박 등", target: "응애", dilution_x: 1000, per_10a_ml: 151, timing: "생육 초기부터 수확기까지 · 500ml를 물 500L에 타서 1,000평" },
    ],
    caution: "농약·비료와 섞어 쓸 수 있으나 좁은 면적에 먼저 시험하세요 · 쓰기 전에 흔드세요 · 보호장구 착용 · 5℃ 이하에 두지 마세요",
  },
  {
    name: "싹쓰리충",
    aliases: ["싹쓰리-충", "싹쓰리 충"],
    maker: "㈜도프",
    category: "친환경 해충 관리(진딧물·담배거세미나방·파밤나방)",
    ingredient: "고삼 뿌리·할미꽃·유칼립투스·백리향 추출물, 살리실산 등",
    source: "도프 2025 카탈로그 134쪽",
    crops: "포도·오이·딸기·참외·수박·고추·토마토, 배추·벼·파·마늘·양파 등",
    rows: [
      { crop: "포도·오이·딸기·참외·수박·고추·토마토 등", target: "해충", dilution_x: 1000, per_10a_ml: 202, timing: "생육 초기부터 수확기까지 · 500ml를 물 500L에 타서 750평" },
      { crop: "배추·벼·파·마늘·양파 등", target: "해충", dilution_x: 1000, per_10a_ml: 151, timing: "생육 초기부터 수확기까지 · 500ml를 물 500L에 타서 1,000평" },
    ],
    caution: "농약·비료와 섞어 쓸 수 있으나 좁은 면적에 먼저 시험하세요 · 쓰기 전에 흔드세요 · 해충 밀도에 따라 농도를 가감하세요 · 보호장구 착용 · 5℃ 이하에 두지 마세요",
  },
  {
    name: "박멸킹",
    aliases: ["박멸 킹"],
    maker: "㈜도프",
    category: "친환경 해충 관리(토양 살포 입상)",
    ingredient: "님오일, 마트린, 사포닌, 바실러스 계열 미생물",
    source: "도프 2025 카탈로그 135쪽",
    crops: "오이·고추·딸기·호박·가지·수박·멜론·참외·파·쪽파·상추·양파·마늘·배추 등",
    uses: [
      { way: "흙에 뿌리기(두둑 처리 또는 토양 혼화)", dilution_x: null, per_10a_amount: null, per_10a_unit: null, timing: "정식 전 또는 정식 후 · 3kg 1봉 (면적 기준은 카탈로그에 적혀 있지 않음)" },
    ],
    caution: "토양 살포용이니 물에 타서 쓰지 마세요 · 산성·알칼리성 농자재와 섞지 마세요 · 뿌린 뒤 물을 주세요",
  },
  {
    name: "달아웃",
    aliases: ["달 아웃", "달아웃플러스"],
    maker: "㈜도프",
    category: "친환경 해충 관리(달팽이·지렁이·선충 기피)",
    ingredient: "천연 사포닌 30%",
    source: "도프 2025 카탈로그 136쪽",
    crops: "상추·배추 등 엽채류, 인삼, 감귤 등 과수류, 오이 등 과채류, 고구마·감자 등",
    uses: [
      { way: "잎에 뿌리기(엽면시비)", dilution_x: 1000, per_10a_amount: null, per_10a_unit: null, timing: "수확기 포함 전 생육기 · 500~1,000배(물 20L에 20~40ml) · 2주 간격으로 주기적으로" },
      { way: "물 줄 때 섞어 주기(관주)", dilution_x: null, per_10a_amount: 0.76, per_10a_unit: "L", timing: "500ml를 100~200평에 · 2주 간격" },
    ],
    caution: "잎 양쪽에 충분히 뿌리세요 · 이른 아침이나 저녁에 뿌리세요 · 장미·화훼류·파프리카는 품종별 부작용이 있을 수 있으니 시험 후 쓰세요",
  },
  {
    name: "러스아웃",
    aliases: ["러스 아웃"],
    maker: "㈜도프",
    category: "친환경 병해 관리(바이러스 저항성)",
    ingredient: "프로테오글리칸(버섯추출물), 키토산",
    source: "도프 2025 카탈로그 137쪽",
    crops: "전 작물 (파프리카·장미 제외)",
    uses: [
      { way: "잎에 뿌리기(엽면시비)", dilution_x: 1000, per_10a_amount: null, per_10a_unit: null, timing: "전 생육기(특히 병해 발생 초기) · 500~1,000배 · 5~7일 간격 2~3회" },
      { way: "물 줄 때 섞어 주기(관주)", dilution_x: null, per_10a_amount: 1.5, per_10a_unit: "L", timing: "500ml를 100평에 · 7일 간격 2~3회" },
      { way: "뿌리 담그기(침지)", dilution_x: 600, per_10a_amount: null, per_10a_unit: null, timing: "600배로 타서 30분 동안 모종 뿌리를 담급니다" },
    ],
    caution: "아미노산제(도프 럭스)와 섞어 뿌리면 효과가 좋습니다 · 파프리카·장미에는 쓰지 마세요",
  },
  {
    name: "멸규니",
    aliases: ["멸규니골드", "멸 규니"],
    maker: "㈜도프",
    category: "유기농업자재(병해)",
    ingredient: "대황 뿌리 추출물, 황련 뿌리 추출물, 백리향 추출물(티몰), 허브 오일 (유기농업자재 공시 2-4-232)",
    source: "도프 2025 카탈로그 139쪽",
    crops: "감귤·사과·포도·감·딸기·오이·고추·수박·토마토·마늘·양파·벼",
    rows: [
      { crop: "감귤", target: "잿빛곰팡이병", dilution_x: 1000, per_10a_ml: 252, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "감귤", target: "탄저병", dilution_x: 1000, per_10a_ml: 252, timing: "발병 초기 · 10일 간격 2회" },
      { crop: "감귤", target: "더뎅이병", dilution_x: 1000, per_10a_ml: 252, timing: "춘지 발생 초기 · 15일 간격 3회" },
      { crop: "사과", target: "탄저병", dilution_x: 1000, per_10a_ml: 252, timing: "발병 초기 · 10일 간격 2회" },
      { crop: "포도", target: "잿빛곰팡이병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "감", target: "둥근무늬낙엽병", dilution_x: 1000, per_10a_ml: 252, timing: "발병 초기 · 10일 간격 2회" },
      { crop: "딸기", target: "탄저병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "딸기", target: "흰가루병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 2회" },
      { crop: "오이", target: "노균병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 2회" },
      { crop: "오이", target: "흰가루병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "고추", target: "탄저병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 2회" },
      { crop: "수박", target: "덩굴마름병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "토마토", target: "흰가루병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "마늘", target: "균핵병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "양파", target: "균핵병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 3회" },
      { crop: "벼", target: "도열병", dilution_x: 1000, per_10a_ml: 168, timing: "발병 초기 · 10일 간격 2회" },
    ],
    caution: "병이 보이기 전에 미리 뿌리는 것이 좋습니다 · 밀도가 높으면 500배로 흠뻑 · 1회 최대 물 20L에 40ml · 균핵병·덩굴마름병·시들음병은 병든 부위에 약액이 닿게 · 침투 확산제(도프 스피드업)를 함께 쓰면 효과가 좋습니다 · 고온기 직사광선이 강할 때는 늦은 오후에",
  },
  {
    name: "싹쓰리-올",
    aliases: ["싹쓰리올", "싹쓰리 올"],
    maker: "㈜도프",
    category: "친환경 병해 관리(잎에 뿌리기)",
    ingredient: "수산화구리, 수산화아연, 대황추출물, 황련추출물, 킬레이트제 등",
    source: "도프 2025 카탈로그 140쪽",
    crops: "감귤·포도·복숭아·사과·감·벼, 오이·딸기·고추·토마토·수박·인삼·양파 등",
    uses: [
      { way: "잎에 뿌리기(경엽처리)", dilution_x: 1000, per_10a_amount: null, per_10a_unit: null, timing: "생육 초기부터 수확기까지 · 500~1,000배" },
    ],
    caution: "농약·비료와 섞어 쓸 수 있으나 좁은 면적에 먼저 시험하세요 · 쓰기 전에 흔드세요 · 아침이나 자외선이 강할 때를 피해 해 질 무렵 오후에 · 드론·무인항공기로도 뿌릴 수 있습니다(면적당 사용량 기준) · 5℃ 이하에 두지 마세요",
  },
  {
    name: "싹쓰리쏘일",
    aliases: ["싹쓰리-쏘일", "싹쓰리소일", "싹쓰리-SOIL", "싹쓰리 쏘일"],
    maker: "㈜도프",
    category: "친환경 병해 관리(뿌리썩음병, 물 주며)",
    ingredient: "수산화구리, 수산화아연, 대황추출물, 황련추출물, 킬레이트제 등",
    source: "도프 2025 카탈로그 140쪽",
    crops: "수박·메론·고추·토마토·상추·무·마늘·양파·파 등",
    uses: [
      { way: "물 줄 때 섞어 주기(관주)", dilution_x: null, per_10a_amount: 1, per_10a_unit: "L", timing: "생육 초기부터 수확기까지 · 2L를 600평 안팎에" },
    ],
    caution: "농약·비료와 섞어 쓸 수 있으나 좁은 면적에 먼저 시험하세요 · 쓰기 전에 흔드세요 · 희석한 뒤 바로 쓰세요 · 5℃ 이하에 두지 마세요",
  },
  {
    name: "옥시겐",
    aliases: ["옥시젠", "OXYGEN", "옥시 겐"],
    maker: "㈜도프",
    category: "친환경 소독(시설·관수자재)",
    ingredient: "안정화 과산화수소 + 나노은",
    source: "도프 2025 카탈로그 141쪽",
    crops: "작물에 직접 쓰는 약이 아니라 물·공기·장비를 소독하는 제품입니다",
    uses: [
      { way: "관수 물 소독", dilution_x: 5000, per_10a_amount: null, per_10a_unit: null, timing: "급수할 때 5,000배 희석액을 3~4일 간격으로" },
      { way: "하우스 공기 소독", dilution_x: 2000, per_10a_amount: null, per_10a_unit: null, timing: "연무나 스프레이로 2,000배 희석해 공기 중에 살포" },
      { way: "장비 소독", dilution_x: 50, per_10a_amount: null, per_10a_unit: null, timing: "50배 희석액에 약 15분간 담그기" },
      { way: "그 밖(관수자재 등)", dilution_x: 1000, per_10a_amount: null, per_10a_unit: null, timing: "1,000배 희석액에 10시간 담그거나 스프레이" },
    ],
    caution: "마시면 안 되고 피부·옷에 묻으면 바로 씻으세요 · 눈에 들어가면 매우 위험하니 바로 씻고 응급조치하세요 · 가연성 물질과 닿지 않게 서늘한 곳에 · 남은 제품을 다른 용기에 옮기지 마세요 · 농약·비료와 섞을 때는 이 제품을 먼저 희석한 뒤 다른 제품을 넣으세요",
  },
  {
    name: "드론-F",
    aliases: ["드론F", "드론 에프", "드론-f"],
    maker: "㈜도프",
    category: "드론 전용 액체비료",
    ingredient: "미네랄 12-2-12 (+철·아연·붕소·망간·구리·몰리브덴, 도프아주반트 8%)",
    source: "도프 2025 카탈로그 91쪽",
    crops: "벼·보리·밀·콩·옥수수, 감자·고구마·배추·무·마늘·양파·파·고추, 밤나무 등 과수류, 도라지 등",
    uses: [
      { way: "드론으로 뿌리기", drone: true, spray_l_per_10a: 1.5, dilution_x: 7, per_10a_amount: null, per_10a_unit: null, timing: "5~10배(물 10L에 1~2L) · 2,000평 안팎 · 벼류는 출수 후, 밭작물은 추비용 비료 쓸 시기, 과수는 착과 후" },
    ],
    caution: "다른 약제·비료와 섞을 때는 미리 물컵에 같은 비율로 섞어 보아 엉기거나 가라앉지 않는지 확인하세요 · 섞은 뒤에는 되도록 빨리 쓰세요 · 도프 드론-X, 진자비골드, 멸규니와는 섞어 쓸 수 있습니다",
  },
  {
    name: "세크라멘토",
    aliases: ["세크라맨토", "Sacramento", "사크라멘토"],
    maker: "㈜도프",
    category: "벼 전용 영양제(미질·수량)",
    ingredient: "해조류·갑각류·어류 발효 천연 유기물",
    source: "도프 2025 카탈로그 92쪽",
    crops: "벼",
    uses: [
      { way: "잎에 뿌리기", dilution_x: 750, per_10a_amount: null, per_10a_unit: null, timing: "벼 이앙 후 전 기간 · 500~1,000배(물 20L에 20~40ml, 1말 기준) · 출수 전후 2회" },
    ],
    caution: "도열병·문고병 약제와 섞어 쓰면 약효가 늘고 스트레스가 줄어듭니다",
  },
  {
    name: "드론-X",
    aliases: ["드론X", "드론 엑스", "드론-x"],
    maker: "㈜도프",
    category: "드론 전용 생리활성제",
    ingredient: "해조추출물, 갑각류추출물, 유기산",
    source: "도프 2025 카탈로그 90쪽",
    crops: "벼·보리·밀·콩·옥수수, 감자·고구마·배추·무·마늘·양파·파·고추, 밤나무 등 과수류, 잔디 등",
    uses: [
      { way: "드론으로 뿌리기", drone: true, spray_l_per_10a: 1.2, dilution_x: 10, per_10a_amount: null, per_10a_unit: null, timing: "10배(물 10L에 1L) · 2,000~3,000평 · 벼류는 수잉기 및 출수 전후, 밭작물은 잎이 충분히 확보된 후, 과수는 개화 전후, 그 밖 작물은 생육 초기부터 후기까지" },
    ],
    caution: "다른 약제·비료와 섞을 때는 미리 물컵에 같은 비율로 섞어 보고 쓰세요 · 섞은 뒤에는 빨리 쓰세요 · 침투확산제가 들어 있으나 더 넣을 때는 도프 약발업 10ml · 드론-F, 진자비골드, 멸규니와 섞어 쓸 수 있습니다",
  },
  {
    name: "럭스",
    aliases: ["럭스엘", "LUK-S", "룩스"],
    maker: "㈜도프",
    category: "아미노산제(수세 회복)",
    ingredient: "유리아미노산 35%, 펩타이드 5%, 총 40%",
    source: "도프 2025 카탈로그 94쪽",
    crops: "과수류·과채류·엽근채류·약용식물 등 전 작물",
    uses: [
      { way: "잎에 뿌리기(엽면시비)", dilution_x: 750, per_10a_amount: null, per_10a_unit: null, timing: "부실한 성장·초세가 부족할 때 · 500~1,000배(500ml~1L를 25말에) · 육묘기에는 1,000배" },
    ],
    caution: "저온기·일조량 부족한 시기, 활력이 부족할 때 씁니다",
  },
  {
    name: "튼튼모",
    aliases: ["튼튼 모", "고추모관리엔", "고추모 관리엔"],
    maker: "㈜도프",
    category: "육묘 전문 영양제",
    ingredient: "해조발효물, 휴믹산, 펄빅산, 미네랄",
    source: "도프 2025 카탈로그 53쪽",
    crops: "고추 등 모든 모종",
    uses: [
      { way: "이식 전: 포기 관주 및 엽면시비", dilution_x: 750, per_10a_amount: null, per_10a_unit: null, timing: "생육 중 · 500~1,000배(5말~10말에 200ml)" },
      { way: "이식 후: 관주 및 엽면시비", dilution_x: 750, per_10a_amount: null, per_10a_unit: null, timing: "이식 직후 · 500~1,000배(5말~10말에 200ml)" },
    ],
    caution: "저온장애·고온장애 등 환경 스트레스로 생긴 장해를 풀 때 씁니다",
  },
];

const norm = (v: string): string => v.replace(/\s+/g, "").toLowerCase();

function toUses(e: MakerEntry, crop: string): OfficialUse[] {
  if (e.rows && e.rows.length > 0) {
    const uses: OfficialUse[] = e.rows.map((r) => ({
      crop: r.crop,
      target: r.target,
      dilution: `${r.dilution_x.toLocaleString("ko-KR")}배`,
      dilution_x: r.dilution_x,
      per_10a_amount: r.per_10a_ml,
      per_10a_unit: "ml",
      // 카탈로그의 희석배수와 10a당 제품 양에서 나오는 살포량
      spray_l_per_10a: Math.round((r.per_10a_ml * r.dilution_x) / 1000),
      timing: r.timing,
      max_count: null,
      phi_days: null,
    }));
    // 내 작물 줄을 맨 위로
    const mine = crop.trim();
    if (!mine) return uses;
    const hit: OfficialUse[] = [];
    const rest: OfficialUse[] = [];
    for (const u of uses) (matchUseIndex([u], mine) === 0 ? hit : rest).push(u);
    return [...hit, ...rest];
  }
  const cropName = crop.trim() || "모든 작물";
  return (e.uses ?? []).map((u) => ({
    crop: cropName,
    target: u.way,
    dilution: u.dilution_x ? `${u.dilution_x.toLocaleString("ko-KR")}배` : null,
    dilution_x: u.dilution_x,
    per_10a_amount: u.per_10a_amount,
    per_10a_unit: u.per_10a_unit,
    spray_l_per_10a: u.spray_l_per_10a ?? null,
    timing: u.timing,
    max_count: null,
    phi_days: null,
    ...(u.drone ? { drone: true } : {}),
  }));
}

/** 제조사 자료에 있는 제품을 찾는다. 이름이 같거나 검색어가 이름의 일부일 때만 */
export function findMakerProducts(rawName: string, crop = ""): OfficialProduct[] {
  const q = norm(rawName);
  if (q.length < 2) return [];
  const out: OfficialProduct[] = [];
  for (const e of ENTRIES) {
    const names = [e.name, ...e.aliases].map(norm);
    if (!names.some((n) => n === q || n.includes(q))) continue;
    const uses = toUses(e, crop);
    const first = uses[0];
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
        how_much: first?.dilution_x
          ? `물에 ${first.dilution_x.toLocaleString("ko-KR")}배로 타서 (물 20L에 ${Math.round(20000 / first.dilution_x)}ml)`
          : null,
        when: first?.timing ?? null,
        caution: e.caution,
      },
      uses,
      my_use_index: 0,
    });
  }
  return out;
}

/** 병해충 이름의 핵심만 남긴다 ("진딧물류" → "진딧물", "응애류" → "응애") */
const coreTarget = (v: string): string => norm(v).replace(/류$/, "");

/**
 * 내 작물 + 병해충에 쓸 수 있다고 제조사 자료에 적힌 제품 (사진 진단의 처방용).
 * 작물·병해충이 표로 적힌 제품만 대상이다 ("해충"처럼 뭉뚱그린 줄은 넣지 않는다).
 */
export function findMakerForTarget(crop: string, target: string): OfficialProduct[] {
  const t = coreTarget(target);
  if (t.length < 2 || !crop.trim()) return [];
  const out: OfficialProduct[] = [];
  for (const e of ENTRIES) {
    if (!e.rows) continue;
    const hit = e.rows.some((r) => {
      const rt = coreTarget(r.target);
      if (rt.length < 2 || rt === "해충" || rt === "병해") return false;
      const sameCrop = matchUseIndex([{ crop: r.crop }], crop) === 0;
      return sameCrop && (t.includes(rt) || rt.includes(t));
    });
    if (!hit) continue;
    const p = findMakerProducts(e.name, crop)[0];
    if (!p) continue;
    const i = p.uses.findIndex(
      (u) => matchUseIndex([u], crop) === 0 && (t.includes(coreTarget(u.target ?? "")) || coreTarget(u.target ?? "").includes(t))
    );
    out.push({ ...p, my_use_index: i >= 0 ? i : 0 });
  }
  return out;
}

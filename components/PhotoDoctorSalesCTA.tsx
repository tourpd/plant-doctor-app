"use client";

type Props = {
  productName?: string;
};

const EXPO_BASE = "https://kagri-expo.com";

function getSalesLink(productName: string) {
  const name = productName.replace(/\s+/g, "");

  if (name.includes("멸규니")) {
    return `${EXPO_BASE}/expo/product/melgyuni`;
  }

  if (name.includes("싹쓰리충골드")) {
    return `${EXPO_BASE}/expo/product/ssaksseurichung-gold`;
  }

  if (name.includes("싹쓰리충")) {
    return `${EXPO_BASE}/expo/product/ssaksseurichung`;
  }

  if (name.includes("총나와")) {
    return `${EXPO_BASE}/expo/product/chongnawa`;
  }

  return `${EXPO_BASE}/expo`;
}

export default function PhotoDoctorSalesCTA({ productName = "" }: Props) {
  if (!productName) return null;

  const link = getSalesLink(productName);

  return (
    <div
      style={{
        marginTop: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        style={{
          height: 46,
          borderRadius: 12,
          background: "#dc2626",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          fontWeight: 900,
          fontSize: 15,
        }}
      >
        🚨 이 자재 구매·상담하기
      </a>

      <a
        href={`${EXPO_BASE}/expo`}
        target="_blank"
        rel="noreferrer"
        style={{
          height: 42,
          borderRadius: 12,
          border: "1px solid #ddd",
          color: "#111",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        K-Agri Expo 추천관 보기
      </a>
    </div>
  );
}
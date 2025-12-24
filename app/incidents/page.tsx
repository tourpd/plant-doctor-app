"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Incident = {
  id: string;
  status?: string;
  source?: string;
  imageUrl?: string;
  summary?: string;
  createdAt?: any;
};

export default function IncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  /** Incident 리스트 조회 */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/incidents?limit=50");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(data.items ?? []);
      } catch (e) {
        alert("Incident 리스트 불러오기 실패");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h2>📋 Incident 관제</h2>
        <p>불러오는 중…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 960 }}>
      <h2 style={{ marginBottom: 20 }}>📋 Incident 관제 리스트</h2>

      {items.length === 0 && <p>등록된 incident가 없습니다.</p>}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#0d0d0d",
          color: "#fff",
        }}
      >
        <thead>
          <tr style={{ background: "#111" }}>
            <th style={th}>생성시간</th>
            <th style={th}>상태</th>
            <th style={th}>출처</th>
            <th style={th}>요약</th>
            <th style={th}>상세</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #222" }}>
              <td style={td}>
                {item.createdAt?.seconds
                  ? new Date(
                      item.createdAt.seconds * 1000
                    ).toLocaleString()
                  : "-"}
              </td>

              <td style={{ ...td, color: statusColor(item.status) }}>
                {item.status ?? "CREATED"}
              </td>

              <td style={td}>{item.source ?? "-"}</td>

              <td style={td}>
                {item.summary ? item.summary.slice(0, 40) : "-"}
              </td>

              <td style={td}>
                <Link
                  href={`/incidents/${item.id}`}
                  style={{
                    color: "#00ff88",
                    fontWeight: 700,
                  }}
                >
                  열기 →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

/* ===== 스타일 ===== */

const th: React.CSSProperties = {
  padding: 10,
  textAlign: "left",
  borderBottom: "2px solid #333",
};

const td: React.CSSProperties = {
  padding: 10,
  verticalAlign: "top",
};

function statusColor(status?: string) {
  switch (status) {
    case "CREATED":
      return "#00bfff";
    case "ANALYZED":
      return "#ffd400";
    case "CRITICAL":
      return "#ff4444";
    case "CLOSED":
      return "#aaa";
    default:
      return "#0f0";
  }
}
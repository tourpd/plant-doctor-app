'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';

type LogItem = {
  type: string;
  detail?: string;
  at?: string;
};

type ImageItem = {
  downloadUrl: string;
  type?: string;
};

type Diagnosis = {
  createdAt: string;
  crop: string;

  // ✅ 기존 구조 유지
  province?: string;
  city?: string;
  imageUrl?: string;

  // ✅ 확장 구조
  images?: ImageItem[];

  result?: {
    final_judgement?: string;
  };

  admin?: {
    status?: 'normal' | 'review' | 'urgent' | 'new';
  };

  logs?: LogItem[];
};

export default function AdminPage() {
  const [data, setData] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/diagnoses');
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        console.error('❌ 관리자 진단 기록 가져오기 실패:', e);
        setError(e.message || '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>
        📝 진단 기록 (관리자용)
      </h1>

      {loading ? (
        <p>불러오는 중...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>❌ 오류 발생: {error}</p>
      ) : data.length === 0 ? (
        <p>진단 기록이 없습니다.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={th}>날짜</th>
              <th style={th}>작물</th>
              <th style={th}>지역</th>
              <th style={th}>최종 판단</th>
              <th style={th}>상태</th>
              <th style={th}>사진</th>
              <th style={th}>로그</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => {
              // ✅ 이미지 소스 결정 (기존 → 신규 순)
              const imageSrc =
                item.imageUrl ||
                item.images?.[0]?.downloadUrl ||
                null;

              return (
                <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={td}>
                    {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
                  </td>

                  <td style={td}>{item.crop}</td>

                  <td style={td}>
                    {item.province} {item.city}
                  </td>

                  <td style={td}>
                    {item.result?.final_judgement || '—'}
                  </td>

                  <td style={td}>
                    {item.admin?.status || 'new'}
                  </td>

                  <td style={td}>
                    {imageSrc ? (
                      <a href={imageSrc} target="_blank" rel="noopener noreferrer">
                        <img
                          src={imageSrc}
                          alt="preview"
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: 'cover',
                            borderRadius: 4
                          }}
                        />
                      </a>
                    ) : (
                      <span style={{ color: '#999' }}>없음</span>
                    )}
                  </td>

                  <td style={{ ...td, fontSize: 12 }}>
                    {item.logs && item.logs.length > 0
                      ? `${item.logs.length}건`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  padding: '12px 8px',
  textAlign: 'left',
  fontWeight: 'bold',
};

const td: React.CSSProperties = {
  padding: '12px 8px',
  fontSize: 14,
};

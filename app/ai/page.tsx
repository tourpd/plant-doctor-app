'use client';

import React, { useState } from 'react';

type ApiResult = {
  ok: true;
  crop: string;
  region: string;
  observations: string[];
  possible_causes: { name: string; probability: number; why: string }[];
  final_judgement: string;
  actions: {
    doNow: string[];
    doNot: string[];
    mustCheck: string[];
  };
};

type ApiFail = {
  ok: false;
  error: string;
};

export default function AiPage() {
  const [crop, setCrop] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | ApiFail | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
    }
  };

  const submit = async () => {
    if (!file || !province || !city || !crop) {
      alert('사진, 작물명, 도, 시/군 정보를 모두 입력해 주세요.');
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.append('image', file);
    fd.append('crop', crop);
    fd.append('province', province);
    fd.append('city', city);

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        body: fd,
      });
      const data: ApiResult | ApiFail = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: '서버 오류 또는 네트워크 문제' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 20, textAlign: 'center' }}>
  {/* ✅ 상단 제목 + 소개 */}
  <h1 style={{ fontSize: 32, fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 }}>
    🌱 포토닥터 진단
  </h1>
  <p style={{ marginTop: 0, fontSize: 15, color: '#555' }}>
    한국농수산TV가 농민을 위해 만든 AI 병해충·생리장해 진단 서비스입니다.
      </p>

      {/* 입력 */}
      <div style={{ marginTop: 24 }}>
        <input
          type="text"
          placeholder="작물명 (예: 고추)"
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="도 (예: 충남)"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="시/군 (예: 홍성군)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="file" style={fileUploadLabel}>
          📷 <strong>사진 선택 (1장)</strong>
          <p style={{ fontSize: 13, marginTop: 8, color: '#666' }}>
            이미 찍은 사진을 선택해 주세요.
          </p>
        </label>

        <input
          type="file"
          id="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {preview && (
          <img
            src={preview}
            alt="미리보기"
            style={{
              marginTop: 16,
              width: '100%',
              maxHeight: 300,
              objectFit: 'contain',
              border: '1px solid #ccc',
              borderRadius: 8,
            }}
          />
        )}

        <button onClick={submit} disabled={loading} style={btnStyle}>
          {loading ? '진단 중...' : '진단 시작'}
        </button>
      </div>

      {/* 결과 */}
      {result && result.ok && (
        <div style={resultBox}>
          <h2 style={sectionTitle}>👀 관찰 결과</h2>
          <p>
            🌾 작물: <strong>{result.crop}</strong> / 지역: <strong>{result.region}</strong>
          </p>
          <ul>
            {result.observations.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>

          <h3 style={sectionTitle}>🧭 원인 가능성</h3>
          <ul>
            {result.possible_causes.map((c, i) => (
              <li key={i}>
                <strong>{c.name}</strong> 가능성 {c.probability}% - {c.why}
              </li>
            ))}
          </ul>

          <h3 style={sectionTitle}>📌 최종 판단</h3>
          <p style={{ fontWeight: 'bold', color: '#c62828' }}>
            {result.final_judgement}
          </p>

          <h3 style={sectionTitle}>✅ 지금 해야 할 것</h3>
          <ul>{result.actions.doNow.map((t, i) => <li key={i}>• {t}</li>)}</ul>

          <h3 style={sectionTitle}>⛔ 하지 말 것</h3>
          <ul>{result.actions.doNot.map((t, i) => <li key={i}>• {t}</li>)}</ul>

          <h3 style={sectionTitle}>🔍 반드시 확인</h3>
          <ul>{result.actions.mustCheck.map((t, i) => <li key={i}>• {t}</li>)}</ul>

          {/* 면책 문구 */}
          <p style={{ marginTop: 20, fontSize: 14, color: '#888' }}>
            ⚠️ 이 결과는 AI의 참고 진단이며, 최종 판단은 농업인 본인의 책임입니다.
          </p>

          {/* 119 출동 요청 버튼 */}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
            target="_blank"
            rel="noopener noreferrer"
            style={emergencyButton}
          >
            🚨 농사톡톡 119 출동 요청
          </a>
        </div>
      )}

      {result && !result.ok && (
        <div style={{ marginTop: 20, color: 'red', fontWeight: 'bold' }}>
          ❌ 오류: {result.error}
        </div>
      )}
    </main>
  );
}

// ✅ 스타일 객체는 함수 밖에서도 가능
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 12,
  marginTop: 12,
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 16,
};

const fileUploadLabel: React.CSSProperties = {
  border: '2px dashed #4caf50',
  padding: 20,
  textAlign: 'center',
  marginTop: 16,
  cursor: 'pointer',
  borderRadius: 10,
  display: 'block',
  color: '#333',
  background: '#f0fff4',
};

const btnStyle: React.CSSProperties = {
  marginTop: 24,
  width: '100%',
  padding: 14,
  backgroundColor: '#4caf50',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 16,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const resultBox: React.CSSProperties = {
  marginTop: 32,
  padding: 20,
  border: '1px solid #ddd',
  borderRadius: 10,
  backgroundColor: '#fafafa',
};

const sectionTitle: React.CSSProperties = {
  marginTop: 24,
  fontSize: 18,
  fontWeight: 'bold',
  color: '#2e7d32',
};

const emergencyButton: React.CSSProperties = {
  display: 'block',
  marginTop: 28,
  width: '100%',
  padding: 14,
  backgroundColor: '#d32f2f',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 16,
  fontWeight: 'bold',
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
};
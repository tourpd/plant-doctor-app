'use client';

import React, { useState, useRef, useEffect } from 'react';
import '@/app/globals.css';

// ✅ 자재 추천 함수 임포트
import { getRecommendation } from '../api/vision/utils/recommendMaterial';

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

  // ✅ (추가) 스피너 아래 문구 상태
  const [loadingText, setLoadingText] = useState('🔍 AI가 병해 증상을 분석 중입니다…');

  const magicSoundRef = useRef<HTMLAudioElement>(null); // 🔊 성공 효과음(1회)
  const clickSoundRef = useRef<HTMLAudioElement>(null); // 🔁 진단 중 루프 사운드
  const resultRef = useRef<HTMLDivElement>(null);

  // ✅ (추가) 기기 고정 device_id 생성/저장 (브라우저에 1회 생성 후 계속 재사용)
  const getOrCreateDeviceId = () => {
    if (typeof window === 'undefined') return '';
    const key = 'photodoctor_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  };

  useEffect(() => {
    const savedCrop = localStorage.getItem('crop');
    const savedProvince = localStorage.getItem('province');
    const savedCity = localStorage.getItem('city');
    if (savedCrop) setCrop(savedCrop);
    if (savedProvince) setProvince(savedProvince);
    if (savedCity) setCity(savedCity);
  }, []);

  useEffect(() => {
    if (result && result.ok && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result]);

  // ✅ (추가) 로딩 시작 → 문구 초기화, 8초 후 문구 변경
  useEffect(() => {
    if (!loading) return;

    setLoadingText('🔍 AI가 병해 신호를 분석 중입니다…');

    const t = setTimeout(() => {
      setLoadingText('⏳ 정확도를 높이는 중입니다… \n잠시만 더 기다려 주세요.');
    }, 8000);

    return () => clearTimeout(t);
  }, [loading]);

  // ✅ (추가) 사용자 제스처(버튼 클릭) 시점에 오디오 잠금 해제용
  const unlockSound = async () => {
    const a = magicSoundRef.current;
    if (!a) return;
    try {
      a.volume = 0.3;
      a.currentTime = 0;
      await a.play();
      a.pause();
      a.currentTime = 0;
    } catch (err) {
      console.warn('효과음 unlock 실패:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
    }
  };

  // 🔁 진단 루프 시작 (clickSoundRef 사용)
  const startDiagnoseLoop = () => {
    const a = clickSoundRef.current;
    if (!a) return;
    try {
      a.volume = 0.20;
      a.loop = true;
      a.currentTime = 0;
      a.play().catch((e) => console.warn('진단 루프 실패:', e));
    } catch {}
  };

  // 🔇 진단 루프 정지 (finally에서 무조건 호출)
  const stopDiagnoseLoop = () => {
    const a = clickSoundRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
      a.loop = false;
    } catch {}
  };

  const submit = async () => {
    await unlockSound();

    // 🔁 시작 전에 혹시 남아있던 루프 정리
    stopDiagnoseLoop();

    // ✅ 입력 검증(기존 로직 유지)
    if (!file || !province || !city || !crop) {
      alert('사진, 작물명, 도, 시/군 정보를 모두 입력해 주세요.');
      stopDiagnoseLoop();
      return;
    }

    // ✅ (필수) fd가 원문에서 누락되어 있어 최소로 복구 (기존 흐름 유지)
    const fd = new FormData();
    fd.append('image', file);
    fd.append('crop', crop);
    fd.append('province', province);
    fd.append('city', city);
    fd.append('device_id', getOrCreateDeviceId()); // ✅ 핵심: 첫/재방문 판정용

    // 🔁 진단 루프 시작
    startDiagnoseLoop();

    setLoading(true);

    try {
      const res = await fetch('/api/vision', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);

      // ✅ 성공 시 매직 사운드 1회 재생
      if (data?.ok) {
        const m = magicSoundRef.current;
        if (m) {
          m.volume = 0.12;
          m.loop = false;
          m.currentTime = 0;
          m.play().catch((err: any) => console.warn('효과음 재생 오류:', err));
        }
      }
    } catch (err) {
      setResult({ ok: false, error: '서버 오류 또는 네트워크 문제' });
    } finally {
      setLoading(false);
      stopDiagnoseLoop(); // ✅ 핵심: 성공/실패 상관없이 “무조건” 멈춤
    }
  };

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 20 }}>
      {/* ✅ clickSoundRef를 “진단 중 루프”로 사용 */}
      <audio
        ref={clickSoundRef}
        src="/sounds/click-buttons-ui-menu-sounds-effects-button-10-205397.mp3"
        preload="auto"
        loop
      />

      {/* 🔊 성공 효과음 (1회 재생은 submit에서) */}
      <audio ref={magicSoundRef} src="/sounds/magic-03-278824.mp3" preload="auto" />

      <h1 style={{ fontSize: 32, fontWeight: 'bold', color: '#2e7d32', marginBottom: 8, textAlign: 'center' }}>
        🌱 포토닥터 진단
      </h1>
      <p style={{ marginTop: 0, fontSize: 17, color: '#3a372fff', textAlign: 'center' }}>
        한국농수산TV가 농민을 위해 만든 AI 작물 진단 서비스입니다.
      </p>

      <div style={{ marginTop: 24 }}>
        <input type="text" placeholder="작물명 (예: 고추)" value={crop} onChange={(e) => setCrop(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="도 (예: 충남)" value={province} onChange={(e) => setProvince(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="시/군 (예: 홍성군)" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />

        <label htmlFor="file" style={fileUploadLabel}>
          📷 <strong>사진 선택 (1장)</strong>
          <p style={{ fontSize: 13, marginTop: 8, color: '#666' }}>이미 찍은 사진을 선택해 주세요.</p>
        </label>

        <input type="file" id="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

        {preview && (
          <div style={{ position: 'relative', marginTop: 16 }}>
            <img
              src={preview}
              alt="미리보기"
              style={{
                width: '100%',
                maxHeight: 300,
                objectFit: 'contain',
                border: '1px solid #ccc',
                borderRadius: 8,
              }}
            />
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div className="spinner" />
                <p
                  style={{
                    marginTop: 12,
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.88)',
                    borderRadius: 20,
                    fontSize: 15,
                    color: '#c62828',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                  }}
                >
                  {loadingText}
                </p>
              </div>
            )}
          </div>
        )}

        <button onClick={submit} disabled={loading} style={btnStyle}>
          {loading ? '진단 중...' : '진단 시작'}
        </button>
      </div>

      {result && result.ok && (
        <div ref={resultRef} style={resultBox}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={sectionTitle}>👀 관찰 결과</h2>
            <p>
              🌾 작물: <strong>{result.crop}</strong> / 지역: <strong>{result.region}</strong>
            </p>

            <ul>
              {(Array.isArray(result.observations) ? result.observations : []).map((o, i) => (
                <li key={i}>• {o}</li>
              ))}
            </ul>

            <h3 style={sectionTitle}>🧭 원인 가능성</h3>
            <ul>
              {(Array.isArray(result.possible_causes) ? result.possible_causes : []).map((c, i) => (
                <li key={i}>
                  <strong>{c?.name ?? '원인 미상'}</strong> 가능성 {c?.probability ?? '-'}% - {c?.why ?? ''}
                </li>
              ))}
            </ul>

            <h3 style={sectionTitle}>📌 최종 판단</h3>
            <p style={{ fontWeight: 'bold', color: '#c62828' }}>{result.final_judgement}</p>

            <h3 style={sectionTitle}>✅ 지금 해야 할 것</h3>
            <ul>
              {(Array.isArray(result?.actions?.doNow) ? result.actions.doNow : []).map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>

            <h3 style={sectionTitle}>⛔ 하지 말 것</h3>
            <ul>
              {(Array.isArray(result?.actions?.doNot) ? result.actions.doNot : []).map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>

            <h3 style={sectionTitle}>🔍 반드시 확인</h3>
            <ul>
              {(Array.isArray(result?.actions?.mustCheck) ? result.actions.mustCheck : []).map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>
          </div>

          {/* ✅ 자재 추천 정보 */}
          {(() => {
            const recommendation = getRecommendation(result.final_judgement);
            if (!recommendation) return null;

            return (
              <div style={{ marginTop: 32, textAlign: 'left' }}>
                <h3 style={{ ...sectionTitle, color: '#33691e' }}>🧪 자재 추천</h3>
                <p style={{ whiteSpace: 'pre-line', fontSize: 15, lineHeight: 1.6 }}>
                  {recommendation.usageGuide}
                </p>
                <div style={{ marginTop: 16 }}>
                  {(recommendation.materials ?? []).map((mat, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: 16,
                        padding: 12,
                        border: '1px solid #ccc',
                        borderRadius: 8,
                        backgroundColor: '#fff',
                      }}
                    >
                      <strong style={{ fontSize: 16 }}>{mat.title}</strong>
                      {mat.description && <p style={{ marginTop: 4 }}>{mat.description}</p>}
                      {mat.howToUse && (
                        <p style={{ marginTop: 6, fontSize: 14 }}>
                          <strong>👉 사용법:</strong> {mat.howToUse}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <p style={{ marginTop: 20, fontSize: 14, color: '#888', textAlign: 'center' }}>
            ⚠️ 이 결과는 AI의 참고 진단이며, 최종 판단은 농업인 본인의 책임입니다.
          </p>

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

// 🔧 스타일 정의
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 12,
  marginTop: 12,
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 16,
  color: '#333',
  fontWeight: 'bold',
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
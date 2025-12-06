"use client";

import { useState } from "react";

export default function HomePage() {

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFile = (e:any) => {
    const f = e.target.files?.[0];
    if(!f) return;

    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {

    if(!file){
      alert("진단할 사진을 먼저 선택해주세요");
      return;
    }

    setLoading(true);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/analyze",{
      method:"POST",
      body: form
    });

    const data = await res.json();
    setResult(data);

    setLoading(false);
  };

  return (

    <main style={{
      minHeight:'100vh',
      background:'#000',
      color:'#00ff88',
      padding:'20px',
      maxWidth: 500,
      margin:'0 auto'
    }}>

      <h2 style={{textAlign:"center"}}>
        🐞 또봉이 농사 상담 AI
      </h2>

      {/* 📸 업로드 영역 */}
      <label style={{
        width:"100%",
        height:180,
        border:'2px dashed #00ff88',
        borderRadius:14,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        textAlign:'center',
        color:'#00ff88',
        cursor:'pointer',
        marginBottom:20,
        background:'#020d07'
      }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{display:"none"}}
        />

        <div style={{fontSize:18}}>
          📸 <br/>
          <b>여기를 눌러</b><br/>
          <span style={{color:"#ccc"}}>사진 촬영 또는 업로드</span>
        </div>

      </label>

      {/* 🖼 이미지 미리보기 - 중앙 고정 */}
      {preview && (

        <div style={{
          display:'flex',
          justifyContent:'center',
          marginBottom:20
        }}>

          <img
            src={preview}
            style={{
              width:'90%',
              maxWidth:320,
              borderRadius:12,
              border:'2px solid #00ff88',
              objectFit:'contain'
            }}
          />

        </div>
      )}

      {/* 🧠 진단 버튼 */}
      <button
        onClick={analyze}
        disabled={loading}
        style={{
          width:'100%',
          background:'#00cc44',
          color:'#000',
          padding:16,
          borderRadius:14,
          border:'none',
          fontSize:18,
          cursor:'pointer'
        }}
      >
        🧠 {loading ? "AI 진단중..." : "AI 진단 요청"}
      </button>

      {/* ✅ 결과 박스 */}
      { result && (

        <div style={{
          background:'#111',
          borderRadius:14,
          padding:16,
          marginTop:18
        }}>
          { result.ok ? (

            <>
              <h3>✅ AI 병해 진단 결과</h3>

              <p><b>🌱 작물</b><br/>{result.crop}</p>

              <p><b>🦠 의심 병해</b><br/>{result.diagnosis}</p>

              <p><b>📌 주요 증상</b><br/>{result.symptoms}</p>

              <p><b>🧬 발생 원인</b><br/>{result.reason}</p>

              <p><b>🛠 방제 처방</b><br/>{result.solution}</p>

              <p style={{color:"#ffb000"}}><b>⚠ 예방 관리</b><br/>{result.caution}</p>
            </>
          ):(

            <h3>❌ 진단 실패 : {result.error}</h3>

          )}

        </div>
      )}

      {/* 🚨 119 버튼 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
      >
        <button style={{
          width:'100%',
          marginTop:20,
          background:'red',
          color:'#fff',
          padding:16,
          border:'none',
          borderRadius:14,
          fontSize:18,
          cursor:'pointer'
        }}>
          🚨 119 긴급 출동 요청
        </button>
      </a>

    </main>
  );
}

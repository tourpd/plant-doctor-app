"use client";

import { useState } from "react";

export default function Home() {

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleUpload = (e: any) => {
    const f = e.target.files[0];
    if (!f) return;

    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const analyze = async () => {
    if (!file) {
      alert("사진을 먼저 올려주세요");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    setResult(data);
  };

  return (

    <main style={{
      background:"#000",
      minHeight:"100vh",
      padding:20,
      color:"#6BFFD4"
    }}>

      <h2 style={{ textAlign:"center" }}>
        🐞 또봉이 농사 상담 AI
      </h2>

      {/* 업로드 박스 */}
      <div style={{
        border:"2px dashed #00ff88",
        borderRadius:10,
        padding:20,
        textAlign:"center",
        marginBottom:20
      }}>
        📸 사진 촬영 또는 업로드 <br/>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
        />
      </div>

      {/* 미리보기 */}
      {preview && (
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <img
            src={preview}
            style={{
              maxWidth:280,
              borderRadius:10,
              border:"2px solid #00ff88"
            }}
          />
        </div>
      )}

      {/* 진단 버튼 */}
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <button
          onClick={analyze}
          style={{
            background:"#00cc44",
            color:"white",
            padding:"12px 40px",
            borderRadius:8,
            border:0,
            fontSize:18,
            cursor:"pointer"
          }}
        >
          🧠 AI 진단 요청
        </button>
      </div>

      {/* 결과 박스 */}
      <div style={{
        background:"#111",
        borderRadius:8,
        padding:15,
        minHeight:80
      }}>
        { result && (

          result.ok ? (
            <>
              ✅ AI 진단 완료

              <pre style={{ whiteSpace:"pre-wrap" }}>
작물 : {result.crop}

병명 : {result.diagnosis}

원인 :
{result.reason}

방제 방법 :
{result.solution}
              </pre>
            </>
          ) : (

            <pre>
{JSON.stringify(result,null,2)}
            </pre>

          )
        )}
      </div>

      {/* 119 버튼 */}
      <div style={{ textAlign:"center", marginTop:20 }}>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:"inline-block",
            background:"red",
            color:"white",
            padding:"14px 40px",
            borderRadius:8,
            textDecoration:"none",
            fontSize:18
          }}
        >
          🚨 119 출동 요청
        </a>
      </div>

    </main>
  );
}

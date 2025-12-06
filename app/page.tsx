"use client";

import { useState } from "react";

const FORM_119 =
"https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult("");
  };

  const analyze = async () => {
    if (!file) {
      alert("사진을 먼저 선택해주세요");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);   // ✅ 반드시 file

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form               // ✅ headers 절대 NO
      });

      const data = await res.json();

      console.log("AI RESULT:", data);

      if (!data.ok) {
        setResult(`❌ ${data.error}`);
        return;
      }

      setResult(data.message || "AI 결과 없음");
    } catch (err:any) {
      setResult("❌ 서버 오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight:"100vh",
      background:"#000",
      color:"#0f0",
      padding:20,
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      gap:20
    }}>
      <h2>🐞 또봉이 농사 상담 AI</h2>

      <label style={{
        width:"100%",
        maxWidth:500,
        height:160,
        border:"2px dashed #00ff88",
        borderRadius:12,
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        cursor:"pointer"
      }}>
        📸 사진 촬영 또는 업로드
        <input hidden type="file"
          accept="image/*"
          onChange={(e)=>{
            if(e.target.files?.[0]){
              handleFile(e.target.files[0]);
            }
          }}
        />
      </label>

      {preview && (
        <img src={preview} style={{
          width:"100%",
          maxWidth:400,
          border:"2px solid #00ff88",
          borderRadius:12
        }}/>
      )}

      <button onClick={analyze}
        disabled={loading}
        style={{
          width:"100%",
          maxWidth:400,
          height:60,
          background:"#00cc44",
          borderRadius:16,
          border:"none",
          color:"white",
          fontSize:20,
          fontWeight:"bold"
        }}>
        🧠 {loading ? "분석중..." : "AI 진단 요청"}
      </button>

      {result && (
        <pre style={{
          width:"100%",
          maxWidth:500,
          background:"#111",
          padding:16,
          borderRadius:14,
          color:"#00ff99",
          whiteSpace:"pre-wrap"
        }}>
✅ AI 진단 결과

{result}
        </pre>
      )}

      <a href={FORM_119}
         target="_blank"
         rel="noopener noreferrer"
         style={{
           width:"100%",
           maxWidth:400,
           height:60,
           background:"#ff1a1a",
           borderRadius:16,
           display:"flex",
           justifyContent:"center",
           alignItems:"center",
           color:"white",
           textDecoration:"none",
           fontSize:20,
           fontWeight:"bold"
         }}>
         🚨 119 출동 요청
      </a>
    </main>
  );
}

"use client";

import { useState } from "react";

export default function Page() {
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);

  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [error,setError]=useState("");

  const onFile=(f:File)=>{
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError("");
  };

  const diagnose=async()=>{
    if(!file) return alert("사진 먼저 업로드 해주세요.");

    try{
      setLoading(true);
      setError("");
      setResult(null);

      const form=new FormData();
      form.append("file",file);

      const res= await fetch("/api/analyze",{
        method:"POST",
        body:form
      });

      const data= await res.json();
      console.log("AI FULL RESPONSE",data);

      setResult(data);

    }catch(e){
      console.error(e);
      setError("🚨 서버 통신 실패");
    }
    finally{
      setLoading(false);
    }
  };

  return(
    <main style={{
      minHeight:"100vh",
      background:"#000",
      padding:24,
      display:"flex",
      flexDirection:"column",
      alignItems:"center"
    }}>

      <h2 style={{color:"#7CFFAF"}}>🐞 또봉이 농사 상담 AI</h2>

      {/* 파일 업로드 */}
      <label style={{
        width:"100%",
        maxWidth:430,
        height:160,
        border:"2px dashed #00ff88",
        borderRadius:12,
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        color:"#00ff88",
        cursor:"pointer"
      }}>
        <input hidden type="file" accept="image/*"
          onChange={e=> e.target.files && onFile(e.target.files[0])}
        />
        📸 사진 촬영 또는 업로드
      </label>


      {/* 미리보기 */}
      {preview &&
        <div style={{
          width:"100%",
          display:"flex",
          justifyContent:"center"
        }}>
          <img src={preview} style={{
            width:280,
            borderRadius:12,
            border:"2px solid #00ff88",
            margin:"12px auto"
          }} />
        </div>
      }

      <button
        onClick={diagnose}
        disabled={loading}
        style={{
          width:"100%",
          maxWidth:430,
          background:"#00c853",
          padding:14,
          borderRadius:12,
          border:"none",
          fontSize:18,
          fontWeight:"bold",
          cursor:"pointer"
        }}
      >
        🧠 AI 진단 요청
      </button>

      {/* 결과 박스 (항상 표시) */}
      <div style={{
        background:"#111",
        marginTop:16,
        padding:16,
        width:"100%",
        maxWidth:430,
        borderRadius:12,
        color:"#00ff88",
        whiteSpace:"pre-wrap",
        minHeight:120
      }}>
        {loading && "🔄 AI 진단 중입니다..."}
        {error && error}
        {!loading && result &&
          JSON.stringify(result,null,2)
        }
        {!loading && !result && !error &&
          "✅ 대기 중: 사진 업로드 후 진단 요청을 눌러주세요."
        }
      </div>

      {/* 119 연결 */}
      <a
        href="https://docs.google.com/forms/d/e/1FAIpQLSdKgcwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop:24,
          width:"100%",
          maxWidth:430,
          textAlign:"center",
          padding:14,
          background:"#ff1a1a",
          color:"#fff",
          fontWeight:"bold",
          borderRadius:12,
          textDecoration:"none",
          fontSize:17
        }}
      >
        🚨 119 출동 요청
      </a>

    </main>
  );
}

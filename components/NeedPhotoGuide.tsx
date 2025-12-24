"use client";

import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onPickPhotos: () => void;
  requiredCount?: number;
};

export default function NeedPhotoGuide({
  open,
  onClose,
  onPickPhotos,
  requiredCount = 4,
}: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "#0b0b0b",
          borderRadius: 18,
          padding: 18,
          border: "2px solid #ffd400",
          color: "#fff",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* 제목 */}
        <div
          style={{
            fontSize: 21,
            fontWeight: 900,
            color: "#ffd400",
            textAlign: "center",
          }}
        >
          📸 추가 사진이 필요합니다
        </div>

        {/* 설명 */}
        <div
          style={{
            marginTop: 10,
            color: "#ccc",
            lineHeight: 1.6,
            fontSize: 15,
          }}
        >
          지금 사진만으로는 <b>해충인지 · 병인지 · 환경 문제인지</b>
          <br />
          정확히 구분하기 어렵습니다.
          <br />
          <br />
          아래 안내대로 <b>{requiredCount}장</b>을 한 번에 올려주시면
          <br />
          <b style={{ color: "#ffd400" }}>
            헛방제 없이 정확한 진단
          </b>
          이 가능합니다.
        </div>

        {/* 촬영 가이드 */}
        <div style={{ marginTop: 18 }}>
          {[
            {
              title: "1️⃣ 밭 전체 (멀리서)",
              desc: "한 포기 문제인지, 전체로 번지는 병인지 판단",
            },
            {
              title: "2️⃣ 가장 심한 포기 (가까이)",
              desc: "병의 핵심 증상 위치 확인",
            },
            {
              title: "3️⃣ 줄기 밑동 · 관부",
              desc: "줄기가 축 늘어지는 병(시듦병·청고병) 확인",
            },
            {
              title: "4️⃣ 잎 뒷면",
              desc: "총채벌레·진딧물·응애 등 해충 흔적 확인",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                marginTop: 10,
                padding: 14,
                borderRadius: 14,
                background: "#121212",
                border: "1px solid #222",
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  color: "#00ff88",
                  fontSize: 15,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#aaa",
                  fontSize: 14,
                  lineHeight: 1.4,
                }}
              >
                → {item.desc}
              </div>
            </div>
          ))}
        </div>

        {/* 업로드 주의 */}
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            background: "#1a1a1a",
            color: "#ffd400",
            fontWeight: 900,
            lineHeight: 1.6,
            fontSize: 15,
          }}
        >
          ✅ 사진 {requiredCount}장을 모두 찍은 뒤<br />
          ✅ 갤러리에서 <b>한 번에 선택</b>해서 업로드하세요
          <br />
          ❌ 한 장씩 나눠서 올리면 진단이 정확해지지 않습니다
        </div>

        {/* 버튼 */}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              background: "#333",
              color: "#aaa",
              fontWeight: 900,
              border: "none",
              cursor: "pointer",
            }}
          >
            닫기
          </button>

          <button
            onClick={onPickPhotos}
            style={{
              flex: 2,
              height: 54,
              borderRadius: 16,
              background: "#00cc44",
              color: "#000",
              fontWeight: 900,
              border: "none",
              cursor: "pointer",
            }}
          >
            📂 사진 {requiredCount}장 선택하기
          </button>
        </div>

        {/* 마무리 */}
        <div
          style={{
            marginTop: 16,
            color: "#888",
            fontSize: 13,
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          병해는 하루아침에 끝나지 않습니다.<br />
          방제 후 <b>3~7일 변화</b>가 진짜 판단 기준입니다.
        </div>
      </div>
    </div>
  );
}
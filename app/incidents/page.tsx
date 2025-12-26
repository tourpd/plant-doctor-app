"use client";

import React from "react";

const HOTLINE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdkcgwl_B-10yU0gi4oareM4iajMPND6JtGIZEwjbwPbnQBEg/viewform";

export default function IncidentsPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const incidentId = params?.get("incident_id") || "";

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-center font-bold text-red-300 text-xl">농사톡톡 119 긴급출동</div>

        <div className="rounded-2xl border border-zinc-700 p-4 space-y-2">
          <div className="font-bold">농민님, 지금은 “현장 정보”가 제일 중요합니다.</div>
          <div className="text-sm text-zinc-200">
            119는 사진만으로 끝내지 않고, <b>작물/지역/증상/확산 속도</b>를 기준으로 판단합니다.
            아래 폼에 간단히 입력해 주세요.
          </div>
        </div>

        {incidentId && (
          <div className="rounded-2xl border border-emerald-400 p-4">
            <div className="font-bold text-emerald-300">접수 추적 번호</div>
            <div className="text-xl font-bold mt-1">{incidentId}</div>
            <div className="text-xs text-zinc-300 mt-1">
              이 번호는 추후 “진행상태 확인”과 상담 연결에 사용됩니다.
            </div>
          </div>
        )}

        <a
          className="block w-full text-center rounded-2xl bg-red-700 font-bold py-4"
          href={HOTLINE_FORM_URL}
          target="_blank"
          rel="noreferrer"
        >
          📝 119 접수 폼 열기
        </a>

        <div className="rounded-2xl border border-zinc-700 p-4 space-y-2">
          <div className="font-bold text-yellow-300">입력 팁 (농민 관점)</div>
          <ul className="list-disc pl-5 text-sm text-zinc-200 space-y-1">
            <li>“언제부터” / “어디서(하우스/노지/구역)” / “얼마나 빨리 번지는지”를 꼭 적어주세요.</li>
            <li>가능하면 잎 앞/잎 뒤/줄기/생장점 4장을 추가로 촬영해 주세요.</li>
            <li>이미 방제/자재를 사용했다면 “언제/무엇을/몇 번”만 적어도 충분합니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
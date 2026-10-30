import React from "react";

export const dynamic = "force-dynamic";

const PHOTO_DOCTOR_URL =
  "https://plant-doctor-app.vercel.app/ai";

export default function AIConsultPage() {
  return (
    <main style={S.wrap}>
      <section style={S.frameWrap}>
        <iframe
          src={PHOTO_DOCTOR_URL}
          title="포토닥터"
          style={S.iframe}
        />
      </section>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    background: "#f3f4f6",
  },

  frameWrap: {
    width: "100%",
    maxWidth: 1200,
    margin: "0 auto",
    overflow: "hidden",
    background: "#ffffff",
  },

  iframe: {
    width: "100%",
    height: "100vh",
    minHeight: 1400,
    border: "none",
    display: "block",
    background: "#ffffff",
  },
};
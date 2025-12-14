export async function saveDiagnosisToDB({
  imageUrl,
  gps,
  crop,
  disease,
  synonyms,
  season,
  diagnosisText,
}: any) {
  try {
    await fetch("/api/save-diagnosis", {
      method: "POST",
      body: JSON.stringify({
        imageUrl,
        gps,
        crop,
        disease,
        synonyms,
        season,
        diagnosisText,
        createdAt: Date.now(),
      }),
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("SAVE FAIL:", e);
  }
}

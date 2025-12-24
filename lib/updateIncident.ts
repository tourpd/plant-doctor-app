// lib/updateIncident.ts
type UpdateIncidentInput = {
  incidentId: string;
  visionResult: any;
};

export async function updateIncident({ incidentId, visionResult }: UpdateIncidentInput) {
  console.log("updateIncident called:", incidentId);

  // TODO:
  // - Firestore
  // - Supabase
  // - DB 연결

  return true;
}
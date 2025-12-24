// types/incident.ts

export type IncidentStatus =
  | "CREATED"
  | "PHOTO_UPLOADED"
  | "VISION_DONE"
  | "NEED_REVIEW"
  | "DISPATCHED"
  | "CLOSED";

export type IncidentSource =
  | "PHOTO_UPLOAD"
  | "AI"
  | "PHONE"
  | "FORM_119";

export type RiskLevel = "LOW" | "MID" | "HIGH";

export interface Incident {
  id: string;

  status: IncidentStatus;
  source: IncidentSource;

  imageUrls: string[];

  crop?: string;
  diseaseCandidates?: string[];

  visionSummary?: string;
  visionRaw?: any;
  riskLevel?: RiskLevel;

  location?: {
    sido?: string;
    sigungu?: string;
  };

  affectedArea?: number;

  dispatchRequested?: boolean;
  dispatchAt?: any;
  handler?: string;

  createdAt: any;
  updatedAt: any;
}
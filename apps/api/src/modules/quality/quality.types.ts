export enum QualityName {
  EXPERTISE = 'expertise',
  CARE = 'care',
  DELIVERY = 'delivery',
  INITIATIVE = 'initiative',
  TRUST = 'trust',
}

export interface QualityResponse {
  id: string;
  name: QualityName;
  label: string;
  description: string;
  customerLanguage: string;
  sortOrder: number;
}

export interface QualityScoreResponse {
  qualityId: string;
  qualityName: QualityName;
  label: string;
  pickCount: number;
  percentage: number;
}

export interface PlantAnalysisResult {
  plantName: string;
  scientificName?: string;
  healthStatus: "Healthy" | "Needs Attention" | "Sick" | "Unknown";
  issues: string[];
  recommendations: string[];
  growingConditions?: {
    light: string;
    water: string;
    soil: string;
  };
  careTips?: string[];
}

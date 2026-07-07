export interface Candidate {
  title: string;
  snippet: string;
  exactWikitextMatch: boolean;
  fuzzyRank: number | null;
}

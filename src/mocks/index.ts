import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { butterbur } from "./butterbur";
import { coati } from "./coati";
import { quokka } from "./quokka";

export interface CaseEntry {
  id: string;
  label: string;
  data: ClaimProvenance;
}

export const cases: CaseEntry[] = [
  { id: "quokka", label: "Quokka", data: quokka },
  { id: "coati", label: "Coati", data: coati },
  { id: "butterbur", label: "Butterbur", data: butterbur },
];

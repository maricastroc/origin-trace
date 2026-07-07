import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { butterbur } from "./butterbur";
import { coati } from "./coati";
import { quokka } from "./quokka";

export interface CaseEntry {
  id: string;
  label: string;
  hook: string;
  data: ClaimProvenance;
}

export const cases: CaseEntry[] = [
  {
    id: "quokka",
    label: "Quokka",
    hook: "A 2013 meme wearing a 2019 newspaper citation.",
    data: quokka,
  },
  {
    id: "coati",
    label: "Coati",
    hook: "A hoax the source itself copied back from Wikipedia.",
    data: coati,
  },
  {
    id: "butterbur",
    label: "Butterbur",
    hook: "The same fact, two verdicts — the boundary decides.",
    data: butterbur,
  },
];

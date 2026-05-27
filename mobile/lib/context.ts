import { createContext, useContext } from "react";
import type { ParseResult, ReportResult } from "./api";

export interface ReportData {
  parse: ParseResult;
  report: ReportResult;
}

interface ReportContextType {
  report: ReportData | null;
  setReport: (data: ReportData | null) => void;
}

export const ReportContext = createContext<ReportContextType>({
  report: null,
  setReport: () => {},
});

export function useReport() {
  return useContext(ReportContext);
}

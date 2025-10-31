// Java: com.sap.adt.abapcleaner.rules.prettyprinter.UpperAndLowerCaseRule

import { ArtifactsABAP } from "@abaplint/core";
import type { AbapToken, AbapPluginOptions } from "../parsers/types.js";

const KEYWORDS = new Set<string>(
  ArtifactsABAP.getKeywords().map((kw) => kw.word.toUpperCase())
);

export function applyKeywordCase(
  token: AbapToken,
  options: AbapPluginOptions
): string {
  const target = options.abapKeywordCase ?? "upper";

  if (token.role !== "word") {
    if (token.role === "pragma") {
      return target === "lower"
        ? token.text.toLowerCase()
        : token.text.toUpperCase();
    }
    return token.text;
  }

  if (!KEYWORDS.has(token.upper)) {
    return token.text;
  }

  return target === "lower" ? token.upper.toLowerCase() : token.upper;
}

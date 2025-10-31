// Java: com.sap.adt.abapcleaner.rules.spaces.SpaceBeforePeriodRule

import type { AbapToken, AbapPluginOptions } from "../parsers/types.js";
import { needsSpaceBeforeCommentSign } from "./spaceAroundCommentSignRule.js";

const PUNCTUATION_TO_TRIM = new Set([".", ","]);

export function needsSpaceBefore(
  current: AbapToken,
  previous: AbapToken | undefined,
  options: AbapPluginOptions
): boolean {
  if (!previous) {
    return false;
  }

  if (current.text.trim() == "(") {
    return false;
  }

  if (current.text.trim() == ")") {
    return true;
  }

  if (current.role === "punctuation" && PUNCTUATION_TO_TRIM.has(current.text)) {
    return options.abapSpaceBeforePeriod === true;
  }

  if (current.role === "comment") {
    return needsSpaceBeforeCommentSign(options);
  }

  if (
    current.role === "arrow" ||
    current.text === "->" ||
    current.text === "=>"
  ) {
    return false;
  }

  if (current.text === ")" || current.text === "]" || current.text === ":") {
    return false;
  }

  if (current.role === "punctuation") {
    return false;
  }

  if (current.text === "," || current.text === ".") {
    return false;
  }

  if (
    previous.text === "(" ||
    previous.text === "[" ||
    previous.text === ":" ||
    previous.text === "-" ||
    previous.text === "->" ||
    previous.text === "=>"
  ) {
    return false;
  }

  if (previous.role === "arrow") {
    return false;
  }

  if (
    current.text === "=" &&
    previous &&
    (previous.text === "+" ||
      previous.text === "-" ||
      previous.text === "*" ||
      previous.text === "/" ||
      previous.text === "&&")
  ) {
    return false;
  }

  return true;
}

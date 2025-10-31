// Java: com.sap.adt.abapcleaner.rules.spaces.SpaceAroundCommentSignRule

import type { AbapPluginOptions } from "../parsers/types.js";

const COMMENT_SIGN = '"';

function isLetterOrDigit(char: string): boolean {
  return /^[A-Za-z0-9]$/u.test(char);
}

export function formatCommentValue(
  rawValue: string,
  options: AbapPluginOptions
): string {
  if (options.abapSpaceAfterCommentSign === false) {
    return rawValue;
  }

  const leadingWhitespaceMatch = rawValue.match(/^\s*/u);
  const leadingWhitespace = leadingWhitespaceMatch
    ? leadingWhitespaceMatch[0]
    : "";
  const rest = rawValue.slice(leadingWhitespace.length);

  if (!rest.startsWith(COMMENT_SIGN)) {
    return rawValue;
  }

  if (rest.length <= 1) {
    return rawValue;
  }

  const nextChar = rest.charAt(1);
  if (!isLetterOrDigit(nextChar)) {
    return rawValue;
  }

  return `${leadingWhitespace}${COMMENT_SIGN} ${rest.slice(1)}`;
}

export function needsSpaceBeforeCommentSign(
  options: AbapPluginOptions
): boolean {
  return options.abapSpaceBeforeCommentSign !== false;
}

// Java: com.sap.adt.abapcleaner.rules.spaces.ClosingBracketsPositionRule

import type {
  AbapComment,
  AbapStatement,
  AbapToken,
} from "../parsers/types.js";

type StatementList = readonly AbapStatement[];

const CLOSING_TOKENS = new Set([")", "]"]);
const PERIOD = ".";

interface CommentParts {
  value: string;
  isPseudo: boolean;
}

const postComments = new WeakMap<AbapStatement, AbapComment>();

export function takePostComment(
  statement: AbapStatement,
): AbapComment | undefined {
  const comment = postComments.get(statement);
  if (comment) {
    postComments.delete(statement);
  }
  return comment;
}

export function hasPostComment(statement: AbapStatement): boolean {
  return postComments.has(statement);
}

/**
 * Applies the ClosingBracketsPosition rule to the given list of statements.
 * This mutates token whitespace information in-place to move closing brackets (and
 * possibly trailing periods) up to the previous line, and merges inline comments
 * where this is permitted (mirroring abap-cleaner behaviour).
 */
export function applyClosingBracketsPosition(statements: StatementList): void {
  if (!Array.isArray(statements) || statements.length === 0) {
    return;
  }

  const touchedStatements = new WeakSet<AbapStatement>();

  for (const statement of statements) {
    postComments.delete(statement);

    if (adjustClosingBracketsInTokens(statement.tokens)) {
      touchedStatements.add(statement);
    }

    if (statement.chain) {
      for (const entry of statement.chain.entries) {
        if (entry.tokens) {
          adjustClosingBracketsInTokens(entry.tokens);
        }
      }
    }
  }

  mergeTrailingComments(statements, touchedStatements);
}

/**
 * Removes line breaks that place closing brackets or trailing periods on a dedicated line.
 * Returns true if at least one bracket/period was moved.
 */
export function adjustClosingBracketsInTokens(
  tokens: AbapToken[] | undefined,
): boolean {
  if (!tokens || tokens.length < 2) {
    return false;
  }

  let changed = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const current = tokens[index];
    const previous = tokens[index - 1];
    if (!previous) {
      continue;
    }

    const currentText = simplify(current.text);
    const previousText = simplify(previous.text);

    const isClosingBracket = CLOSING_TOKENS.has(currentText);
    const isPeriod = currentText === PERIOD;
    const shouldMoveBracket = isClosingBracket && shouldAttach(previous);
    const shouldMovePeriod =
      isPeriod && shouldAttach(previous) && CLOSING_TOKENS.has(previousText);

    if (!shouldMoveBracket && !shouldMovePeriod) {
      continue;
    }

    if (previous.hasFollowingLineBreak) {
      previous.hasFollowingLineBreak = false;
      changed = true;
    }

    if (shouldMoveBracket) {
      const next = tokens[index + 1];
      if (
        next &&
        next.loc &&
        current.loc &&
        next.loc.startLine === current.loc.startLine &&
        !shouldKeepTogether(next)
      ) {
        current.hasFollowingLineBreak = true;
      }
      if (
        next &&
        simplify(next.text) === PERIOD &&
        current.hasFollowingLineBreak
      ) {
        current.hasFollowingLineBreak = false;
      }
    }
  }

  return changed;
}

function shouldAttach(previous: AbapToken | undefined): boolean {
  if (!previous) {
    return false;
  }
  if (!previous.hasFollowingLineBreak) {
    return false;
  }
  if (previous.role === "comment") {
    return false;
  }
  return true;
}

function simplify(text: string): string {
  return text.trim();
}

function shouldKeepTogether(next: AbapToken): boolean {
  const text = simplify(next.text);
  if (text === PERIOD) {
    return true;
  }
  if (CLOSING_TOKENS.has(text)) {
    return true;
  }
  if (next.role === "pragma") {
    return true;
  }
  if (next.role === "punctuation") {
    return true;
  }
  return false;
}

function mergeTrailingComments(
  statements: StatementList,
  touched: WeakSet<AbapStatement>,
): void {
  for (let i = 0; i < statements.length - 1; i += 1) {
    const current = statements[i];
    const next = statements[i + 1];

    if (!touched.has(current)) {
      continue;
    }

    const nextComment = next.trailingComment;
    if (!nextComment || !nextComment.inline) {
      continue;
    }

    if (nextComment.loc.startLine !== current.loc.endLine) {
      continue;
    }

    const nextParts = extractCommentParts(nextComment);
    if (!nextParts) {
      continue;
    }

    const currentComment = current.trailingComment;
    const currentParts = currentComment
      ? extractCommentParts(currentComment)
      : undefined;

    if (nextParts.isPseudo || currentParts?.isPseudo) {
      postComments.set(current, cloneComment(nextComment));
      forcePeriodLine(current);
      next.trailingComment = undefined;
      continue;
    }

    const combinedText = currentParts
      ? `${currentParts.value}; ${nextParts.value}`
      : nextParts.value;

    const baseComment: AbapComment = currentComment
      ? { ...currentComment }
      : { ...nextComment };
    baseComment.value = `" ${combinedText}`;
    current.trailingComment = baseComment;
    next.trailingComment = undefined;
  }
}

function extractCommentParts(comment: AbapComment): CommentParts | undefined {
  const trimmed = comment.value.trimStart();
  if (!trimmed.startsWith('"')) {
    return undefined;
  }

  const withoutQuote = trimmed.slice(1).trimStart();
  const isPseudo = withoutQuote.startsWith("#");
  return {
    value: withoutQuote.trim(),
    isPseudo,
  };
}

function cloneComment(comment: AbapComment): AbapComment {
  return {
    ...comment,
  };
}

function forcePeriodLine(statement: AbapStatement): void {
  const tokens = statement.tokens;
  if (!tokens || tokens.length < 2) {
    return;
  }

  for (let index = tokens.length - 1; index >= 1; index -= 1) {
    const current = tokens[index];
    const previous = tokens[index - 1];
    if (!previous) {
      continue;
    }
    if (simplify(current.text) !== PERIOD) {
      continue;
    }
    previous.hasFollowingLineBreak = true;
    break;
  }
}

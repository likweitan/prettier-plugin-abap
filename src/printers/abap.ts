import type { Doc, Printer } from "prettier";
import { doc as prettierDoc } from "prettier";
import type {
  AbapProgram,
  AbapStatement,
  AbapToken,
  AbapPluginOptions,
  AbapComment,
} from "../parsers/types.js";
import { applyKeywordCase } from "../rules/upperAndLowerCaseRule.js";
import { needsSpaceBefore } from "../rules/spaceBeforePeriodRule.js";
import {
  applyClosingBracketsPosition,
  takePostComment,
} from "../rules/closingBracketsPositionRule.js";
import {
  formatCommentValue,
  needsSpaceBeforeCommentSign,
} from "../rules/spaceAroundCommentSignRule.js";
import {
  computeNeedlessSpacesOverrides,
  type NeedlessSpacesOverrides,
} from "../rules/needlessSpacesRule.js";

const { group, hardline, join } = prettierDoc.builders;

let activeNeedlessSpaces: NeedlessSpacesOverrides | undefined;

export function createAbapPrinter(): Printer {
  return {
    print(path, options, print) {
      const node = path.getValue() as
        | AbapProgram
        | AbapStatement
        | AbapToken
        | null;
      const abapOptions = options as AbapPluginOptions;
      if (!node) {
        return "";
      }

      switch (node.type) {
        case "Program":
          return printProgram(path, print);
        case "Statement":
          if (node.chain) {
            return printChainStatement(node, abapOptions);
          }
          return printStatement(node, abapOptions);
        case "Token":
          return node.text;
        default:
          return "";
      }
    },
    canAttachComment() {
      return false;
    },
    printComment(path) {
      const comment = path.getValue();
      return comment?.value ?? "";
    },
  };
}

function printProgram(path: any, print: any): Doc {
  const program = path.getValue() as AbapProgram;
  if (!program || program.body.length === 0) {
    activeNeedlessSpaces = undefined;
    return "";
  }

  applyClosingBracketsPosition(program.body);
  activeNeedlessSpaces = computeNeedlessSpacesOverrides(program.body);

  const docs: Doc[] = [];

  program.body.forEach((_, index) => {
    const statement = program.body[index];
    if (index > 0) {
      const prev = program.body[index - 1];
      let gap = 1;
      if (statement.loc && prev?.loc) {
        gap = Math.max(1, statement.loc.startLine - prev.loc.endLine);
      }
      for (let j = 0; j < gap; j++) {
        docs.push(hardline);
      }
    }
    docs.push(path.call(print, "body", index));
  });

  docs.push(hardline);
  return group(docs);
}

function printStatement(
  statement: AbapStatement,
  options: AbapPluginOptions
): Doc {
  if (statement.tokens.length === 0 && !statement.trailingComment) {
    return "";
  }

  const indentUnit = Math.max(1, options.tabWidth ?? 2);
  const baseIndentWidth =
    statement.indentLevel >= 0
      ? statement.indentLevel * indentUnit
      : Math.max(0, statement.loc.startColumn);
  const indent = " ".repeat(baseIndentWidth);
  const lines: string[] = [];
  const lineMetas: Array<{ startLine: number; endLine: number }> = [];
  let currentLine = indent;
  let previous: AbapToken | undefined;
  let atLineStart = true;
  let currentLineStartLine: number | undefined;
  let currentLineEndLine: number | undefined;

  for (const token of statement.tokens) {
    const text = renderToken(token, options);
    if (text.length === 0) {
      previous = token;
      continue;
    }

    if (token.loc) {
      if (currentLineStartLine === undefined) {
        currentLineStartLine = token.loc.startLine;
      }
      currentLineEndLine = token.loc.startLine;
    }

    if (atLineStart) {
      const relativeIndent = Math.max(
        0,
        token.loc.startColumn - statement.loc.startColumn
      );
      if (relativeIndent > 0) {
        currentLine += " ".repeat(relativeIndent);
      }
      atLineStart = false;
    } else {
      const spaces = getSpacesBeforeToken(token, previous, options);
      if (spaces > 0) {
        if (/\s$/u.test(currentLine)) {
          currentLine = currentLine.replace(/\s+$/u, "");
        }
        currentLine += " ".repeat(spaces);
      }
    }

    currentLine += text;
    previous = token;

    if (token.hasFollowingLineBreak) {
      lines.push(currentLine.replace(/\s+$/u, ""));
      const startLine =
        currentLineStartLine ?? token.loc?.startLine ?? statement.loc.startLine;
      const endLine =
        currentLineEndLine ?? token.loc?.startLine ?? statement.loc.startLine;
      lineMetas.push({ startLine, endLine });
      currentLine = indent;
      previous = undefined;
      atLineStart = true;
      currentLineStartLine = undefined;
      currentLineEndLine = undefined;
    }
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.replace(/\s+$/u, ""));
    const startLine =
      currentLineStartLine ?? statement.loc.endLine ?? statement.loc.startLine;
    const endLine =
      currentLineEndLine ?? statement.loc.endLine ?? statement.loc.startLine;
    lineMetas.push({ startLine, endLine });
  } else if (lines.length === 0) {
    lines.push(currentLine);
    const lineNumber = statement.loc.startLine;
    lineMetas.push({ startLine: lineNumber, endLine: lineNumber });
  }

  if (lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+$/u, "");
  }

  const postComment = takePostComment(statement);

  for (let i = 1; i < lines.length; i++) {
    if (postComment && i === lines.length - 1) {
      continue;
    }
    if (/^[\s]*[.,]/.test(lines[i])) {
      const merged = lines[i - 1].replace(/[\s]*$/, "") + lines[i].trimStart();
      lines.splice(i - 1, 2, merged);
      const previousMeta = lineMetas[i - 1];
      const currentMeta = lineMetas[i];
      lineMetas.splice(i - 1, 2, {
        startLine: previousMeta?.startLine ?? currentMeta?.startLine ?? 0,
        endLine: currentMeta?.endLine ?? previousMeta?.endLine ?? 0,
      });
      i--;
    }
  }

  if (statement.trailingComment) {
    const comment = statement.trailingComment;
    const targetIndex = lineMetas.findIndex(
      (meta) =>
        comment.loc.startLine >= meta.startLine &&
        comment.loc.startLine <= meta.endLine
    );
    if (targetIndex >= 0) {
      lines[targetIndex] = appendComment(
        lines[targetIndex],
        comment,
        options
      );
    } else if (lines.length > 0) {
      const lastIndex = lines.length - 1;
      lines[lastIndex] = appendComment(lines[lastIndex], comment, options);
    } else {
      lines.push(formatCommentValue(comment.value.trimStart(), options));
    }
  }

  if (postComment) {
    if (lines.length === 0) {
      lines.push(formatCommentValue(postComment.value.trimStart(), options));
    } else {
      const lastIndex = lines.length - 1;
      lines[lastIndex] = appendComment(
        lines[lastIndex],
        postComment,
        options
      );
    }
  }

  return join(hardline, lines);
}

function printChainStatement(
  statement: AbapStatement,
  options: AbapPluginOptions
): Doc {
  const { chain } = statement;
  if (!chain) {
    return "";
  }

  const indentUnit = Math.max(1, options.tabWidth ?? 2);
  const baseIndentWidth =
    statement.indentLevel >= 0
      ? statement.indentLevel * indentUnit
      : Math.max(0, statement.loc.startColumn);
  const baseIndent = " ".repeat(baseIndentWidth);
  const keyword = renderToken(chain.keyword, options);
  const inlineFirst = shouldInlineFirstEntry(chain.keyword);
  const firstEntryIndentWidth = inlineFirst
    ? baseIndentWidth + keyword.length + 2
    : baseIndentWidth + indentUnit;
  const entryIndent = " ".repeat(firstEntryIndentWidth);

  const lines: string[] = [];
  let firstEntryHandled = false;

  for (const entry of chain.entries) {
    if (entry.type === "entry") {
      const content = renderTokenSequence(entry.tokens ?? [], options);

      if (!firstEntryHandled) {
        if (inlineFirst && content.length > 0) {
          const line = `${baseIndent}${keyword}: ${content}`;
          lines.push(appendComment(line, entry.trailingComment, options));
        } else {
          lines.push(`${baseIndent}${keyword}:`);
          const line =
            content.length > 0 ? `${entryIndent}${content}` : entryIndent;
          lines.push(appendComment(line, entry.trailingComment, options));
        }
        firstEntryHandled = true;
      } else {
        const line =
          content.length > 0 ? `${entryIndent}${content}` : entryIndent;
        lines.push(appendComment(line, entry.trailingComment, options));
      }
    } else if (entry.type === "comment" && entry.comment) {
      const commentIndent = " ".repeat(
        Math.max(0, entry.comment.loc.startColumn)
      );
      lines.push(
        commentIndent +
          formatCommentValue(entry.comment.value.trimStart(), options)
      );
    }
  }

  if (lines.length === 0) {
    lines.push(`${baseIndent}${keyword}:`);
  }

  for (let i = 1; i < lines.length; i++) {
    if (/^[\s]*[.,]/.test(lines[i])) {
      const merged =
        lines[i - 1].replace(/[\s]*$/, "") + lines[i].trimStart();
      lines.splice(i - 1, 2, merged);
      i--;
    }
  }

  return join(hardline, lines);
}

function appendComment(
  line: string,
  comment: AbapComment | undefined,
  options: AbapPluginOptions
): string {
  if (!comment) {
    return line;
  }

  const formatted = formatCommentValue(comment.value.trimStart(), options);

  if (!needsSpaceBeforeCommentSign(options)) {
    return `${line}${formatted}`;
  }

  if (line.length === 0 || line.endsWith(" ")) {
    return `${line}${formatted}`;
  }

  return `${line} ${formatted}`;
}

function shouldInlineFirstEntry(keyword: AbapToken): boolean {
  const upper = keyword.upper;
  const blockKeywords = new Set(["CLEAR", "FREE", "SORT", "CATCH", "TRY"]);
  return !blockKeywords.has(upper);
}

function renderTokenSequence(
  tokens: AbapToken[],
  options: AbapPluginOptions
): string {
  let result = "";
  let previous: AbapToken | undefined;
  for (const token of tokens) {
    const text = renderToken(token, options);
    if (text.length === 0) {
      previous = token;
      continue;
    }
    if (result.length > 0) {
      const spaces = getSpacesBeforeToken(token, previous, options);
      if (spaces > 0) {
        result = result.trimEnd();
        result += " ".repeat(spaces);
      } else if (isPunctuationToken(token)) {
        result = result.trimEnd();
      }
    }
    result += text;
    previous = token;
  }
  return result.trimEnd();
}

function renderToken(token: AbapToken, options: AbapPluginOptions): string {
  switch (token.role) {
    case "word":
      return applyKeywordCase(token, options);
    case "colon":
      return ":";
    case "arrow":
      return token.text.trim();
    case "comment":
      return formatCommentValue(token.text, options);
    default:
      return token.text;
  }
}

function getSpacesBeforeToken(
  token: AbapToken,
  previous: AbapToken | undefined,
  options: AbapPluginOptions
): number {
  const minSpaces = needsSpaceBefore(token, previous, options) ? 1 : 0;

  const override = activeNeedlessSpaces?.get(token);
  if (override !== undefined) {
    return override;
  }

  if (minSpaces === 0) {
    return 0;
  }

  const originalSpaces = computeOriginalSpaces(token, previous);
  return Math.max(originalSpaces, minSpaces);
}

function isPunctuationToken(token: AbapToken): boolean {
  return token.role === "punctuation" || token.text === "," || token.text === ".";
}

function computeOriginalSpaces(
  token: AbapToken,
  previous: AbapToken | undefined
): number {
  if (!token.loc) {
    return 0;
  }
  if (!previous?.loc) {
    return 0;
  }
  if (previous.loc.endLine !== token.loc.startLine) {
    return 0;
  }
  const diff = token.loc.startColumn - previous.loc.endColumn - 1;
  return diff > 0 ? diff : 0;
}

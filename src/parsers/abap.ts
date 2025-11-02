import { createHash } from "node:crypto";
import path from "node:path";
import type { ParserOptions } from "prettier";
import {
  Registry,
  MemoryFile,
  ABAPObject,
  Tokens,
  Nodes,
  Position,
  VirtualPosition,
} from "@abaplint/core";
import type {
  SourceLocation,
  AbapProgram,
  AbapStatement,
  AbapToken,
  AbapComment,
  AbapChain,
  AbapChainEntry,
  AbapPluginOptions,
} from "./types.js";
import { computeIndentationLevels } from "../rules/indentRule.js";

type StatementNode = Nodes.StatementNode;
type AbstractToken = any;

export type AbapParserOptions = ParserOptions<AbapProgram> & AbapPluginOptions;

const DEFAULT_FILENAME = "stdin.prog.abap";

export function parseAbap(
  source: string,
  options: AbapParserOptions,
): AbapProgram {
  const text = normalizeNewlines(source);
  const filename = inferFilename(options.filepath);
  const lineOffsets = buildLineOffsets(text);
  const hash = createHash("sha1").update(text).digest("hex");

  try {
    const registry = new Registry();
    registry.addFile(new MemoryFile(filename, text));
    registry.parse();

    const object = registry.getFirstObject();
    if (!object || !ABAPObject.is(object)) {
      console.warn(
        `[prettier-plugin-abap] Falling back to raw text: no ABAP object for ${filename}`,
      );
      return buildFallbackAst(text, filename, hash, lineOffsets);
    }

    const abapFile = object.getABAPFiles()[0];
    if (!abapFile) {
      console.warn(
        `[prettier-plugin-abap] Falling back to raw text: no ABAP file for ${filename}`,
      );
      return buildFallbackAst(text, filename, hash, lineOffsets);
    }

    const statements = abapFile.getStatements();
    const indentLevels = computeIndentationLevels(statements);

    const normalizedStatements = convertStatements(
      statements,
      indentLevels,
      lineOffsets,
    );

    const lines = text.split("\n");
    const totalLines = Math.max(lines.length, 1);

    const programLoc = {
      start: 0,
      end: text.length,
      startLine: 1,
      startColumn: 0,
      endLine: totalLines,
      endColumn: (lines.at(-1) ?? "").length,
    };

    return {
      type: "Program",
      filename,
      body: normalizedStatements,
      comments: [],
      loc: programLoc,
      source: text,
      metadata: {
        sourceHash: hash,
      },
    };
  } catch (error) {
    console.warn(
      `[prettier-plugin-abap] Falling back to raw text after parse error in ${filename}:`,
      error,
    );
    return buildFallbackAst(text, filename, hash, lineOffsets);
  }
}

export function locStart(node: { loc?: SourceLocation }): number {
  return node.loc?.start ?? 0;
}

export function locEnd(node: { loc?: SourceLocation }): number {
  return node.loc?.end ?? 0;
}

function inferFilename(filepath: string | undefined): string {
  if (!filepath) {
    return DEFAULT_FILENAME;
  }

  const normalized = filepath.replace(/\\/g, "/");
  const basename = path.basename(normalized);
  if (/\.ddlsrc$/i.test(basename)) {
    return basename;
  }
  if (/\.abap$/i.test(basename)) {
    if (/\.clas\.abap$/i.test(basename) || /\.intf\.abap$/i.test(basename)) {
      return basename;
    }
    return DEFAULT_FILENAME;
  }
  if (/\.clas\.macros$/i.test(basename)) {
    return basename;
  }
  if (/\.intf\.abap$/i.test(basename)) {
    return basename;
  }
  return DEFAULT_FILENAME;
}

function convertStatements(
  statements: readonly StatementNode[],
  indentLevels: number[],
  lineOffsets: number[],
): AbapStatement[] {
  const result: AbapStatement[] = [];
  let index = 0;
  let pendingTrailing: AbapComment | undefined;

  while (index < statements.length) {
    const statement = statements[index];
    const nextStatement = statements[index + 1];

    if (
      isStandaloneComment(statement) &&
      isTrailingComment(statement) &&
      nextStatement
    ) {
      pendingTrailing = {
        ...convertCommentNode(statement, lineOffsets),
        inline: true,
      };
      index += 1;
      continue;
    }

    const colonToken = statement.getColon();

    if (colonToken) {
      const colonKey = buildColonKey(colonToken);
      const group: StatementNode[] = [];
      let cursor = index;

      while (cursor < statements.length) {
        const current = statements[cursor];
        const currentColon = current.getColon();
        if (currentColon && buildColonKey(currentColon) === colonKey) {
          group.push(current);
          cursor++;
          continue;
        }
        if (isStandaloneComment(current)) {
          group.push(current);
          cursor++;
          continue;
        }
        break;
      }

      const chainStatement = convertColonGroup(
        group,
        indentLevels[index] ?? 0,
        lineOffsets,
      );
      result.push(chainStatement);
      index = cursor;
      continue;
    }

    const converted = convertSingleStatement(
      statement,
      indentLevels[index] ?? 0,
      lineOffsets,
    );

    if (pendingTrailing) {
      converted.trailingComment = pendingTrailing;
      pendingTrailing = undefined;
    }

    result.push(converted);
    index += 1;
  }

  return result;
}

function convertSingleStatement(
  statement: StatementNode,
  indentLevel: number,
  lineOffsets: number[],
): AbapStatement {
  const convertedTokens = convertTokens(statement.getTokens(), lineOffsets);
  const pragmaTokens = convertPragmas(statement, lineOffsets);
  const tokensWithPragmas = mergeTokensWithPragmas(
    convertedTokens,
    pragmaTokens,
  );
  const trailingComment = extractTrailingComment(tokensWithPragmas);

  return buildStatementObject(
    statement,
    tokensWithPragmas,
    indentLevel,
    lineOffsets,
    trailingComment,
    undefined,
    statement,
    pragmaTokens,
  );
}

function convertColonGroup(
  group: readonly StatementNode[],
  indentLevel: number,
  lineOffsets: number[],
): AbapStatement {
  if (group.length === 0) {
    throw new Error("convertColonGroup called with empty group");
  }

  const entries: AbapChainEntry[] = [];
  const chainPragmas: AbapToken[] = [];
  const keywordSource = group[0];
  const keywordTokens = convertTokens(keywordSource.getTokens(), lineOffsets);
  if (keywordTokens.length === 0) {
    throw new Error("Colon group keyword statement without tokens");
  }

  const keyword = keywordTokens[0];
  let idx = 0;
  let lastStatementWithTokens: StatementNode = keywordSource;
  let pendingTrailing: AbapComment | undefined;

  while (idx < group.length) {
    const current = group[idx];
    const colon = current.getColon();

    if (colon) {
      const tokens = convertTokens(current.getTokens(), lineOffsets);
      if (tokens.length === 0) {
        idx += 1;
        continue;
      }

      const pragmaTokens = convertPragmas(current, lineOffsets);
      const entryTokens = mergeTokensWithPragmas(tokens.slice(1), pragmaTokens);
      chainPragmas.push(...pragmaTokens);
      let trailingComment = pendingTrailing;
      pendingTrailing = undefined;

      entries.push({
        type: "entry",
        tokens: entryTokens,
        trailingComment,
      });
      lastStatementWithTokens = current;
    } else if (isStandaloneComment(current)) {
      const previous = group[idx - 1];
      if (
        isTrailingComment(current) &&
        group[idx + 1]?.getColon() &&
        previous?.getColon()
      ) {
        const comment = convertCommentNode(current, lineOffsets);
        pendingTrailing = {
          ...comment,
          inline: true,
        };
        lastStatementWithTokens = current;
      } else {
        const comment = convertCommentNode(current, lineOffsets);
        entries.push({
          type: "comment",
          comment,
        });
        lastStatementWithTokens = current;
      }
    }

    idx += 1;
  }

  if (pendingTrailing) {
    entries.push({
      type: "comment",
      comment: {
        ...pendingTrailing,
        inline: false,
      },
    });
  }

  entries.sort((a, b) => getEntryStartLine(a) - getEntryStartLine(b));
  const chain: AbapChain = {
    keyword,
    entries,
  };

  const allTokens = entries.flatMap((entry) =>
    entry.type === "entry" ? (entry.tokens ?? []) : [],
  );

  const trailingComment =
    entries.length > 0
      ? entries[entries.length - 1].trailingComment
      : undefined;

  return buildStatementObject(
    keywordSource,
    allTokens,
    indentLevel,
    lineOffsets,
    trailingComment,
    chain,
    lastStatementWithTokens,
    chainPragmas,
  );
}

function buildStatementObject(
  statement: StatementNode,
  tokens: AbapToken[],
  indentLevel: number,
  lineOffsets: number[],
  trailingComment?: AbapComment,
  chain?: AbapChain,
  endStatement: StatementNode = statement,
  pragmas: AbapToken[] = [],
): AbapStatement {
  const loc = calcStatementLocation(
    statement.getTokens(),
    lineOffsets,
    endStatement.getTokens(),
  );

  return {
    type: "Statement",
    kind: statement.get().constructor.name,
    tokens,
    loc,
    indentLevel,
    leadingComments: [],
    trailingComment,
    pragmas,
    raw: statement.concatTokens(),
    chain,
  };
}

function convertTokens(
  tokens: readonly AbstractToken[],
  lineOffsets: number[],
): AbapToken[] {
  const result: AbapToken[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const next = tokens[index + 1];
    result.push(convertToken(token, next, lineOffsets));
  }
  return result;
}

function getEntryStartLine(entry: AbapChainEntry): number {
  if (entry.type === "entry") {
    const token = entry.tokens?.[0];
    return token ? token.loc.startLine : Number.MAX_SAFE_INTEGER;
  }
  return entry.comment ? entry.comment.loc.startLine : Number.MAX_SAFE_INTEGER;
}

function convertPragmas(
  statement: StatementNode,
  lineOffsets: number[],
): AbapToken[] {
  const pragmas = statement.getPragmas();
  const result: AbapToken[] = [];
  for (const pragma of pragmas) {
    result.push(convertToken(pragma, undefined, lineOffsets));
  }
  return result;
}

function mergeTokensWithPragmas(
  tokens: AbapToken[],
  pragmas: AbapToken[],
): AbapToken[] {
  if (pragmas.length === 0) {
    return tokens;
  }
  if (tokens.length === 0) {
    return [...pragmas];
  }
  const result = [...tokens];
  const last = result[result.length - 1];
  if (
    last &&
    (last.role === "punctuation" || last.text === "," || last.text === ".")
  ) {
    result.splice(result.length - 1, 0, ...pragmas);
  } else {
    result.push(...pragmas);
  }
  return result;
}

function convertToken(
  token: AbstractToken,
  next: AbstractToken | undefined,
  lineOffsets: number[],
): AbapToken {
  const tokenLoc = calcLocation(token.getStart(), token.getEnd(), lineOffsets);
  const hasBreak = next ? isNewLineBetween(token, next) : false;
  const role = classifyToken(token);
  const text = token.getStr();

  return {
    type: "Token",
    role,
    text,
    upper: text.toUpperCase(),
    loc: tokenLoc,
    hasFollowingLineBreak: hasBreak,
  };
}

function convertCommentNode(
  statement: StatementNode,
  lineOffsets: number[],
): AbapComment {
  const token = statement.getTokens()[0];
  const loc = calcLocation(token.getStart(), token.getEnd(), lineOffsets);
  return {
    type: "Comment",
    value: token.getStr(),
    inline: false,
    loc,
  };
}

function isStandaloneComment(statement: StatementNode): boolean {
  return statement.get().constructor.name === "Comment";
}

function isTrailingComment(statement: StatementNode): boolean {
  if (!isStandaloneComment(statement)) {
    return false;
  }
  const text = statement.getTokens()[0]?.getStr() ?? "";
  return text.trimStart().startsWith('"');
}

function extractTrailingComment(tokens: AbapToken[]): AbapComment | undefined {
  const index = tokens.findIndex((token) => token.role === "comment");
  if (index === -1) {
    return undefined;
  }
  const trailing = tokens[index];
  tokens.splice(index, 1);
  return {
    type: "Comment",
    value: trailing.text,
    inline: true,
    loc: trailing.loc,
  };
}

function calcStatementLocation(
  startTokens: readonly AbstractToken[],
  lineOffsets: number[],
  endTokens: readonly AbstractToken[] = startTokens,
): SourceLocation {
  if (startTokens.length === 0 || endTokens.length === 0) {
    return {
      start: 0,
      end: 0,
      startLine: 1,
      startColumn: 0,
      endLine: 1,
      endColumn: 0,
    };
  }

  const first = startTokens[0];
  const last = endTokens[endTokens.length - 1];
  return calcLocation(first.getStart(), last.getEnd(), lineOffsets);
}

function calcLocation(
  start: Position | VirtualPosition,
  end: Position | VirtualPosition,
  lineOffsets: number[],
): SourceLocation {
  const startOffset = positionToOffset(start, lineOffsets);
  const endOffset = positionToOffset(end, lineOffsets);
  return {
    start: startOffset,
    end: endOffset,
    startLine: start.getRow(),
    startColumn: start.getCol() - 1,
    endLine: end.getRow(),
    endColumn: end.getCol() - 1,
  };
}

function positionToOffset(
  pos: Position | VirtualPosition,
  lineOffsets: number[],
): number {
  const row = Math.max(pos.getRow(), 1);
  const col = Math.max(pos.getCol(), 1);
  const lineStart = lineOffsets[row - 1] ?? 0;
  return lineStart + (col - 1);
}

function classifyToken(token: any): AbapToken["role"] {
  if (token instanceof Tokens.Comment) {
    return "comment";
  }
  if (token instanceof Tokens.Pragma) {
    return "pragma";
  }
  if (token instanceof Tokens.Punctuation) {
    return "punctuation";
  }
  if (
    token instanceof Tokens.StringToken ||
    token instanceof Tokens.StringTemplate ||
    token instanceof Tokens.StringTemplateBegin ||
    token instanceof Tokens.StringTemplateMiddle ||
    token instanceof Tokens.StringTemplateEnd
  ) {
    return "string";
  }
  if (token instanceof Tokens.Colon) {
    return "colon";
  }
  if (
    token instanceof Tokens.StaticArrow ||
    token instanceof Tokens.InstanceArrow ||
    token instanceof Tokens.WInstanceArrow ||
    token instanceof Tokens.WStaticArrow
  ) {
    return "arrow";
  }
  return "word";
}

function isNewLineBetween(current: any, next: any): boolean {
  return current.getEnd().getRow() < next.getStart().getRow();
}

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, "\n");
}

function buildLineOffsets(text: string): number[] {
  const offsets: number[] = [];
  let current = 0;
  offsets.push(0);
  for (const line of text.split("\n")) {
    current += line.length + 1;
    offsets.push(current);
  }
  return offsets;
}

function buildFallbackAst(
  text: string,
  filename: string,
  hash: string,
  lineOffsets: number[],
): AbapProgram {
  const lines = text.split("\n");
  const statements: AbapStatement[] = lines.map((line, index) => {
    const startOffset = lineOffsets[index] ?? 0;
    const endOffset = startOffset + line.length;
    const loc: SourceLocation = {
      start: startOffset,
      end: endOffset,
      startLine: index + 1,
      startColumn: 0,
      endLine: index + 1,
      endColumn: line.length,
    };
    const token: AbapToken = {
      type: "Token",
      role: "word",
      text: line.trim(),
      upper: line.trim().toUpperCase(),
      loc,
      hasFollowingLineBreak: false,
      original: line,
    };
    return {
      type: "Statement",
      kind: "Fallback",
      tokens: token.text === "" ? [] : [token],
      indentLevel: 0,
      loc,
      leadingComments: [],
      pragmas: [],
      raw: line,
    };
  });

  return {
    type: "Program",
    filename,
    body: statements,
    comments: [],
    loc: {
      start: 0,
      end: text.length,
      startLine: 1,
      startColumn: 0,
      endLine: lines.length,
      endColumn: lines.at(-1)?.length ?? 0,
    },
    source: text,
    metadata: {
      sourceHash: hash,
    },
  };
}

function buildColonKey(token: AbstractToken): string {
  const start = token.getStart();
  return `${start.getRow()}:${start.getCol()}`;
}

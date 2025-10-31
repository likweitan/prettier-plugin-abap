// Java: com.sap.adt.abapcleaner.rules.spaces.NeedlessSpacesRule

import type { AbapStatement, AbapToken } from "../parsers/types.js";

const ASSIGNMENT_OPERATORS = new Set([
  "=",
  ":=",
  "+=",
  "-=",
  "*=",
  "/=",
  "&&=",
  "&&= ",
  "?=",
]);

const COMPARISON_OPERATORS = new Set([
  "=",
  "==",
  "<>",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
]);

const NUMERIC_LITERAL = /^[+-]?(?:\d+|'[\d.]+')(?:\.\d+)?$/u;

type TokenType =
  | "COLON"
  | "COMMA"
  | "PERIOD"
  | "ASSIGNMENT_OP"
  | "COMPARISON_OP"
  | "COMMENT"
  | "PRAGMA"
  | "LITERAL"
  | "IDENTIFIER";

interface TokenPos {
  token: AbapToken;
  startColumn: number;
  endColumn: number;
  lineNumber: number;
  commandNumber: number;
  spacesLeft: number;
  isFirstInLine: boolean;
  startIndexInLine: number;
  prevEndColumn: number;
  tokenType: TokenType;
  prevTokenType?: TokenType;
}

export type NeedlessSpacesOverrides = WeakMap<AbapToken, number>;

export function computeNeedlessSpacesOverrides(
  statements: readonly AbapStatement[]
): NeedlessSpacesOverrides {
  const overrides: NeedlessSpacesOverrides = new WeakMap();
  const tokensOfXPos = new Map<number, TokenPos[]>();
  const firstTokenOfLine = new Map<number, TokenPos>();
  const groupedTokens = new WeakSet<AbapToken>();
  const allTokenPositions: TokenPos[] = [];

  collectTokenPositions(
    statements,
    tokensOfXPos,
    firstTokenOfLine,
    allTokenPositions
  );
  if (tokensOfXPos.size === 0) {
    return overrides;
  }

  const processedTokens = new WeakSet<AbapToken>();
  const sortedXPositions = Array.from(tokensOfXPos.keys()).sort((a, b) => a - b);

  for (let index = sortedXPositions.length - 1; index >= 0; index -= 1) {
    const xPosKey = sortedXPositions[index];
    const tokenPosList = tokensOfXPos.get(xPosKey);
    if (!tokenPosList || tokenPosList.length < 2) {
      continue;
    }

    tokenPosList.sort(compareTokenPos);

    const isSpecialAlignment = xPosKey % 2 !== 0;
    const realXPos = Math.floor(xPosKey / 2);

    let startIndex = 0;
    while (startIndex < tokenPosList.length) {
      const firstTokenPos = tokenPosList[startIndex];
      let prevTokenPos = firstTokenPos;
      let endIndex = startIndex;
      let skipSequence = false;

      while (true) {
        if (processedTokens.has(prevTokenPos.token)) {
          skipSequence = true;
        }

        endIndex += 1;
        if (endIndex >= tokenPosList.length) {
          break;
        }

        const testTokenPos = tokenPosList[endIndex];
        if (
          tokenBreaksSequence(
            firstTokenPos,
            prevTokenPos,
            testTokenPos,
            realXPos,
            firstTokenOfLine
          )
        ) {
          break;
        }

        prevTokenPos = testTokenPos;
      }

      if (!skipSequence) {
        processSequence(
          tokenPosList,
          startIndex,
          endIndex,
          isSpecialAlignment,
          processedTokens,
          overrides,
          groupedTokens
        );
      }

      startIndex = endIndex;
    }
  }

  condenseStandaloneTokens(allTokenPositions, groupedTokens, overrides);
  applyEmptyBracketOverrides(statements, overrides);
  return overrides;
}

function compareTokenPos(a: TokenPos, b: TokenPos): number {
  if (a.lineNumber !== b.lineNumber) {
    return a.lineNumber - b.lineNumber;
  }
  if (a.commandNumber !== b.commandNumber) {
    return a.commandNumber - b.commandNumber;
  }
  return a.startColumn - b.startColumn;
}

function collectTokenPositions(
  statements: readonly AbapStatement[],
  tokensOfXPos: Map<number, TokenPos[]>,
  firstTokenOfLine: Map<number, TokenPos>,
  collectedTokens: TokenPos[]
): void {
  let commandNumber = 0;

  for (const statement of statements) {
    collectFromTokens(
      statement.tokens ?? [],
      commandNumber,
      tokensOfXPos,
      firstTokenOfLine,
      collectedTokens
    );

    if (statement.chain) {
      for (const entry of statement.chain.entries) {
        if (entry.type === "entry" && entry.tokens) {
          collectFromTokens(
            entry.tokens,
            commandNumber,
            tokensOfXPos,
            firstTokenOfLine,
            collectedTokens
          );
        }
      }
    }

    commandNumber += 1;
  }
}

function applyEmptyBracketOverrides(
  statements: readonly AbapStatement[],
  overrides: NeedlessSpacesOverrides
): void {
  for (const statement of statements) {
    applyEmptyBracketOverridesToTokens(statement.tokens ?? [], overrides);
    if (statement.chain) {
      for (const entry of statement.chain.entries) {
        if (entry.type === "entry" && entry.tokens) {
          applyEmptyBracketOverridesToTokens(entry.tokens, overrides);
        }
      }
    }
  }
}

function applyEmptyBracketOverridesToTokens(
  tokens: readonly AbapToken[],
  overrides: NeedlessSpacesOverrides
): void {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const current = tokens[index];
    const next = tokens[index + 1];
    if (!current?.loc || !next?.loc) {
      continue;
    }

    if (!isMatchingBracketPair(current.text, next.text)) {
      continue;
    }

    if (current.loc.endLine !== next.loc.startLine) {
      continue;
    }

    const spacesBetween = next.loc.startColumn - current.loc.endColumn - 1;
    if (spacesBetween > 0) {
      overrides.set(next, 0);
    }
  }
}

function isMatchingBracketPair(open: string, close: string): boolean {
  return (
    (open === "(" && close === ")") || (open === "[" && close === "]")
  );
}

function condenseStandaloneTokens(
  tokenPositions: readonly TokenPos[],
  groupedTokens: WeakSet<AbapToken>,
  overrides: NeedlessSpacesOverrides
): void {
  for (const tokenPos of tokenPositions) {
    if (tokenPos.isFirstInLine) {
      continue;
    }
    if (groupedTokens.has(tokenPos.token)) {
      continue;
    }
    if (overrides.has(tokenPos.token)) {
      continue;
    }
    if (
      tokenPos.tokenType === "COMMENT" ||
      tokenPos.tokenType === "PRAGMA" ||
      tokenPos.tokenType === "COMMA" ||
      tokenPos.tokenType === "PERIOD" ||
      tokenPos.tokenType === "COLON"
    ) {
      continue;
    }
    if (tokenPos.spacesLeft <= 1) {
      continue;
    }
    overrides.set(tokenPos.token, 1);
  }
}

function collectFromTokens(
  tokens: readonly AbapToken[],
  commandNumber: number,
  tokensOfXPos: Map<number, TokenPos[]>,
  firstTokenOfLine: Map<number, TokenPos>,
  collectedTokens: TokenPos[]
): void {
  let previous: TokenPos | undefined;

  for (const token of tokens) {
    if (!token?.loc) {
      previous = undefined;
      continue;
    }

    const startColumn = Math.max(0, token.loc.startColumn ?? 0);
    const endColumn = Math.max(
      startColumn,
      token.loc.endColumn ?? startColumn + token.text.length
    );
    const lineNumber = token.loc.startLine ?? 0;
    const isNewLine =
      !previous || previous.lineNumber !== lineNumber || previous.token === undefined;
    let prevEndColumn: number;
    let spacesLeft: number;
    if (isNewLine || !previous) {
      prevEndColumn = startColumn - 1;
      spacesLeft = startColumn;
    } else {
      prevEndColumn = previous.endColumn;
      spacesLeft = Math.max(0, startColumn - prevEndColumn - 1);
    }
    const tokenType = classifyTokenType(token);

    const tokenPos: TokenPos = {
      token,
      startColumn,
      endColumn,
      lineNumber,
      commandNumber,
      spacesLeft,
      isFirstInLine: isNewLine,
      startIndexInLine: startColumn,
      prevEndColumn,
      tokenType,
      prevTokenType: previous?.tokenType,
    };

    collectedTokens.push(tokenPos);

    if (isNewLine && !firstTokenOfLine.has(lineNumber)) {
      firstTokenOfLine.set(lineNumber, tokenPos);
    }

    addTokenPos(tokensOfXPos, tokenPos, 2 * tokenPos.startIndexInLine);

    if (isAssignmentOperatorToken(token)) {
      const specialXPos = tokenPos.startIndexInLine + getTokenLength(token) - 1;
      addTokenPos(tokensOfXPos, tokenPos, 2 * specialXPos + 1);
    } else if (isComparisonOperatorToken(token)) {
      const specialXPos = tokenPos.startIndexInLine + getTokenLength(token) - 1;
      addTokenPos(tokensOfXPos, tokenPos, 2 * specialXPos + 1);
    } else if (isNumericLiteralToken(token)) {
      const specialXPos =
        tokenPos.startIndexInLine + getNumericAlignmentIndex(token.text);
      addTokenPos(tokensOfXPos, tokenPos, 2 * specialXPos + 1);
    }

    previous = tokenPos;
  }
}

function addTokenPos(
  tokensOfXPos: Map<number, TokenPos[]>,
  tokenPos: TokenPos,
  key: number
): void {
  const list = tokensOfXPos.get(key);
  if (list) {
    list.push(tokenPos);
  } else {
    tokensOfXPos.set(key, [tokenPos]);
  }
}

function tokenBreaksSequence(
  firstTokenPos: TokenPos,
  prevTokenPos: TokenPos,
  testTokenPos: TokenPos,
  xPos: number,
  firstTokenOfLine: Map<number, TokenPos>
): boolean {
  if (
    firstTokenPos.tokenType !== "COMMENT" &&
    prevTokenPos.commandNumber !== testTokenPos.commandNumber &&
    testTokenPos.lineNumber > prevTokenPos.lineNumber + 1
  ) {
    for (
      let line = prevTokenPos.lineNumber + 1;
      line < testTokenPos.lineNumber;
      line += 1
    ) {
      const firstOfLine = firstTokenOfLine.get(line);
      if (!firstOfLine) {
        continue;
      }
      if (
        firstOfLine.startIndexInLine < xPos &&
        !isSequenceBridgeKeyword(firstOfLine.token)
      ) {
        return true;
      }
    }
  }

  if (
    firstTokenPos.prevTokenType === "ASSIGNMENT_OP" &&
    testTokenPos.prevTokenType === "ASSIGNMENT_OP"
  ) {
    return false;
  }

  if (!tokenTypesMatch(firstTokenPos.tokenType, testTokenPos.tokenType)) {
    return true;
  }

  return false;
}

function tokenTypesMatch(type1: TokenType, type2: TokenType): boolean {
  if (type1 === "COLON" || type2 === "COLON") {
    return type1 === type2;
  }
  if (type1 === "COMMA" || type2 === "COMMA") {
    return type1 === type2;
  }
  if (type1 === "PERIOD" || type2 === "PERIOD") {
    return type1 === type2;
  }

  if (type1 === "ASSIGNMENT_OP" || type2 === "ASSIGNMENT_OP") {
    return type1 === type2;
  }
  if (type1 === "COMPARISON_OP" || type2 === "COMPARISON_OP") {
    return type1 === type2;
  }
  if (type1 === "COMMENT" || type2 === "COMMENT") {
    return type1 === type2;
  }
  if (type1 === "PRAGMA" || type2 === "PRAGMA") {
    return type1 === type2;
  }

  return true;
}

function processSequence(
  tokenPosList: TokenPos[],
  startIndex: number,
  endIndex: number,
  isSpecialAlignment: boolean,
  processedTokens: WeakSet<AbapToken>,
  overrides: NeedlessSpacesOverrides,
  groupedTokens: WeakSet<AbapToken>
): void {
  if (endIndex - startIndex < 2) {
    return;
  }

  for (let index = startIndex; index < endIndex; index += 1) {
    groupedTokens.add(tokenPosList[index].token);
  }

  let spacesToSpare = Number.POSITIVE_INFINITY;
  let hasFirstTokensOnly = true;
  let allStartColumnsEqual = true;

  let maxPrevEndColumn = 0;
  if (isSpecialAlignment) {
    const firstTokenPos = tokenPosList[startIndex];
    for (let index = startIndex; index < endIndex; index += 1) {
      const testTokenPos = tokenPosList[index];
      if (!testTokenPos.isFirstInLine) {
        maxPrevEndColumn = Math.max(
          maxPrevEndColumn,
          testTokenPos.prevEndColumn
        );
      }
      if (testTokenPos.startIndexInLine !== firstTokenPos.startIndexInLine) {
        allStartColumnsEqual = false;
      }
    }
    if (allStartColumnsEqual) {
      return;
    }
    for (let index = startIndex; index < endIndex; index += 1) {
      processedTokens.add(tokenPosList[index].token);
    }
  }

  for (let index = startIndex; index < endIndex; index += 1) {
    const testTokenPos = tokenPosList[index];
    const spacesLeft = Math.max(0, testTokenPos.spacesLeft);
    const testSpacesToSpare = isSpecialAlignment
      ? testTokenPos.startIndexInLine - maxPrevEndColumn - 1
      : spacesLeft - 1;
    spacesToSpare = Math.min(spacesToSpare, testSpacesToSpare);

    if (!testTokenPos.isFirstInLine) {
      hasFirstTokensOnly = false;
    }
  }

  if (hasFirstTokensOnly || spacesToSpare <= 0 || !isFinite(spacesToSpare)) {
    return;
  }

  for (let index = startIndex; index < endIndex; index += 1) {
    const tokenPos = tokenPosList[index];
    if (
      tokenPos.tokenType === "COMMA" ||
      tokenPos.tokenType === "PERIOD" ||
      tokenPos.tokenType === "COLON"
    ) {
      continue;
    }
    if (tokenPos.isFirstInLine) {
      continue;
    }
    if (tokenPos.tokenType === "COMMENT") {
      continue;
    }

    const newSpaces = Math.max(0, tokenPos.spacesLeft - spacesToSpare);
    overrides.set(tokenPos.token, newSpaces);
  }
}

function classifyTokenType(token: AbapToken): TokenType {
  if (token.text === ":") {
    return "COLON";
  }
  if (token.text === ",") {
    return "COMMA";
  }
  if (token.text === ".") {
    return "PERIOD";
  }
  if (isAssignmentOperatorToken(token)) {
    return "ASSIGNMENT_OP";
  }
  if (isComparisonOperatorToken(token)) {
    return "COMPARISON_OP";
  }
  if (token.role === "comment") {
    return "COMMENT";
  }
  if (token.role === "pragma") {
    return "PRAGMA";
  }
  if (token.role === "string" || isNumericLiteralToken(token)) {
    return "LITERAL";
  }
  return "IDENTIFIER";
}

function getTokenLength(token: AbapToken): number {
  if (token.loc) {
    return Math.max(1, token.loc.endColumn - token.loc.startColumn);
  }
  return token.text.length;
}

function isAssignmentOperatorToken(token: AbapToken): boolean {
  return ASSIGNMENT_OPERATORS.has(token.text.trim());
}

function isComparisonOperatorToken(token: AbapToken): boolean {
  return COMPARISON_OPERATORS.has(token.text.trim());
}

function isNumericLiteralToken(token: AbapToken): boolean {
  return NUMERIC_LITERAL.test(token.text.trim());
}

function getNumericAlignmentIndex(text: string): number {
  const trimmed = text.trim();
  const dotIndex = trimmed.indexOf(".");
  if (dotIndex >= 0) {
    return Math.max(0, dotIndex - 1);
  }
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const char = trimmed.charAt(index);
    if (char !== "-" && char !== "'") {
      return index;
    }
  }
  return trimmed.length;
}

function isSequenceBridgeKeyword(token: AbapToken): boolean {
  const upper = token.upper ?? token.text.toUpperCase();
  return upper === "ELSE" || upper === "ELSEIF" || upper === "WHEN";
}

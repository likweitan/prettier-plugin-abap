// Java: com.sap.adt.abapcleaner.rules.prettyprinter.IndentRule

import type { Nodes } from "@abaplint/core";
import { Statements, VirtualPosition } from "@abaplint/core";

type StatementNode = Nodes.StatementNode;
type StatementToken = ReturnType<StatementNode["getFirstToken"]>;

const DEDENT_BEFORE = [
  Statements.EndIf,
  Statements.EndWhile,
  Statements.EndLoop,
  Statements.EndSelect,
  Statements.EndTry,
  Statements.EndCase,
  Statements.EndDo,
  Statements.EndFunction,
  Statements.EndMethod,
  Statements.EndClass,
  Statements.EndModule,
  Statements.EndForm,
  Statements.EndInterface,
  Statements.EndChain,
  Statements.EndAt,
  Statements.EndExec,
  Statements.EndCatch,
  Statements.EndTestInjection,
  Statements.EndTestSeam,
];

const MIDDLE_KEYWORDS = [
  Statements.Else,
  Statements.ElseIf,
  Statements.Catch,
  Statements.Cleanup,
  Statements.When,
  Statements.WhenType,
  Statements.WhenOthers,
];

const INDENT_AFTER = [
  Statements.If,
  Statements.Else,
  Statements.ElseIf,
  Statements.While,
  Statements.Loop,
  Statements.Select,
  Statements.SelectLoop,
  Statements.Do,
  Statements.Try,
  Statements.Case,
  Statements.CaseType,
  Statements.Catch,
  Statements.Cleanup,
  Statements.ClassDefinition,
  Statements.ClassImplementation,
  Statements.MethodImplementation,
  Statements.FunctionModule,
  Statements.Module,
  Statements.Define,
  Statements.Form,
  Statements.TestSeam,
  Statements.TestInjection,
];

const ALIGN_WITH_NEXT = [
  Statements.Else,
  Statements.ElseIf,
  Statements.Catch,
  Statements.Cleanup,
  Statements.When,
  Statements.WhenType,
  Statements.WhenOthers,
];

const KEEP_EXISTING_INDENT = -1;

function matches(type: unknown, constructors: readonly Function[]): boolean {
  return constructors.some((Ctor) => type instanceof (Ctor as any));
}

/**
 * Computes indentation depth (in logical levels) for every statement node.
 */
export function computeIndentationLevels(
  statements: readonly StatementNode[],
): number[] {
  const result: number[] = [];
  let depth = 0;
  let activeAlignDepth: number | undefined;
  let activeAlignTarget: number | undefined;
  const selectBlocks = findSelectBlocks(statements);

  for (const statement of statements) {
    const index = result.length;

    if (activeAlignTarget !== undefined && index >= activeAlignTarget) {
      activeAlignTarget = undefined;
      activeAlignDepth = undefined;
    }

    const firstToken = statement.getFirstToken() as StatementToken | undefined;
    if (!firstToken || firstToken.getStart() instanceof VirtualPosition) {
      result.push(KEEP_EXISTING_INDENT);
      continue;
    }

    const type = statement.get();

    if (matches(type, DEDENT_BEFORE) || matches(type, MIDDLE_KEYWORDS)) {
      depth = Math.max(depth - 1, 0);
    }

    let indentLevel = depth;

    if (activeAlignDepth !== undefined) {
      indentLevel = activeAlignDepth;
    } else if (isStandaloneComment(statement)) {
      const alignment = findAlignmentTarget(statements, index, depth);
      if (alignment) {
        activeAlignTarget = alignment.targetIndex;
        activeAlignDepth = alignment.alignDepth;
        indentLevel = alignment.alignDepth;
      }
    }

    result.push(indentLevel);

    const isSelectStatement =
      type instanceof Statements.Select ||
      type instanceof Statements.SelectLoop;
    const shouldIndentAfter =
      matches(type, INDENT_AFTER) &&
      (!isSelectStatement || selectBlocks.has(index));

    if (shouldIndentAfter) {
      depth += 1;
    }
  }

  return result;
}

function isStandaloneComment(statement: StatementNode): boolean {
  return statement.get().constructor.name === "Comment";
}

function findAlignmentTarget(
  statements: readonly StatementNode[],
  startIndex: number,
  currentDepth: number,
): { targetIndex: number; alignDepth: number } | undefined {
  if (currentDepth <= 0) {
    return undefined;
  }

  const current = statements[startIndex];
  const previous = statements[startIndex - 1];

  if (!hasBlankLineAbove(current, previous)) {
    return undefined;
  }

  let cursor = startIndex + 1;
  while (cursor < statements.length) {
    const candidate = statements[cursor];
    if (!candidate) {
      break;
    }
    if (
      isStandaloneComment(candidate) &&
      !hasBlankLineAbove(candidate, statements[cursor - 1])
    ) {
      cursor += 1;
      continue;
    }
    break;
  }

  if (cursor >= statements.length) {
    return undefined;
  }

  const target = statements[cursor];
  const targetType = target.get();
  if (!matches(targetType, ALIGN_WITH_NEXT)) {
    return undefined;
  }

  return {
    targetIndex: cursor,
    alignDepth: Math.max(currentDepth - 1, 0),
  };
}

function hasBlankLineAbove(
  statement: StatementNode,
  previous?: StatementNode,
): boolean {
  if (!previous) {
    return false;
  }

  const prevTokens = previous.getTokens();
  const currentTokens = statement.getTokens();

  if (prevTokens.length === 0 || currentTokens.length === 0) {
    return false;
  }

  const prevEnd = prevTokens[prevTokens.length - 1]?.getEnd();
  const currentStart = currentTokens[0]?.getStart();

  if (!prevEnd || !currentStart) {
    return false;
  }

  return currentStart.getRow() - prevEnd.getRow() >= 2;
}

function findSelectBlocks(statements: readonly StatementNode[]): Set<number> {
  const result = new Set<number>();
  const stack: number[] = [];

  for (let index = 0; index < statements.length; index++) {
    const statement = statements[index];
    const type = statement.get();
    const isSelect =
      type instanceof Statements.Select ||
      type instanceof Statements.SelectLoop;

    if (isSelect) {
      stack.push(index);
      continue;
    }

    if (type instanceof Statements.EndSelect) {
      const selectIndex = stack.pop();
      if (selectIndex !== undefined) {
        result.add(selectIndex);
      }
    }
  }

  return result;
}

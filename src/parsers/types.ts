export interface SourceLocation {
  start: number;
  end: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type AbapNode = AbapProgram | AbapStatement | AbapToken;

export interface AbapProgram {
  type: "Program";
  filename: string;
  body: AbapStatement[];
  comments: AbapComment[];
  loc: SourceLocation;
  source: string;
  metadata: {
    sourceHash: string;
  };
}

export interface AbapStatement {
  type: "Statement";
  kind: string;
  tokens: AbapToken[];
  loc: SourceLocation;
  indentLevel: number;
  leadingComments: AbapComment[];
  trailingComment?: AbapComment;
  pragmas: AbapToken[];
  raw: string;
  chain?: AbapChain;
  blankLinesBefore?: number;
}

export interface AbapComment {
  type: "Comment";
  value: string;
  inline: boolean;
  loc: SourceLocation;
}

export interface AbapChainEntry {
  type: "entry" | "comment";
  tokens?: AbapToken[];
  trailingComment?: AbapComment;
  comment?: AbapComment;
}

export interface AbapChain {
  keyword: AbapToken;
  entries: AbapChainEntry[];
}

export interface AbapToken {
  type: "Token";
  role: TokenRole;
  text: string;
  upper: string;
  loc: SourceLocation;
  hasFollowingLineBreak: boolean;
  original?: string;
}

export type TokenRole =
  | "word"
  | "punctuation"
  | "comment"
  | "pragma"
  | "string"
  | "colon"
  | "arrow"
  | "unknown";

export interface AbapPluginOptions {
  abapKeywordCase?: "upper" | "lower";
  abapSpaceBeforePeriod?: boolean;
  abapSpaceBeforeCommentSign?: boolean;
  abapSpaceAfterCommentSign?: boolean;
  abapChainFormatting?: "preserve" | "expand";
  tabWidth?: number;
  useTabs?: boolean;
  printWidth?: number;
}

import type {
  Parser,
  ParserOptions,
  Plugin,
  Printer,
  SupportLanguage,
  SupportOptions,
} from "prettier";
import {
  parseAbap,
  locStart,
  locEnd,
  type AbapParserOptions,
} from "./parsers/abap.js";
import type { AbapProgram, AbapPluginOptions } from "./parsers/types.js";
import { createAbapPrinter } from "./printers/abap.js";

type AbapParser = Parser<AbapProgram>;
type AbapPrinter = Printer;

export const languages: SupportLanguage[] = [
  {
    name: "ABAP",
    parsers: ["abap"],
    extensions: [".abap", ".clas.abap", ".intf.abap", ".prog.abap", ".ddlsrc"],
    tmScope: "source.abap",
    aceMode: "text",
    linguistLanguageId: 1,
  },
];

export const options: SupportOptions = {
  abapKeywordCase: {
    type: "choice",
    default: "upper",
    description:
      "Case to apply to ABAP keywords (maps to abap-cleaner UpperAndLowerCaseRule).",
    category: "ABAP",
    choices: [
      { value: "upper", description: "Uppercase keywords" },
      { value: "lower", description: "Lowercase keywords" },
    ],
  },
  abapSpaceBeforePeriod: {
    type: "boolean",
    default: false,
    description:
      "Keep a space before statement periods and chain commas (SpaceBeforePeriodRule).",
    category: "ABAP",
  },
  abapSpaceBeforeCommentSign: {
    type: "boolean",
    default: true,
    description:
      'Ensure a space before inline " comments (SpaceAroundCommentSignRule).',
    category: "ABAP",
  },
  abapSpaceAfterCommentSign: {
    type: "boolean",
    default: true,
    description:
      "Insert a space after the \" comment sign unless it's a pseudo comment.",
    category: "ABAP",
  },
  abapChainFormatting: {
    type: "choice",
    default: "preserve",
    description: "Control colon chain expansion (ChainRule / ChainOfOneRule).",
    category: "ABAP",
    choices: [
      { value: "preserve", description: "Keep colon chains as-is" },
      {
        value: "expand",
        description: "Expand colon chains into separate statements",
      },
    ],
  },
};

const printer: AbapPrinter = createAbapPrinter();

export const parsers: Record<string, AbapParser> = {
  abap: {
    parse: (text: string, opts: ParserOptions<AbapProgram>) =>
      parseAbap(text, opts as AbapParserOptions),
    astFormat: "abap",
    locStart,
    locEnd,
  },
};

export const printers: Record<string, AbapPrinter> = {
  abap: printer,
};

const plugin: Plugin = {
  languages,
  options,
  parsers,
  printers,
};

export default plugin;

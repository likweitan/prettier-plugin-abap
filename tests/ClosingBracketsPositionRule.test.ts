import prettier from "prettier";
import { describe, expect, it } from "vitest";

const pluginModule: any = await import("../dist/index.js");
const abapPlugin = pluginModule.default ?? pluginModule;

function wrapWithMethod(lines: string[]): string {
  const trimmed = lines.map((line) => line.replace(/\s+$/u, "")).join("\n");
  return ["METHOD any_method.", trimmed, "ENDMETHOD."]
    .filter((line) => line.length > 0)
    .join("\n");
}

async function formatAbap(source: string): Promise<string> {
  return prettier.format(source, {
    parser: "abap",
    plugins: [abapPlugin],
    tabWidth: 2,
    singleQuote: true,
  });
}

describe("ClosingBracketsPositionRule", () => {
  const cases = [
    {
      name: "value statement",
      input: wrapWithMethod([
        "    ev_result = VALUE #( ( a = 2",
        "                           b = 4",
        "                         )",
        "                       ).",
      ]),
      expected: wrapWithMethod([
        "  ev_result = VALUE #((a = 2",
        "                         b = 4 ) ).",
      ]),
    },
    {
      name: "value statement with comment",
      input: wrapWithMethod([
        "    ev_result = VALUE #( ( a = 1",
        "                           b = 2",
        "                         )",
        "                         ( a = 2",
        '                           b = 4 " comment',
        "                         )",
        "                       ).",
      ]),
      expected: wrapWithMethod([
        "  ev_result = VALUE #((a = 1",
        "                         b = 2 )",
        "                       (a = 2",
        '                         b = 4 ) ). " comment',
      ]),
    },
    {
      name: "parameter list",
      input: wrapWithMethod([
        "    any_operation( iv_param_a = 1",
        "                   iv_param_b = 2",
        "                 ).",
      ]),
      expected: wrapWithMethod([
        "  any_operation(iv_param_a = 1",
        "                 iv_param_b = 2 ).",
      ]),
    },
    {
      name: "parameter list with comment",
      input: wrapWithMethod([
        '    any_operation( iv_param = 1 " comment',
        "                 ).",
      ]),
      expected: wrapWithMethod(['  any_operation(iv_param = 1 ). " comment']),
    },
    {
      name: "parameter list with conflicting comments",
      input: wrapWithMethod([
        '    any_operation( iv_param = 1 " comment',
        '                 ). " conflicting comment',
      ]),
      expected: wrapWithMethod([
        '  any_operation(iv_param = 1 ). " comment; conflicting comment',
      ]),
    },
    {
      name: "parameter list with comment and pseudo comment unchanged",
      input: wrapWithMethod([
        '    any_operation( iv_param = 1 " comment',
        '                 ). "#EC NEEDED',
      ]),
      expected: wrapWithMethod([
        '  any_operation(iv_param = 1 ) " comment',
        '                . "#EC NEEDED',
      ]),
    },
    {
      name: "parameter list with pseudo comment and comment unchanged",
      input: wrapWithMethod([
        '    any_operation( iv_param = 1 "#EC NEEDED',
        '                 ). " comment',
      ]),
      expected: wrapWithMethod([
        '  any_operation(iv_param = 1 ) "#EC NEEDED',
        '                . " comment',
      ]),
    },
    {
      name: "pragma",
      input: wrapWithMethod([
        "    any_method( EXPORTING iv_param1 = lv_value1",
        "                IMPORTING ev_param2 = lv_param2 ##NEEDED",
        "               ).",
      ]),
      expected: wrapWithMethod([
        "  any_method(EXPORTING iv_param1 = lv_value1",
        "              IMPORTING ev_param2 = lv_param2 ) ##NEEDED.",
      ]),
    },
    {
      name: "pragmas",
      input: wrapWithMethod([
        "    any_method( EXPORTING iv_param1 = lv_value1",
        "                IMPORTING ev_param2 = lv_param2 ##NEEDED ##OTHER_PRAGMA",
        "               ).",
      ]),
      expected: wrapWithMethod([
        "  any_method(EXPORTING iv_param1 = lv_value1",
        "              IMPORTING ev_param2 = lv_param2 ) ##NEEDED ##OTHER_PRAGMA.",
      ]),
    },
    {
      name: "pragma and comment",
      input: wrapWithMethod([
        "    any_method( EXPORTING iv_param1 = lv_value1",
        '                IMPORTING ev_param2 = lv_param2 ##NEEDED " comment',
        "               ).",
      ]),
      expected: wrapWithMethod([
        "  any_method(EXPORTING iv_param1 = lv_value1",
        '              IMPORTING ev_param2 = lv_param2 ) ##NEEDED. " comment',
      ]),
    },
    {
      name: "pragma and conflicting comments",
      input: wrapWithMethod([
        "    any_method( EXPORTING iv_param1 = lv_value1",
        '                IMPORTING ev_param2 = lv_param2 ##NEEDED " comment',
        '               ). " conflicting comment',
      ]),
      expected: wrapWithMethod([
        "  any_method(EXPORTING iv_param1 = lv_value1",
        '              IMPORTING ev_param2 = lv_param2 ) ##NEEDED. " comment; conflicting comment',
      ]),
    },
    {
      name: "arithmetic expression",
      input: wrapWithMethod([
        '    a = ( 1 + 2 " comment',
        "        ) * (",
        "        3 + 4 ).",
      ]),
      expected: wrapWithMethod([
        '  a =(1 + 2 ) " comment',
        "        *(",
        "      3 + 4 ).",
      ]),
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const output = await formatAbap(testCase.input);
      expect(output.trim()).toEqual(testCase.expected.trim());
    });
  }
});

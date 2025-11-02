import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { describe, expect, it } from "vitest";

const pluginModule: any = await import("../dist/index.js");
const abapPlugin = pluginModule.default ?? pluginModule;

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "IndentRule",
);

async function loadFixture(name: string): Promise<string> {
  const filePath = path.join(fixtureRoot, name);
  return readFile(filePath, "utf8");
}

interface TestCase {
  name: string;
  description: string;
}

const cases: TestCase[] = [
  { name: "basic", description: "indents nested blocks and loops" },
  {
    name: "comment-alignment",
    description:
      "aligns comments with following middle keywords when separated by a blank line",
  },
  {
    name: "comment-no-alignment",
    description:
      "keeps comment indentation when no blank line precedes the comment",
  },
  {
    name: "select-non-block",
    description:
      "does not add indentation for SELECT statements that do not require ENDSELECT",
  },
];

describe("IndentRule", () => {
  for (const testCase of cases) {
    it(testCase.description, async () => {
      const input = await loadFixture(`${testCase.name}-input.abap`);
      const expected = await loadFixture(`${testCase.name}-expected.abap`);

      const output = await prettier.format(input, {
        parser: "abap",
        plugins: [abapPlugin],
        tabWidth: 2,
        singleQuote: true,
      });

      expect(output.trim()).toEqual(expected.trim());
    });
  }
});

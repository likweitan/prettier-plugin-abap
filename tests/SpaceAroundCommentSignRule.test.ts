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
  "SpaceAroundCommentSignRule",
);

async function loadFixture(name: string): Promise<string> {
  const filePath = path.join(fixtureRoot, name);
  return readFile(filePath, "utf8");
}

describe("SpaceAroundCommentSignRule", () => {
  it("adds spaces around the comment sign according to defaults", async () => {
    const input = await loadFixture("input.abap");
    const expected = await loadFixture("expected.abap");

    const output = await prettier.format(input, {
      parser: "abap",
      plugins: [abapPlugin],
      tabWidth: 2,
      singleQuote: true,
    });

    expect(output.trim()).toEqual(expected.trim());
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRmgTemplate, serializeRmgTemplate, type JsonValue } from "../src/types";

const fixtureDir = join(process.cwd(), "tests/fixtures/examples");
const fixtureNames = readdirSync(fixtureDir)
  .filter((name) => name.endsWith(".rmg.json"))
  .sort();

describe("RMG model serialization", () => {
  it.each(fixtureNames)("parses and serializes %s without dropping keys", (fixtureName) => {
    const original = readFixture(fixtureName);
    const template = parseRmgTemplate(original);
    const serialized = serializeRmgTemplate(template);
    const reparsed = JSON.parse(serialized) as JsonValue;
    const originalParsed = JSON.parse(original) as JsonValue;

    expect(serialized.endsWith("\n")).toBe(true);
    expect(collectPaths(reparsed)).toEqual(collectPaths(originalParsed));
  });

  it("normalizes string-list converter fields to arrays of strings", () => {
    const template = parseRmgTemplate(`{
      "name": "Converter parity",
      "sizeX": 64,
      "sizeZ": 64,
      "variants": [{
        "zones": [{
          "name": "Spawn-A",
          "contentCountLimits": "content_limits_spawn_A"
        }],
        "connections": []
      }],
      "mandatoryContent": [{
        "name": "mandatory_content_spawn_A",
        "content": [{
          "sid": "city",
          "rules": [{ "type": "zone", "args": ["Spawn-A", 7, true] }]
        }]
      }]
    }`);

    const serialized = JSON.parse(serializeRmgTemplate(template)) as {
      variants: [{ zones: [{ contentCountLimits: string[] }] }];
      mandatoryContent: [{ content: [{ rules: [{ args: string[] }] }] }];
    };

    expect(serialized.variants[0].zones[0].contentCountLimits).toEqual(["content_limits_spawn_A"]);
    expect(serialized.mandatoryContent[0].content[0].rules[0].args).toEqual(["Spawn-A", "7", "true"]);
  });

  it.each([
    ["null", "expected top-level JSON object"],
    ["[]", "expected top-level JSON object"],
    ["42", "expected top-level JSON object"],
    [`{ "sizeX": 64, "sizeZ": 64 }`, `"name" must be a non-empty string`],
    [`{ "name": "Missing width", "sizeZ": 64 }`, `"sizeX" must be a finite positive number`],
    [`{ "name": "Zero height", "sizeX": 64, "sizeZ": 0 }`, `"sizeZ" must be a finite positive number`],
  ])("rejects invalid top-level template shape: %s", (json, message) => {
    expect(() => parseRmgTemplate(json)).toThrow(message);
  });

  it("rejects malformed variant zones and connections with specific paths", () => {
    expect(() =>
      parseRmgTemplate(`{
        "name": "Bad zones",
        "sizeX": 64,
        "sizeZ": 64,
        "variants": [{ "zones": [{ "name": "" }], "connections": [] }]
      }`),
    ).toThrow(`variants[0].zones[0].name must be a non-empty string`);

    expect(() =>
      parseRmgTemplate(`{
        "name": "Bad connections",
        "sizeX": 64,
        "sizeZ": 64,
        "variants": [{ "zones": [], "connections": [{ "from": "A", "to": "B" }] }]
      }`),
    ).toThrow(`variants[0].connections[0].from references unknown zone "A"`);
  });

  it("rejects duplicate zone names inside a variant", () => {
    expect(() =>
      parseRmgTemplate(`{
        "name": "Duplicate zones",
        "sizeX": 64,
        "sizeZ": 64,
        "variants": [{ "zones": [{ "name": "Spawn-A" }, { "name": "Spawn-A" }], "connections": [] }]
      }`),
    ).toThrow(`variants[0].zones[1].name duplicates zone "Spawn-A"`);
  });

  it("allows variants without zones while still checking connection endpoint strings", () => {
    const template = parseRmgTemplate(`{
      "name": "Imported partial",
      "sizeX": 64,
      "sizeZ": 64,
      "variants": [{ "connections": [{ "from": "A", "to": "B" }] }]
    }`);

    expect(template.variants?.[0].connections?.[0].from).toBe("A");

    expect(() =>
      parseRmgTemplate(`{
        "name": "Missing endpoint",
        "sizeX": 64,
        "sizeZ": 64,
        "variants": [{ "connections": [{ "from": "A", "to": " " }] }]
      }`),
    ).toThrow(`variants[0].connections[0].to must be a non-empty string`);
  });
});

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

function collectPaths(value: JsonValue): string[] {
  const paths: string[] = [];
  walk(value, "$", paths);
  return paths.sort();
}

function walk(value: JsonValue, path: string, paths: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[]${index}`, paths));
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      paths.push(childPath);
      walk(child, childPath, paths);
    }
  }
}

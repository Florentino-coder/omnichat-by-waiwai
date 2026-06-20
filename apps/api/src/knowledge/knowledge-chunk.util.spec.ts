import { splitTextIntoChunks } from "./knowledge-chunk.util";

describe("splitTextIntoChunks", () => {
  it("returns empty array for blank text", () => {
    expect(splitTextIntoChunks("   ")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    expect(splitTextIntoChunks("hello world")).toEqual(["hello world"]);
  });

  it("splits long text into multiple chunks", () => {
    const text = "word ".repeat(300).trim();
    const chunks = splitTextIntoChunks(text, 200, 40);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 200)).toBe(true);
  });
});

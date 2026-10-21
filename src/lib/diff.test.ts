import { describe, it, expect } from "vitest";
import { computeLineDiff, formatAsPatch } from "./diff";

describe("Myers Line Diff Engine", () => {
  it("detects additions, deletions, and unchanged lines correctly", () => {
    const textA = "apple\nbanana\ncherry";
    const textB = "apple\nblueberry\ncherry\ndate";

    const diff = computeLineDiff(textA, textB);

    expect(diff.stats.additions).toBe(2); // blueberry, date
    expect(diff.stats.deletions).toBe(1); // banana
    expect(diff.stats.unchanged).toBe(2); // apple, cherry

    const patch = formatAsPatch("old.txt", "new.txt", diff);
    expect(patch).toContain("--- a/old.txt");
    expect(patch).toContain("+++ b/new.txt");
    expect(patch).toContain("-banana");
    expect(patch).toContain("+blueberry");
    expect(patch).toContain("+date");
    expect(patch).toContain(" apple");
    expect(patch).toContain(" cherry");
  });

  it("handles identical content with zero diffs", () => {
    const text = "SELECT * FROM users;\nWHERE id = 1;";
    const diff = computeLineDiff(text, text);

    expect(diff.stats.additions).toBe(0);
    expect(diff.stats.deletions).toBe(0);
    expect(diff.stats.unchanged).toBe(2);
  });

  it("handles empty texts gracefully", () => {
    const diff = computeLineDiff("", "newline");
    expect(diff.stats.additions).toBe(1);
    expect(diff.stats.deletions).toBe(1); // empty string split produces 1 empty line
  });
});

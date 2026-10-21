// Line-by-line Diff Engine using Myers Diff algorithm

export type DiffChangeType = "added" | "removed" | "unchanged";

export interface DiffLine {
  type: DiffChangeType;
  lineNumA?: number;
  lineNumB?: number;
  content: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: DiffStats;
}

/**
 * Computes line-by-line diff between two strings.
 */
export function computeLineDiff(textA: string, textB: string): DiffResult {
  const linesA = textA.replace(/\r\n/g, "\n").split("\n");
  const linesB = textB.replace(/\r\n/g, "\n").split("\n");

  const n = linesA.length;
  const m = linesB.length;

  // Standard Longest Common Subsequence (LCS) matrix
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to generate diff lines
  const diffLines: DiffLine[] = [];
  let i = n;
  let j = m;
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      diffLines.unshift({
        type: "unchanged",
        lineNumA: i,
        lineNumB: j,
        content: linesA[i - 1],
      });
      unchanged++;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.unshift({
        type: "added",
        lineNumB: j,
        content: linesB[j - 1],
      });
      additions++;
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffLines.unshift({
        type: "removed",
        lineNumA: i,
        content: linesA[i - 1],
      });
      deletions++;
      i--;
    }
  }

  return {
    lines: diffLines,
    stats: {
      additions,
      deletions,
      unchanged,
    },
  };
}

/**
 * Format diff result as a unified Git patch string.
 */
export function formatAsPatch(filenameA: string, filenameB: string, diff: DiffResult): string {
  const header = `--- a/${filenameA}\n+++ b/${filenameB}\n`;
  const body = diff.lines
    .map((line) => {
      switch (line.type) {
        case "added":
          return `+${line.content}`;
        case "removed":
          return `-${line.content}`;
        case "unchanged":
          return ` ${line.content}`;
      }
    })
    .join("\n");

  return header + body;
}

// Developer Transformation Engine

export interface TransformResult {
  success: boolean;
  result: string;
  error?: string;
}

// 1. JSON Operations
export function formatJson(input: string, space: number = 2): TransformResult {
  try {
    const parsed = JSON.parse(input.trim());
    return {
      success: true,
      result: JSON.stringify(parsed, null, space),
    };
  } catch (err: unknown) {
    return {
      success: false,
      result: input,
      error: err instanceof Error ? err.message : "Invalid JSON syntax",
    };
  }
}

export function minifyJson(input: string): TransformResult {
  try {
    const parsed = JSON.parse(input.trim());
    return {
      success: true,
      result: JSON.stringify(parsed),
    };
  } catch (err: unknown) {
    return {
      success: false,
      result: input,
      error: err instanceof Error ? err.message : "Invalid JSON syntax",
    };
  }
}

export function escapeJsonString(input: string): string {
  return JSON.stringify(input);
}

export function unescapeJsonString(input: string): TransformResult {
  try {
    const trimmed = input.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return { success: true, result: JSON.parse(trimmed) };
    }
    return { success: true, result: JSON.parse(`"${trimmed}"`) };
  } catch (err: unknown) {
    return {
      success: false,
      result: input,
      error: err instanceof Error ? err.message : "Cannot unescape string",
    };
  }
}

export function jsonToTypescript(
  input: string,
  rootInterface: string = "Root",
): TransformResult {
  try {
    const parsed = JSON.parse(input.trim());

    function inferType(val: unknown, indent: string = "  "): string {
      if (val === null) return "null";
      if (Array.isArray(val)) {
        if (val.length === 0) return "unknown[]";
        const innerType = inferType(val[0], indent);
        return `${innerType}[]`;
      }
      if (typeof val === "object") {
        const entries = Object.entries(val as Record<string, unknown>);
        if (entries.length === 0) return "Record<string, unknown>";
        const lines = entries.map(([k, v]) => {
          const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
            ? k
            : JSON.stringify(k);
          return `${indent}  ${keyStr}: ${inferType(v, indent + "  ")};`;
        });
        return `{\n${lines.join("\n")}\n${indent}}`;
      }
      return typeof val;
    }

    const typeDef = `export interface ${rootInterface} ${inferType(parsed, "")}`;
    return {
      success: true,
      result: typeDef,
    };
  } catch (err: unknown) {
    return {
      success: false,
      result: input,
      error: err instanceof Error ? err.message : "Invalid JSON for TypeScript generation",
    };
  }
}

export function jsonToYaml(input: string): TransformResult {
  try {
    const parsed = JSON.parse(input.trim());

    function toYaml(obj: unknown, depth: number = 0): string {
      const indent = "  ".repeat(depth);
      if (obj === null) return "null";
      if (typeof obj === "boolean" || typeof obj === "number") return String(obj);
      if (typeof obj === "string") {
        if (obj.includes("\n") || obj.includes(":") || obj.includes('"')) {
          return JSON.stringify(obj);
        }
        return obj;
      }
      if (Array.isArray(obj)) {
        if (obj.length === 0) return "[]";
        return obj
          .map((item) => `${indent}- ${toYaml(item, depth + 1).trimStart()}`)
          .join("\n");
      }
      if (typeof obj === "object") {
        const entries = Object.entries(obj as Record<string, unknown>);
        if (entries.length === 0) return "{}";
        return entries
          .map(([k, v]) => {
            if (typeof v === "object" && v !== null && !Array.isArray(v)) {
              return `${indent}${k}:\n${toYaml(v, depth + 1)}`;
            }
            if (Array.isArray(v)) {
              return `${indent}${k}:\n${toYaml(v, depth + 1)}`;
            }
            return `${indent}${k}: ${toYaml(v, depth + 1)}`;
          })
          .join("\n");
      }
      return String(obj);
    }

    return {
      success: true,
      result: toYaml(parsed),
    };
  } catch (err: unknown) {
    return {
      success: false,
      result: input,
      error: err instanceof Error ? err.message : "Invalid JSON for YAML generation",
    };
  }
}

// 2. cURL Converter
export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: string;
}

export function parseCurl(curlText: string): ParsedCurl | null {
  const clean = curlText.replace(/\\\r?\n/g, " ").trim();
  if (!clean.startsWith("curl")) {
    return null;
  }

  const tokens = clean.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  let url = "";
  let method = "GET";
  const headers: Record<string, string> = {};
  let data: string | undefined;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const unquoted = token.replace(/^['"]|['"]$/g, "");

    if (token === "-X" || token === "--request") {
      method = (tokens[++i] || "").replace(/^['"]|['"]$/g, "").toUpperCase();
    } else if (token === "-H" || token === "--header") {
      const headerRaw = (tokens[++i] || "").replace(/^['"]|['"]$/g, "");
      const colonIdx = headerRaw.indexOf(":");
      if (colonIdx !== -1) {
        const hKey = headerRaw.slice(0, colonIdx).trim();
        const hVal = headerRaw.slice(colonIdx + 1).trim();
        headers[hKey] = hVal;
      }
    } else if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary"
    ) {
      data = (tokens[++i] || "").replace(/^['"]|['"]$/g, "");
      if (method === "GET") method = "POST";
    } else if (
      !token.startsWith("-") &&
      !url &&
      (token.startsWith("http") || token.includes("://") || token.startsWith("'http") || token.startsWith('"http'))
    ) {
      url = unquoted;
    }
  }

  if (!url) return null;
  return { method, url, headers, data };
}

export function curlToFetch(curlText: string): TransformResult {
  const parsed = parseCurl(curlText);
  if (!parsed) {
    return {
      success: false,
      result: curlText,
      error: "Command does not resemble valid cURL",
    };
  }

  const options: Record<string, unknown> = {
    method: parsed.method,
  };

  if (Object.keys(parsed.headers).length > 0) {
    options.headers = parsed.headers;
  }

  if (parsed.data) {
    try {
      options.body = JSON.parse(parsed.data);
    } catch {
      options.body = parsed.data;
    }
  }

  const code = `fetch("${parsed.url}", {
  method: "${parsed.method}",
  headers: ${JSON.stringify(parsed.headers, null, 4).replace(/\n/g, "\n  ")},${
    parsed.data
      ? `\n  body: ${typeof options.body === "object" ? `JSON.stringify(${JSON.stringify(options.body, null, 2).replace(/\n/g, "\n  ")})` : JSON.stringify(parsed.data)}`
      : ""
  }
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));`;

  return { success: true, result: code };
}

export function curlToAxios(curlText: string): TransformResult {
  const parsed = parseCurl(curlText);
  if (!parsed) {
    return {
      success: false,
      result: curlText,
      error: "Invalid cURL command",
    };
  }

  const code = `import axios from 'axios';

const response = await axios({
  method: '${parsed.method.toLowerCase()}',
  url: '${parsed.url}',
  headers: ${JSON.stringify(parsed.headers, null, 2).replace(/\n/g, "\n  ")},${
    parsed.data ? `\n  data: ${parsed.data},` : ""
  }
});
console.log(response.data);`;

  return { success: true, result: code };
}

export function curlToPython(curlText: string): TransformResult {
  const parsed = parseCurl(curlText);
  if (!parsed) {
    return {
      success: false,
      result: curlText,
      error: "Invalid cURL command",
    };
  }

  const code = `import requests

url = "${parsed.url}"
headers = ${JSON.stringify(parsed.headers, null, 4)}
${parsed.data ? `data = ${JSON.stringify(parsed.data)}\n` : ""}
response = requests.${parsed.method.toLowerCase()}(
    url,
    headers=headers${parsed.data ? ",\n    data=data" : ""}
)
print(response.json())`;

  return { success: true, result: code };
}

// 3. Encoders & Decoders
export function base64Encode(text: string): string {
  try {
    return btoa(
      encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16)),
      ),
    );
  } catch {
    return btoa(text);
  }
}

export function base64Decode(b64: string): TransformResult {
  try {
    const binary = atob(b64.trim());
    const decoded = decodeURIComponent(
      Array.from(binary)
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return { success: true, result: decoded };
  } catch (err: unknown) {
    return {
      success: false,
      result: b64,
      error: err instanceof Error ? err.message : "Invalid Base64 payload",
    };
  }
}

export function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

export function urlDecode(text: string): TransformResult {
  try {
    return { success: true, result: decodeURIComponent(text) };
  } catch (err: unknown) {
    return {
      success: false,
      result: text,
      error: err instanceof Error ? err.message : "Invalid URL encoding",
    };
  }
}

export function hexEncode(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

export function hexDecode(hexStr: string): TransformResult {
  try {
    const clean = hexStr.replace(/\s+/g, "");
    if (clean.length % 2 !== 0) {
      return { success: false, result: hexStr, error: "Odd number of hex characters" };
    }
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    return { success: true, result: new TextDecoder().decode(bytes) };
  } catch (err: unknown) {
    return {
      success: false,
      result: hexStr,
      error: err instanceof Error ? err.message : "Failed to decode hex",
    };
  }
}

// 4. JWT Inspector
export interface JwtInspection {
  success: boolean;
  header?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  isExpired?: boolean;
  expiresAtFormatted?: string;
  issuedAtFormatted?: string;
  error?: string;
}

export function inspectJwt(token: string): JwtInspection {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { success: false, error: "JWT must have 3 dot-separated parts" };
  }

  try {
    const decodePart = (str: string) => {
      let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return JSON.parse(atob(b64));
    };

    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);

    let isExpired: boolean | undefined;
    let expiresAtFormatted: string | undefined;
    let issuedAtFormatted: string | undefined;

    if (typeof payload.exp === "number") {
      const expDate = new Date(payload.exp * 1000);
      isExpired = expDate < new Date();
      expiresAtFormatted = expDate.toISOString();
    }

    if (typeof payload.iat === "number") {
      issuedAtFormatted = new Date(payload.iat * 1000).toISOString();
    }

    return {
      success: true,
      header,
      payload,
      isExpired,
      expiresAtFormatted,
      issuedAtFormatted,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to parse JWT claims",
    };
  }
}

// 5. Color Studio
export interface ColorInfo {
  hex: string;
  rgb: string;
  rgba: string;
  hsl: string;
}

export function parseColor(input: string): ColorInfo | null {
  const clean = input.trim();

  // HEX match
  const hexMatch = clean.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    hex = `#${hex.toUpperCase()}`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const { h, s, l } = rgbToHsl(r, g, b);
    return {
      hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      rgba: `rgba(${r}, ${g}, ${b}, 1)`,
      hsl: `hsl(${h}, ${s}%, ${l}%)`,
    };
  }

  // RGB match
  const rgbMatch = clean.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    const { h, s, l } = rgbToHsl(r, g, b);
    return {
      hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      rgba: `rgba(${r}, ${g}, ${b}, 1)`,
      hsl: `hsl(${h}, ${s}%, ${l}%)`,
    };
  }

  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// 6. Case & Line Utilities
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toLowerCase());
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function toConstantCase(str: string): string {
  return toSnakeCase(str).toUpperCase();
}

export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

export function sortLines(text: string, reverse: boolean = false): string {
  const lines = text.split(/\r?\n/);
  lines.sort((a, b) => a.localeCompare(b));
  if (reverse) lines.reverse();
  return lines.join("\n");
}

export function removeDuplicateLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out.join("\n");
}

export function trimLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

// 7. Regex Extractors
export function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

export function extractIpv4(text: string): string[] {
  const matches = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

export function extractUuids(text: string): string[] {
  const matches = text.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

export function countTextStats(text: string) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.split(/\r?\n/).length;
  const bytes = new TextEncoder().encode(text).length;
  const tokensEst = Math.ceil(chars / 4);

  return { chars, words, lines, bytes, tokensEst };
}

// 8. Extended Language Struct Generators
export function jsonToGoStruct(input: string, rootName: string = "AutoGenerated"): TransformResult {
  try {
    const parsed = JSON.parse(input.trim());
    const structDefs: string[] = [];

    function toPascalCaseLocal(str: string): string {
      return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
        .replace(/^(.)/, (c) => c.toUpperCase());
    }

    function inferGoType(val: unknown, fieldName: string): string {
      if (val === null) return "interface{}";
      if (typeof val === "boolean") return "bool";
      if (typeof val === "number") {
        return Number.isInteger(val) ? "int64" : "float64";
      }
      if (typeof val === "string") return "string";
      if (Array.isArray(val)) {
        if (val.length === 0) return "[]interface{}";
        return `[]${inferGoType(val[0], fieldName + "Item")}`;
      }
      if (typeof val === "object") {
        const subStructName = toPascalCaseLocal(fieldName);
        generateStruct(subStructName, val as Record<string, unknown>);
        return subStructName;
      }
      return "interface{}";
    }

    function generateStruct(name: string, obj: Record<string, unknown>) {
      const fields = Object.entries(obj).map(([k, v]) => {
        const goField = toPascalCaseLocal(k);
        const goType = inferGoType(v, k);
        return `\t${goField} ${goType} \`json:"${k}"\``;
      });
      structDefs.push(`type ${name} struct {\n${fields.join("\n")}\n}`);
    }

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      generateStruct(rootName, parsed as Record<string, unknown>);
    } else {
      return { success: false, result: input, error: "Root JSON must be an object" };
    }

    return { success: true, result: structDefs.reverse().join("\n\n") };
  } catch (err: unknown) {
    return {
      success: false,
      result: input,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}

export function jsonToRustStruct(input: string, rootName: string = "AutoGenerated"): TransformResult {
  try {
    const parsed = JSON.parse(input.trim());
    const structDefs: string[] = [];

    function toPascalCaseLocal(str: string): string {
      return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
        .replace(/^(.)/, (c) => c.toUpperCase());
    }

    function toSnakeCaseLocal(str: string): string {
      return str
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[-\s]+/g, "_")
        .toLowerCase();
    }

    function inferRustType(val: unknown, fieldName: string): string {
      if (val === null) return "Option<serde_json::Value>";
      if (typeof val === "boolean") return "bool";
      if (typeof val === "number") {
        return Number.isInteger(val) ? "i64" : "f64";
      }
      if (typeof val === "string") return "String";
      if (Array.isArray(val)) {
        if (val.length === 0) return "Vec<serde_json::Value>";
        return `Vec<${inferRustType(val[0], fieldName + "Item")}>`;
      }
      if (typeof val === "object") {
        const subStructName = toPascalCaseLocal(fieldName);
        generateStruct(subStructName, val as Record<string, unknown>);
        return subStructName;
      }
      return "serde_json::Value";
    }

    function generateStruct(name: string, obj: Record<string, unknown>) {
      const fields = Object.entries(obj).map(([k, v]) => {
        const rustField = toSnakeCaseLocal(k);
        const rustType = inferRustType(v, k);
        const renameAttr = rustField !== k ? `    #[serde(rename = "${k}")]\n` : "";
        return `${renameAttr}    pub ${rustField}: ${rustType},`;
      });
      structDefs.push(`#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ${name} {\n${fields.join("\n")}\n}`);
    }

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      generateStruct(rootName, parsed as Record<string, unknown>);
    } else {
      return { success: false, result: input, error: "Root JSON must be an object" };
    }

    return { success: true, result: structDefs.reverse().join("\n\n") };
  } catch (err: unknown) {
    return {
      success: false,
      result: input,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}

// 9. Timestamp & Epoch Converter
export function convertTimestamp(input: string): TransformResult {
  const trimmed = input.trim();
  const num = Number(trimmed);

  let date: Date | null = null;
  let epochSec = 0;
  let epochMs = 0;

  if (!isNaN(num) && /^\d+$/.test(trimmed)) {
    if (trimmed.length <= 11) {
      epochSec = num;
      epochMs = num * 1000;
      date = new Date(epochMs);
    } else {
      epochMs = num;
      epochSec = Math.floor(num / 1000);
      date = new Date(epochMs);
    }
  } else {
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      date = new Date(parsed);
      epochMs = parsed;
      epochSec = Math.floor(parsed / 1000);
    }
  }

  if (!date || isNaN(date.getTime())) {
    return {
      success: false,
      result: input,
      error: "Input is neither a valid numeric Unix timestamp nor a parseable date string",
    };
  }

  const now = Date.now();
  const diffSec = Math.floor((now - epochMs) / 1000);
  let relative = "";
  if (Math.abs(diffSec) < 60) {
    relative = diffSec >= 0 ? `${diffSec} seconds ago` : `in ${Math.abs(diffSec)} seconds`;
  } else if (Math.abs(diffSec) < 3600) {
    const mins = Math.floor(Math.abs(diffSec) / 60);
    relative = diffSec >= 0 ? `${mins} minutes ago` : `in ${mins} minutes`;
  } else if (Math.abs(diffSec) < 86400) {
    const hrs = Math.floor(Math.abs(diffSec) / 3600);
    relative = diffSec >= 0 ? `${hrs} hours ago` : `in ${hrs} hours`;
  } else {
    const days = Math.floor(Math.abs(diffSec) / 86400);
    relative = diffSec >= 0 ? `${days} days ago` : `in ${days} days`;
  }

  const result = [
    `Unix Timestamp (Seconds):      ${epochSec}`,
    `Unix Timestamp (Milliseconds): ${epochMs}`,
    `ISO 8601 (UTC):                ${date.toISOString()}`,
    `UTC String:                    ${date.toUTCString()}`,
    `Local Time:                    ${date.toLocaleString()}`,
    `Relative Time:                 ${relative}`,
  ].join("\n");

  return { success: true, result };
}

// 10. SQL Formatter & Keyword Beautifier
export function formatSql(sql: string): TransformResult {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { success: false, result: sql, error: "Empty SQL input" };
  }

  const keywords = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN",
    "CROSS JOIN", "JOIN", "ON", "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET",
    "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "DROP TABLE",
    "ALTER TABLE", "UNION ALL", "UNION", "AS", "IN", "NOT IN", "EXISTS", "BETWEEN",
    "LIKE", "ILIKE", "IS NULL", "IS NOT NULL", "CASE", "WHEN", "THEN", "ELSE", "END",
    "ASC", "DESC", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX"
  ];

  let formatted = trimmed;

  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    formatted = formatted.replace(regex, kw);
  }

  const majorClauses = [
    "SELECT", "FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT",
    "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "CROSS JOIN", "JOIN",
    "SET", "VALUES"
  ];

  for (const clause of majorClauses) {
    const regex = new RegExp(`\\s*\\b(${clause})\\b\\s*`, "g");
    formatted = formatted.replace(regex, `\n$1 `);
  }

  const lines = formatted
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => {
      if (/^(FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|SET|VALUES)/i.test(l)) {
        return l;
      }
      return l.startsWith("SELECT") ? l : `  ${l}`;
    });

  return { success: true, result: lines.join("\n").trim() };
}

// 11. HTML to Markdown & Clean Text
export function htmlToMarkdown(html: string): TransformResult {
  let md = html.trim();
  if (!md) return { success: true, result: "" };

  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");

  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  md = md.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");

  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n");

  md = md.replace(/<[^>]+>/g, "");

  md = md
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-");

  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return { success: true, result: md };
}

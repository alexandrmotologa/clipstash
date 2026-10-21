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

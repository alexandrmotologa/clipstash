import { describe, it, expect } from "vitest";
import {
  formatJson,
  minifyJson,
  jsonToTypescript,
  jsonToYaml,
  curlToFetch,
  curlToAxios,
  curlToPython,
  base64Encode,
  base64Decode,
  hexEncode,
  hexDecode,
  urlEncode,
  urlDecode,
  inspectJwt,
  parseColor,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  toPascalCase,
  toConstantCase,
  extractEmails,
  extractUrls,
  extractIpv4,
  extractUuids,
  countTextStats,
  sortLines,
  removeDuplicateLines,
} from "./transformers";

describe("Developer Transformers", () => {
  describe("JSON Operations", () => {
    it("formats raw JSON", () => {
      const input = '{"name":"clipstash","ver":1}';
      const formatted = formatJson(input);
      expect(formatted.success).toBe(true);
      expect(formatted.result).toContain('  "name": "clipstash"');
    });

    it("minifies indented JSON", () => {
      const input = `{\n  "status": "ok"\n}`;
      const min = minifyJson(input);
      expect(min.success).toBe(true);
      expect(min.result).toBe('{"status":"ok"}');
    });

    it("generates TypeScript interface from JSON", () => {
      const json = JSON.stringify({ id: "abc", count: 10, active: true });
      const ts = jsonToTypescript(json, "AppConfig");
      expect(ts.success).toBe(true);
      expect(ts.result).toContain("export interface AppConfig");
      expect(ts.result).toContain("id: string;");
      expect(ts.result).toContain("count: number;");
      expect(ts.result).toContain("active: boolean;");
    });

    it("converts JSON to YAML", () => {
      const json = JSON.stringify({ title: "Task", done: false });
      const yaml = jsonToYaml(json);
      expect(yaml.success).toBe(true);
      expect(yaml.result).toContain("title: Task");
      expect(yaml.result).toContain("done: false");
    });
  });

  describe("cURL Converter", () => {
    const sampleCurl = `curl -X POST https://api.example.com/v1/auth -H "Content-Type: application/json" -d '{"token":"xyz"}'`;

    it("converts cURL to fetch()", () => {
      const res = curlToFetch(sampleCurl);
      expect(res.success).toBe(true);
      expect(res.result).toContain('fetch("https://api.example.com/v1/auth"');
      expect(res.result).toContain('method: "POST"');
      expect(res.result).toContain('"Content-Type": "application/json"');
    });

    it("converts cURL to Axios", () => {
      const res = curlToAxios(sampleCurl);
      expect(res.success).toBe(true);
      expect(res.result).toContain("await axios({");
      expect(res.result).toContain("method: 'post'");
      expect(res.result).toContain("url: 'https://api.example.com/v1/auth'");
    });

    it("converts cURL to Python requests", () => {
      const res = curlToPython(sampleCurl);
      expect(res.success).toBe(true);
      expect(res.result).toContain("import requests");
      expect(res.result).toContain("requests.post(");
    });
  });

  describe("Encoders & Decoders", () => {
    it("encodes and decodes Base64 safely", () => {
      const original = "Hello World! 🚀 ClipStash";
      const b64 = base64Encode(original);
      const dec = base64Decode(b64);
      expect(dec.success).toBe(true);
      expect(dec.result).toBe(original);
    });

    it("encodes and decodes Hex", () => {
      const original = "Secret";
      const hex = hexEncode(original);
      const dec = hexDecode(hex);
      expect(dec.success).toBe(true);
      expect(dec.result).toBe(original);
    });

    it("encodes and decodes URL strings", () => {
      const text = "query=hello world & token=123";
      const enc = urlEncode(text);
      expect(urlDecode(enc).result).toBe(text);
    });
  });

  describe("JWT Inspector", () => {
    it("decodes token headers and payload claims", () => {
      // Mock valid JWT: {alg: "HS256"}, {sub: "1234567890", name: "John Doe", exp: 1999999999}
      const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payloadB64 = btoa(
        JSON.stringify({ sub: "user_123", name: "Alice", exp: 1999999999, iat: 1700000000 }),
      );
      const fakeJwt = `${headerB64}.${payloadB64}.fakeSignature`;

      const inspected = inspectJwt(fakeJwt);
      expect(inspected.success).toBe(true);
      expect(inspected.header?.alg).toBe("HS256");
      expect(inspected.payload?.sub).toBe("user_123");
      expect(inspected.isExpired).toBe(false);
    });
  });

  describe("Color Studio", () => {
    it("parses 6-digit hex color", () => {
      const color = parseColor("#3B82F6");
      expect(color).not.toBeNull();
      expect(color?.hex).toBe("#3B82F6");
      expect(color?.rgb).toBe("rgb(59, 130, 246)");
    });

    it("parses 3-digit hex color", () => {
      const color = parseColor("#FFF");
      expect(color).not.toBeNull();
      expect(color?.hex).toBe("#FFFFFF");
      expect(color?.rgb).toBe("rgb(255, 255, 255)");
    });
  });

  describe("Case Formatting", () => {
    const text = "hello_world clip-stash example";
    it("converts cases correctly", () => {
      expect(toCamelCase("hello-world-item")).toBe("helloWorldItem");
      expect(toSnakeCase("helloWorldItem")).toBe("hello_world_item");
      expect(toKebabCase("hello_world_item")).toBe("hello-world-item");
      expect(toPascalCase("hello_world_item")).toBe("HelloWorldItem");
      expect(toConstantCase("hello_world_item")).toBe("HELLO_WORLD_ITEM");
    });
  });

  describe("Regex Extractors & Line Tools", () => {
    it("extracts emails, urls, ips, and uuids", () => {
      const sample = `
        Contact alex@example.com or support@company.org.
        API at https://api.site.com/v1 and http://localhost:8080.
        Connect to 192.168.1.1 and 10.0.0.1.
        Entity ID is 123e4567-e89b-12d3-a456-426614174000.
      `;

      expect(extractEmails(sample)).toEqual(["alex@example.com", "support@company.org"]);
      expect(extractUrls(sample).length).toBe(2);
      expect(extractIpv4(sample)).toEqual(["192.168.1.1", "10.0.0.1"]);
      expect(extractUuids(sample)).toEqual(["123e4567-e89b-12d3-a456-426614174000"]);
    });

    it("sorts lines and removes duplicates", () => {
      const input = "banana\napple\nbanana\ncherry";
      const sorted = sortLines(input);
      expect(sorted).toBe("apple\nbanana\nbanana\ncherry");
      const deduped = removeDuplicateLines(sorted);
      expect(deduped).toBe("apple\nbanana\ncherry");
    });

    it("calculates accurate text statistics", () => {
      const stats = countTextStats("The quick brown fox jumps over the lazy dog");
      expect(stats.words).toBe(9);
      expect(stats.chars).toBe(43);
      expect(stats.tokensEst).toBe(11);
    });
  });
});

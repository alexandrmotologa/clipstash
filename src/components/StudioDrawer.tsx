import React, { useState, useEffect } from "react";
import {
  Wand2,
  Copy,
  Check,
  Code,
  Braces,
  FileCode,
  Palette,
  Key,
  Shield,
  Type,
  Binary,
  ArrowRight,
  Flame,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { ClipItem } from "../types/clip";
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
  urlEncode,
  urlDecode,
  hexEncode,
  hexDecode,
  inspectJwt,
  parseColor,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  toPascalCase,
  toConstantCase,
  toTitleCase,
  sortLines,
  removeDuplicateLines,
  trimLines,
  extractEmails,
  extractUrls,
  extractIpv4,
  extractUuids,
  countTextStats,
  jsonToGoStruct,
  jsonToRustStruct,
  convertTimestamp,
  formatSql,
  htmlToMarkdown,
} from "../lib/transformers";
import { sounds } from "../lib/audio";

interface StudioDrawerProps {
  clip: ClipItem | null;
  revealedText?: string;
  onCopyCustom: (text: string) => void;
  onSaveAsNewClip: (text: string) => void;
  onBurnSecret: (id: string) => void;
  onClose?: () => void;
}

type StudioTab = "json" | "curl" | "encoders" | "jwt" | "colors" | "text" | "regex";

export const StudioDrawer: React.FC<StudioDrawerProps> = ({
  clip,
  revealedText,
  onCopyCustom,
  onSaveAsNewClip,
  onBurnSecret,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>("json");
  const [activeAction, setActiveAction] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Raw source text to transform (prefer revealed decrypted text if present)
  const sourceText = clip ? (revealedText || clip.masked_content) : "";

  // Auto-detect best initial tab based on content
  useEffect(() => {
    if (!sourceText) return;
    const clean = sourceText.trim();

    if (clean.startsWith("curl")) {
      setActiveTab("curl");
      runTransform("curl-fetch", sourceText);
    } else if (clean.startsWith("{") || clean.startsWith("[")) {
      setActiveTab("json");
      runTransform("json-format", sourceText);
    } else if (clean.startsWith("eyJ") && clean.split(".").length === 3) {
      setActiveTab("jwt");
      runTransform("jwt-inspect", sourceText);
    } else if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean) || clean.startsWith("rgb")) {
      setActiveTab("colors");
      runTransform("color-parse", sourceText);
    } else {
      setActiveTab("text");
      runTransform("text-stats", sourceText);
    }
  }, [clip?.id, sourceText]);

  const runTransform = (actionId: string, input: string) => {
    setActiveAction(actionId);
    setErrorMsg(null);

    switch (actionId) {
      // JSON Actions
      case "json-format": {
        const res = formatJson(input, 2);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to format JSON");
        break;
      }
      case "json-minify": {
        const res = minifyJson(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to minify JSON");
        break;
      }
      case "json-ts": {
        const res = jsonToTypescript(input, "Payload");
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to generate TypeScript interface");
        break;
      }
      case "json-yaml": {
        const res = jsonToYaml(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to convert to YAML");
        break;
      }
      case "json-go": {
        const res = jsonToGoStruct(input, "Payload");
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to generate Go struct");
        break;
      }
      case "json-rust": {
        const res = jsonToRustStruct(input, "Payload");
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to generate Rust struct");
        break;
      }

      // cURL Actions
      case "curl-fetch": {
        const res = curlToFetch(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to convert cURL to fetch");
        break;
      }
      case "curl-axios": {
        const res = curlToAxios(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to convert cURL to Axios");
        break;
      }
      case "curl-python": {
        const res = curlToPython(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to convert cURL to Python");
        break;
      }

      // Encoders Actions
      case "enc-b64-encode":
        setOutputText(base64Encode(input));
        break;
      case "enc-b64-decode": {
        const res = base64Decode(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Invalid Base64 string");
        break;
      }
      case "enc-url-encode":
        setOutputText(urlEncode(input));
        break;
      case "enc-url-decode": {
        const res = urlDecode(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Invalid URL encoding");
        break;
      }
      case "enc-hex-encode":
        setOutputText(hexEncode(input));
        break;
      case "enc-hex-decode": {
        const res = hexDecode(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Invalid Hex string");
        break;
      }
      case "enc-epoch": {
        const res = convertTimestamp(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Invalid Timestamp");
        break;
      }

      // JWT Actions
      case "jwt-inspect": {
        const res = inspectJwt(input);
        if (res.success) {
          setOutputText(JSON.stringify(res, null, 2));
        } else {
          setErrorMsg(res.error || "Invalid JWT format");
        }
        break;
      }

      // Colors Actions
      case "color-parse": {
        const color = parseColor(input);
        if (color) {
          const formatted = `HEX:  ${color.hex}\nRGB:  ${color.rgb}\nRGBA: ${color.rgba}\nHSL:  ${color.hsl}\n\n/* CSS Variables */\n:root {\n  --color-brand: ${color.hex};\n  --color-brand-rgb: ${color.rgb.slice(4, -1)};\n}`;
          setOutputText(formatted);
        } else {
          setErrorMsg("Input is not a recognized HEX or RGB color");
        }
        break;
      }

      // Text Actions
      case "case-camel":
        setOutputText(toCamelCase(input));
        break;
      case "case-snake":
        setOutputText(toSnakeCase(input));
        break;
      case "case-kebab":
        setOutputText(toKebabCase(input));
        break;
      case "case-pascal":
        setOutputText(toPascalCase(input));
        break;
      case "case-constant":
        setOutputText(toConstantCase(input));
        break;
      case "case-title":
        setOutputText(toTitleCase(input));
        break;
      case "text-sort":
        setOutputText(sortLines(input));
        break;
      case "text-dedupe":
        setOutputText(removeDuplicateLines(input));
        break;
      case "text-trim":
        setOutputText(trimLines(input));
        break;
      case "text-stats": {
        const stats = countTextStats(input);
        setOutputText(`Characters:        ${stats.chars}\nWords:             ${stats.words}\nLines:             ${stats.lines}\nBytes:             ${stats.bytes}\nEstimated Tokens:  ~${stats.tokensEst}`);
        break;
      }
      case "text-sql": {
        const res = formatSql(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to format SQL");
        break;
      }
      case "text-html-md": {
        const res = htmlToMarkdown(input);
        if (res.success) setOutputText(res.result);
        else setErrorMsg(res.error || "Failed to convert HTML to Markdown");
        break;
      }

      // Regex Extractors
      case "regex-emails": {
        const emails = extractEmails(input);
        setOutputText(emails.length > 0 ? emails.join("\n") : "No email addresses found.");
        break;
      }
      case "regex-urls": {
        const urls = extractUrls(input);
        setOutputText(urls.length > 0 ? urls.join("\n") : "No URLs found.");
        break;
      }
      case "regex-ips": {
        const ips = extractIpv4(input);
        setOutputText(ips.length > 0 ? ips.join("\n") : "No IPv4 addresses found.");
        break;
      }
      case "regex-uuids": {
        const uuids = extractUuids(input);
        setOutputText(uuids.length > 0 ? uuids.join("\n") : "No UUIDs found.");
        break;
      }

      default:
        setOutputText(input);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    onCopyCustom(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!clip) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-950/40">
        <Wand2 className="w-10 h-10 text-zinc-700 mb-3" />
        <p className="text-sm font-medium text-zinc-400">Select a clip to transform</p>
        <p className="text-xs text-zinc-600 mt-1 max-w-xs">
          Single-key JSON format, cURL to fetch, Base64 decoding, JWT inspection, and color conversion.
        </p>
      </div>
    );
  }

  const stats = countTextStats(sourceText);

  return (
    <div className="h-full flex flex-col bg-zinc-950/90 border-l border-zinc-800/60 overflow-hidden">
      {/* Studio Header */}
      <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Developer Studio
          </h2>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
            {stats.chars} chars
          </span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
            {stats.lines} lines
          </span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-sky-400">
            ~{stats.tokensEst} tokens
          </span>
        </div>
      </div>

      {/* Secret Vault Security Banner (if sensitive) */}
      {clip.is_secret && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-rose-300">Vault Protected: </span>
              <span className="text-rose-200/80">{clip.secret_types.join(", ")}</span>
            </div>
          </div>
          <button
            onClick={() => onBurnSecret(clip.id)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium border border-rose-500/30 transition-colors"
          >
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Burn Now</span>
          </button>
        </div>
      )}

      {/* Transformation Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-zinc-800/40 overflow-x-auto no-scrollbar">
        {[
          { id: "json", label: "JSON", icon: <Braces className="w-3 h-3" /> },
          { id: "curl", label: "cURL", icon: <Code className="w-3 h-3" /> },
          { id: "encoders", label: "Encoders", icon: <Binary className="w-3 h-3" /> },
          { id: "jwt", label: "JWT", icon: <Key className="w-3 h-3" /> },
          { id: "colors", label: "Color", icon: <Palette className="w-3 h-3" /> },
          { id: "text", label: "Cases & Lines", icon: <Type className="w-3 h-3" /> },
          { id: "regex", label: "Extract", icon: <Wand2 className="w-3 h-3" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as StudioTab)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/80"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Action Pills for Active Tab */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-zinc-800/40 bg-zinc-950/40">
        {activeTab === "json" && (
          <>
            <button
              onClick={() => runTransform("json-format", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "json-format" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              Format 2-Space
            </button>
            <button
              onClick={() => runTransform("json-minify", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "json-minify" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              Minify
            </button>
            <button
              onClick={() => runTransform("json-ts", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "json-ts" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              TypeScript Interface
            </button>
            <button
              onClick={() => runTransform("json-yaml", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "json-yaml" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              JSON → YAML
            </button>
            <button
              onClick={() => runTransform("json-go", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "json-go" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              Go Struct
            </button>
            <button
              onClick={() => runTransform("json-rust", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "json-rust" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              Rust Struct
            </button>
          </>
        )}

        {activeTab === "curl" && (
          <>
            <button
              onClick={() => runTransform("curl-fetch", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "curl-fetch" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              cURL → fetch()
            </button>
            <button
              onClick={() => runTransform("curl-axios", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "curl-axios" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              cURL → Axios
            </button>
            <button
              onClick={() => runTransform("curl-python", sourceText)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${activeAction === "curl-python" ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
            >
              cURL → Python Requests
            </button>
          </>
        )}

        {activeTab === "encoders" && (
          <>
            <button
              onClick={() => runTransform("enc-b64-encode", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Base64 Encode
            </button>
            <button
              onClick={() => runTransform("enc-b64-decode", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Base64 Decode
            </button>
            <button
              onClick={() => runTransform("enc-url-encode", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              URL Encode
            </button>
            <button
              onClick={() => runTransform("enc-url-decode", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              URL Decode
            </button>
            <button
              onClick={() => runTransform("enc-hex-encode", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Hex Encode
            </button>
            <button
              onClick={() => runTransform("enc-hex-decode", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Hex Decode
            </button>
            <button
              onClick={() => runTransform("enc-epoch", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Unix Timestamp / Epoch
            </button>
          </>
        )}

        {activeTab === "jwt" && (
          <button
            onClick={() => runTransform("jwt-inspect", sourceText)}
            className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
          >
            Inspect Header & Claims
          </button>
        )}

        {activeTab === "colors" && (
          <button
            onClick={() => runTransform("color-parse", sourceText)}
            className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
          >
            Convert HEX / RGB / HSL
          </button>
        )}

        {activeTab === "text" && (
          <>
            <button
              onClick={() => runTransform("case-camel", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              camelCase
            </button>
            <button
              onClick={() => runTransform("case-snake", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              snake_case
            </button>
            <button
              onClick={() => runTransform("case-kebab", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              kebab-case
            </button>
            <button
              onClick={() => runTransform("case-pascal", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              PascalCase
            </button>
            <button
              onClick={() => runTransform("case-constant", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              CONSTANT_CASE
            </button>
            <button
              onClick={() => runTransform("case-title", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Title Case
            </button>
            <button
              onClick={() => runTransform("text-sort", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Sort A-Z
            </button>
            <button
              onClick={() => runTransform("text-dedupe", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Deduplicate Lines
            </button>
            <button
              onClick={() => runTransform("text-trim", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Trim Empty Lines
            </button>
            <button
              onClick={() => runTransform("text-stats", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Word & Token Stats
            </button>
            <button
              onClick={() => runTransform("text-sql", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Format SQL
            </button>
            <button
              onClick={() => runTransform("text-html-md", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              HTML → Markdown
            </button>
          </>
        )}

        {activeTab === "regex" && (
          <>
            <button
              onClick={() => runTransform("regex-emails", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Extract Emails
            </button>
            <button
              onClick={() => runTransform("regex-urls", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Extract URLs
            </button>
            <button
              onClick={() => runTransform("regex-ips", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Extract IPv4
            </button>
            <button
              onClick={() => runTransform("regex-uuids", sourceText)}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Extract UUIDs
            </button>
          </>
        )}
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="mx-4 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Transformation Output Editor */}
      <div className="flex-1 p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Output Result
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSaveAsNewClip(outputText)}
              className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              + Save as New Clip
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy Result"}</span>
            </button>
          </div>
        </div>

        <textarea
          value={outputText}
          onChange={(e) => setOutputText(e.target.value)}
          className="flex-1 w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed select-text"
          placeholder="Transformation result will appear here..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};

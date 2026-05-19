import { useState, useEffect, Component, ReactNode, ChangeEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ModelInfo { id: string; name: string; icon: string; color: string; }
interface GatewayInfo { id: string; name: string; color: string; description: string; }
interface ThemeInfo { id: string; label: string; }
interface ContextField { key: string; label: string; labelEn: string; placeholder: string; }
interface Settings { apiKey: string; consolidationModel: string; theme: string; }
interface ModelResult { response?: string; error?: string; time?: number; gateway?: string; }
interface HistoryEntry { question: string; answer: string; }
interface ResearchRecord { id: number; question: string; context_profile: object; models_used: string[]; results: Record<string, ModelResult>; consolidated: string; gateway: string; created_date: string; }
interface Attachment { name: string; kind: string; content: string; }
interface SavedPrompt { id: number; title: string; text: string; }
interface Theme {
  isLight: boolean; isGlass: boolean;
  bg: string; surface: string; surfaceBorder: string;
  card: string; cardBorder: string; cardBlur: string; cardShadow: string;
  input: string; inputBorder: string;
  text: string; textMuted: string; textDim: string;
  accent: string;
  consolidateBg: string; consolidateBorder: string;
  modalBg: string; modalBorder: string; modalShadow: string;
  skeleton: string; headingGradient: string;
  errorBg: string; errorBorder: string; errorText: string;
  histBg: string; histBorder: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MODELS: ModelInfo[] = [
  { id: "openai",     name: "ChatGPT",    icon: "🤖", color: "#10a37f" },
  { id: "gemini",     name: "Gemini",     icon: "✨", color: "#4285F4" },
  { id: "deepseek",   name: "DeepSeek",   icon: "🔍", color: "#6366f1" },
  { id: "claude",     name: "Claude",     icon: "🧡", color: "#e07b39" },
  { id: "perplexity", name: "Perplexity", icon: "🌐", color: "#20b2aa" },
  { id: "llama",      name: "Llama 3",    icon: "🦙", color: "#a855f7" },
];

const GATEWAYS: GatewayInfo[] = [
  { id: "openrouter", name: "OpenRouter",  color: "#6366f1", description: "Acesso a 100+ modelos com uma só chave" },
  { id: "openai",     name: "OpenAI",      color: "#10a37f", description: "Direto para GPT-4o e outros modelos OpenAI" },
  { id: "anthropic",  name: "Anthropic",   color: "#e07b39", description: "Direto para Claude 3.5 Sonnet" },
  { id: "together",   name: "Together AI", color: "#0ea5e9", description: "Modelos open source: Llama, Mistral" },
  { id: "groq",       name: "Groq",        color: "#f59e0b", description: "Ultra-rápido, modelos open source gratuitos" },
];

const THEMES: ThemeInfo[] = [
  { id: "light",         label: "☀️ Light Minimalista" },
  { id: "dark-refined",  label: "🌑 Dark Refinado" },
  { id: "glassmorphism", label: "🪟 Dark + Glass" },
];

const CONTEXT_FIELDS: ContextField[] = [
  { key: "area",     label: "Minha Área",      labelEn: "My Field / Area",    placeholder: "Ex: Medicina, Tecnologia, Direito..." },
  { key: "tema",     label: "Tema",             labelEn: "Topic / Theme",      placeholder: "Ex: Inteligência Artificial na saúde" },
  { key: "objetivo", label: "Objetivo Geral",   labelEn: "General Objective",  placeholder: "Ex: Escrever um artigo acadêmico" },
  { key: "dados",    label: "Dados / Contexto", labelEn: "Data / Background",  placeholder: "Ex: Estudo com 200 pacientes, 2023-2024" },
  { key: "acao",     label: "Ação Esperada",    labelEn: "Expected Action",    placeholder: "Ex: Sugira uma introdução formal" },
];

const DEFAULT_SETTINGS: Settings = { apiKey: "", consolidationModel: "claude", theme: "light" };
const AUTH_URL = "https://smart-boy-app-0e7bef6a.base44.app/functions/authUser";
const QUERY_URL = "https://smart-boy-app-0e7bef6a.base44.app/functions/queryAI";

// ─── LocalStorage Research History ───────────────────────────────────────────
const HIST_KEY = "jn_research_history";
function loadHistory(): ResearchRecord[] {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; }
}
function saveHistory(records: ResearchRecord[]): void {
  localStorage.setItem(HIST_KEY, JSON.stringify(records.slice(0, 100)));
}
function createHistoryRecord(data: Omit<ResearchRecord, "id" | "created_date">): ResearchRecord {
  const record: ResearchRecord = { ...data, id: Date.now(), created_date: new Date().toISOString() };
  const existing = loadHistory();
  saveHistory([record, ...existing]);
  return record;
}
function updateHistoryRecord(id: number, update: Partial<ResearchRecord>): void {
  const existing = loadHistory();
  saveHistory(existing.map(r => r.id === id ? { ...r, ...update } : r));
}
function deleteHistoryRecord(id: number): void {
  saveHistory(loadHistory().filter(r => r.id !== id));
}
function findHistoryByQuestion(question: string): ResearchRecord | undefined {
  return loadHistory().find(r => r.question === question);
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem("smartboy_settings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: Settings): void { localStorage.setItem("smartboy_settings", JSON.stringify(s)); }
function loadSavedPrompts(): SavedPrompt[] {
  try { return JSON.parse(localStorage.getItem("jn_saved_prompts") || "[]"); } catch { return []; }
}
function saveSavedPrompts(arr: SavedPrompt[]): void { localStorage.setItem("jn_saved_prompts", JSON.stringify(arr)); }

function checkAuth(): boolean {
  try {
    const token = localStorage.getItem("jn_auth_token");
    if (!token) return false;
    const parsed = JSON.parse(atob(token));
    return !!(parsed && parsed.userId && parsed.email);
  } catch { return false; }
}
function getAuthData(): { userId: string; email: string; role: string } | null {
  try {
    const token = localStorage.getItem("jn_auth_token");
    if (!token) return null;
    return JSON.parse(atob(token));
  } catch { return null; }
}
function detectGateway(apiKey: string): string {
  if (!apiKey) return "openrouter";
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("gsk_")) return "groq";
  if (apiKey.startsWith("sk-proj-") || apiKey.startsWith("sk-")) return "openai";
  if (apiKey.length > 60) return "together";
  return "openrouter";
}

function buildFullPrompt(context: Record<string, string>, history: HistoryEntry[], useHistory: boolean, prompt: string): string {
  const parts: string[] = [];
  if (context.area)     parts.push("Minha Area: " + context.area);
  if (context.tema)     parts.push("Tema: " + context.tema);
  if (context.objetivo) parts.push("Objetivo Geral: " + context.objetivo);
  if (context.dados)    parts.push("Dados/Contexto: " + context.dados);
  if (context.acao)     parts.push("Acao Esperada: " + context.acao);
  let result = "";
  if (parts.length > 0) result += "[Perfil da Pesquisa]\n" + parts.join("\n") + "\n\n";
  if (useHistory && history.length > 0) {
    const histText = history.map(h => "Voce: " + h.question + "\nIA: " + h.answer).join("\n\n");
    result += "[Historico da Conversa]\n" + histText + "\n\n";
  }
  result += "[Pergunta]\n" + prompt;
  return result;
}

function exportToTxt(question: string, results: Record<string, ModelResult>, consolidated: string): string {
  const lines = ["JonasNetto IA — Exportação de Pesquisa", "=".repeat(50), "", "PERGUNTA:", question, ""];
  Object.entries(results || {}).forEach(([modelId, r]) => {
    const modelInfo = MODELS.find(x => x.id === modelId);
    lines.push("─".repeat(40));
    lines.push((modelInfo ? modelInfo.icon + " " + modelInfo.name : modelId).toUpperCase());
    lines.push("─".repeat(40));
    lines.push(r.error ? "ERRO: " + r.error : r.response || "");
    lines.push("");
  });
  if (consolidated) {
    lines.push("=".repeat(50));
    lines.push("✨ CONSOLIDAÇÃO");
    lines.push("=".repeat(50));
    lines.push(consolidated);
  }
  lines.push("", "Gerado em: " + new Date().toLocaleString("pt-BR"));
  return lines.join("\n");
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.readAsText(file);
  });
}
function readImageAsBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(((e.target?.result as string) || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}
async function extractPdfText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const pdfReader = new FileReader();
    pdfReader.onload = async (e) => {
      try {
        const win = window as Window & { pdfjsLib?: { getDocument: (o: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> }; GlobalWorkerOptions: { workerSrc: string } } };
        if (!win.pdfjsLib) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload = () => res(); s.onerror = () => rej(new Error("pdf.js load failed"));
            document.head.appendChild(s);
          });
          win.pdfjsLib!.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const pdf = await win.pdfjsLib!.getDocument({ data: e.target?.result }).promise;
        let text = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          text += tc.items.map(item => item.str).join(" ") + "\n";
        }
        resolve(text.trim() || "[PDF sem texto extraível]");
      } catch (err) { resolve("[Erro ao ler PDF: " + (err as Error).message + "]"); }
    };
    pdfReader.readAsArrayBuffer(file);
  });
}
async function extractWordText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const wordReader = new FileReader();
    wordReader.onload = async (e) => {
      try {
        const win = window as Window & { mammoth?: { extractRawText: (o: object) => Promise<{ value: string }> } };
        if (!win.mammoth) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js";
            s.onload = () => res(); s.onerror = () => rej(new Error("mammoth load failed"));
            document.head.appendChild(s);
          });
        }
        const result = await win.mammoth!.extractRawText({ arrayBuffer: e.target?.result });
        resolve(result.value.trim() || "[Documento Word sem texto extraível]");
      } catch (err) { resolve("[Erro ao ler Word: " + (err as Error).message + "]"); }
    };
    wordReader.readAsArrayBuffer(file);
  });
}
async function processFile(file: File): Promise<Attachment> {
  const type = file.type;
  const name = file.name;
  if (type === "text/plain") return { name, kind: "text", content: await readTextFile(file) };
  if (type === "application/pdf") return { name, kind: "pdf", content: await extractPdfText(file) };
  if (type.startsWith("image/")) return { name, kind: "image", content: await readImageAsBase64(file) };
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || type === "application/msword" || name.endsWith(".docx") || name.endsWith(".doc")) {
    return { name, kind: "word", content: await extractWordText(file) };
  }
  return { name, kind: "unsupported", content: "" };
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function getTheme(themeId: string): Theme {
  if (themeId === "light") return {
    isLight: true, isGlass: false,
    bg: "#ffffff", surface: "#fafafa", surfaceBorder: "#e5e7eb",
    card: "#fafafa", cardBorder: "#e5e7eb", cardBlur: "none",
    cardShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    input: "#ffffff", inputBorder: "#d1d5db",
    text: "#111827", textMuted: "#6b7280", textDim: "#9ca3af",
    accent: "#001969",
    consolidateBg: "#fffbeb", consolidateBorder: "#fcd34d",
    modalBg: "#ffffff", modalBorder: "#e5e7eb",
    modalShadow: "0 20px 60px rgba(0,0,0,0.15)",
    skeleton: "#f3f4f6", headingGradient: "#001969",
    errorBg: "#fef2f2", errorBorder: "#fecaca", errorText: "#dc2626",
    histBg: "#f8faff", histBorder: "#dbeafe",
  };
  if (themeId === "glassmorphism") return {
    isLight: false, isGlass: true,
    bg: "linear-gradient(135deg, #0a0f1e 0%, #0d1117 50%, #0a0e1a 100%)",
    surface: "rgba(255,255,255,0.04)", surfaceBorder: "rgba(255,255,255,0.08)",
    card: "rgba(255,255,255,0.05)", cardBorder: "rgba(255,255,255,0.1)",
    cardBlur: "blur(12px)", cardShadow: "none",
    input: "rgba(0,0,0,0.3)", inputBorder: "rgba(255,255,255,0.1)",
    text: "#f1f5f9", textMuted: "#94a3b8", textDim: "#475569",
    accent: "#818cf8",
    consolidateBg: "rgba(245,158,11,0.12)", consolidateBorder: "rgba(245,158,11,0.25)",
    modalBg: "rgba(10,15,30,0.95)", modalBorder: "rgba(255,255,255,0.1)",
    modalShadow: "0 32px 80px rgba(0,0,0,0.6)",
    skeleton: "rgba(255,255,255,0.06)",
    headingGradient: "linear-gradient(135deg, #e0e7ff, #c4b5fd, #93c5fd)",
    errorBg: "rgba(220,38,38,0.08)", errorBorder: "rgba(220,38,38,0.3)", errorText: "#fca5a5",
    histBg: "rgba(129,140,248,0.08)", histBorder: "rgba(129,140,248,0.2)",
  };
  return {
    isLight: false, isGlass: false,
    bg: "#09090b", surface: "#111113", surfaceBorder: "#1f1f23",
    card: "#111113", cardBorder: "#1f1f23", cardBlur: "none", cardShadow: "none",
    input: "#0d0d0f", inputBorder: "#2a2a2e",
    text: "#fafafa", textMuted: "#a1a1aa", textDim: "#52525b",
    accent: "#818cf8",
    consolidateBg: "#111113", consolidateBorder: "#2a2a2e",
    modalBg: "#111113", modalBorder: "#1f1f23",
    modalShadow: "0 32px 80px rgba(0,0,0,0.6)",
    skeleton: "#1f1f23",
    headingGradient: "linear-gradient(135deg, #e2e8f0, #a5b4fc)",
    errorBg: "rgba(220,38,38,0.08)", errorBorder: "rgba(220,38,38,0.3)", errorText: "#fca5a5",
    histBg: "rgba(129,140,248,0.06)", histBorder: "rgba(129,140,248,0.15)",
  };
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function parseInline(text: string, T: Theme): ReactNode[] {
  if (!text) return [];
  const codeBg = T.isLight ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.3)";
  const result: ReactNode[] = [];
  const regex = /(!\[([^\]]*?)\]\(([^)]+)\))|(`([^`]+)`)|\[([^\]]+?)\]\(([^)]+?)\)|(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*(?!\*))|(__(.+?)__)|(_(.+?)_)|(\*(.+?)\*(?!\*))|~~(.+?)~~/gs;
  let last = 0; let m: RegExpExecArray | null; let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) result.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    if (m[1]) { result.push(<img key={key++} src={m[3]} alt={m[2] || ""} style={{ maxWidth: "100%", borderRadius: 8, margin: "4px 0", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />); }
    else if (m[4]) { result.push(<code key={key++} style={{ background: codeBg, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: "0.85em" }}>{m[5]}</code>); }
    else if (m[6]) { result.push(<a key={key++} href={m[7]} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, textDecoration: "underline" }}>{m[6]}</a>); }
    else if (m[8]) { result.push(<strong key={key++}><em>{m[9]}</em></strong>); }
    else if (m[10]) { result.push(<strong key={key++}>{m[11]}</strong>); }
    else if (m[12]) { result.push(<strong key={key++}>{m[13]}</strong>); }
    else if (m[14]) { result.push(<em key={key++}>{m[15]}</em>); }
    else if (m[16]) { result.push(<em key={key++}>{m[17]}</em>); }
    else if (m[18] !== undefined) { result.push(<del key={key++}>{m[18]}</del>); }
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(<span key={key++}>{text.slice(last)}</span>);
  return result;
}

function MarkdownRenderer({ text, T }: { text: string; T: Theme }) {
  if (!text) return null;
  const codeBg = T.isLight ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.3)";
  const codeBorder = T.isLight ? "#e5e7eb" : "#2a2a2e";
  const tableBg = T.isLight ? "#f9fafb" : "rgba(255,255,255,0.03)";
  const tableHeadBg = T.isLight ? "#f3f4f6" : "rgba(255,255,255,0.06)";
  const tableBorder = T.isLight ? "#e5e7eb" : "rgba(255,255,255,0.1)";
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let i = 0; let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { codeLines.push(lines[i]); i++; }
      elements.push(
        <div key={key++} style={{ margin: "12px 0", borderRadius: 8, overflow: "hidden", border: "1px solid " + codeBorder }}>
          {lang && <div style={{ padding: "4px 14px", background: T.isLight ? "#e5e7eb" : "#1f1f27", fontSize: "0.72rem", color: T.textDim, fontFamily: "monospace", borderBottom: "1px solid " + codeBorder }}>{lang}</div>}
          <pre style={{ margin: 0, padding: "14px 16px", background: codeBg, overflowX: "auto", fontSize: "0.83rem", lineHeight: 1.6, color: T.text, fontFamily: "'Fira Code', 'Courier New', monospace", whiteSpace: "pre" }}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      i++; continue;
    }
    const h3 = /^###\s+(.+)$/.exec(line);
    const h2 = /^##\s+(.+)$/.exec(line);
    const h1 = /^#\s+(.+)$/.exec(line);
    if (h3) { elements.push(<h3 key={key++} style={{ margin: "12px 0 6px", fontSize: "1rem", color: T.text, borderBottom: "1px solid " + codeBorder, paddingBottom: 4 }}>{parseInline(h3[1], T)}</h3>); i++; continue; }
    if (h2) { elements.push(<h2 key={key++} style={{ margin: "14px 0 6px", fontSize: "1.1rem", color: T.text, borderBottom: "1px solid " + codeBorder, paddingBottom: 4 }}>{parseInline(h2[1], T)}</h2>); i++; continue; }
    if (h1) { elements.push(<h1 key={key++} style={{ margin: "16px 0 8px", fontSize: "1.25rem", color: T.text }}>{parseInline(h1[1], T)}</h1>); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { elements.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid " + codeBorder, margin: "14px 0" }} />); i++; continue; }
    if (/^\|.+\|/.test(line) && i + 1 < lines.length && /^\|[-: |]+\|/.test(lines[i + 1])) {
      const headerCells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
      const alignLine = lines[i + 1];
      const aligns = alignLine.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => { c = c.trim(); if (/^:-+:$/.test(c)) return "center"; if (/^-+:$/.test(c)) return "right"; return "left"; });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i])) { rows.push(lines[i].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim())); i++; }
      elements.push(
        <div key={key++} style={{ overflowX: "auto", margin: "12px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", background: tableBg, borderRadius: 8, overflow: "hidden", border: "1px solid " + tableBorder }}>
            <thead><tr style={{ background: tableHeadBg }}>{headerCells.map((cell, ci) => <th key={ci} style={{ padding: "8px 12px", textAlign: aligns[ci] as "left" | "right" | "center" || "left", fontWeight: 700, color: T.text, borderBottom: "2px solid " + tableBorder, whiteSpace: "nowrap", border: "1px solid " + tableBorder }}>{parseInline(cell, T)}</th>)}</tr></thead>
            <tbody>{rows.map((row, ri) => <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : (T.isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)") }}>{headerCells.map((_, ci) => <td key={ci} style={{ padding: "7px 12px", textAlign: aligns[ci] as "left" | "right" | "center" || "left", color: T.text, border: "1px solid " + tableBorder }}>{parseInline(row[ci] || "", T)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^>\s*/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s*/.test(lines[i])) { quoteLines.push(lines[i].replace(/^>\s*/, "")); i++; }
      elements.push(<blockquote key={key++} style={{ borderLeft: "3px solid " + T.accent, paddingLeft: 14, margin: "10px 0", color: T.textMuted, fontStyle: "italic", fontSize: "0.9rem" }}>{quoteLines.map((ql, qi) => <div key={qi}>{parseInline(ql, T)}</div>)}</blockquote>);
      continue;
    }
    if (/^([\*\-\+])\s+/.test(line)) {
      const items: { indent: number; text: string }[] = [];
      const baseIndent = (line.match(/^(\s*)/) || ["", ""])[1].length;
      while (i < lines.length && (/^\s*[\*\-\+]\s+/.test(lines[i]) || /^\s{2,}/.test(lines[i]))) {
        const mm = lines[i].match(/^(\s*)[\*\-\+]\s+(.*)/);
        if (mm) items.push({ indent: mm[1].length, text: mm[2] });
        i++;
      }
      elements.push(<ul key={key++} style={{ paddingLeft: 20, margin: "8px 0", lineHeight: 1.75 }}>{items.map((item, ii) => <li key={ii} style={{ color: T.text, marginBottom: 2, marginLeft: Math.max(0, item.indent - baseIndent) * 12, listStyleType: item.indent > baseIndent ? "circle" : "disc" }}>{parseInline(item.text, T)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { const mm = lines[i].match(/^\s*\d+\.\s+(.*)/); if (mm) items.push(mm[1]); i++; }
      elements.push(<ol key={key++} style={{ paddingLeft: 22, margin: "8px 0", lineHeight: 1.75 }}>{items.map((item, ii) => <li key={ii} style={{ color: T.text, marginBottom: 2 }}>{parseInline(item, T)}</li>)}</ol>);
      continue;
    }
    if (line.trim() === "") { elements.push(<div key={key++} style={{ height: 8 }} />); i++; continue; }
    elements.push(<p key={key++} style={{ margin: "3px 0", lineHeight: 1.75, color: T.text }}>{parseInline(line, T)}</p>);
    i++;
  }
  return <div style={{ fontSize: "0.88rem", lineHeight: 1.75, wordBreak: "break-word" }}>{elements}</div>;
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", fontFamily: "sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: "#001969", marginBottom: 8 }}>Algo deu errado</h2>
            <p style={{ color: "#6b7280", marginBottom: 20, fontSize: "0.9rem" }}>Erro: {String(this.state.error)}</p>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ background: "#001969", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: "0.95rem" }}>
              Limpar e Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Speed Badge ──────────────────────────────────────────────────────────────
function SpeedBadge({ modelId, time, speedRanking, T }: { modelId: string; time: number; speedRanking: string[]; T: Theme }) {
  const rank = speedRanking.indexOf(modelId);
  const medals = ["🥇", "🥈", "🥉"];
  const medal = rank >= 0 && rank < 3 ? medals[rank] : null;
  return (
    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
      {medal && <span title={"#" + (rank + 1) + " mais rápido"} style={{ fontSize: "0.88rem" }}>{medal}</span>}
      <span style={{ color: rank === 0 ? "#16a34a" : rank === 1 ? "#ca8a04" : T.textDim, fontSize: "0.72rem", fontWeight: rank < 2 ? 700 : 400 }}>
        {(time / 1000).toFixed(1)}s
      </span>
    </span>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text, T }: { text: string; T: Theme }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const plain = text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
    navigator.clipboard.writeText(plain).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={handleCopy} title="Copiar / Copy"
      style={{ marginLeft: 6, background: copied ? (T.isLight ? "#dcfce7" : "rgba(34,197,94,0.15)") : T.surface, border: "1px solid " + (copied ? (T.isLight ? "#86efac" : "rgba(34,197,94,0.3)") : T.surfaceBorder), borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: copied ? "#16a34a" : T.textMuted, fontSize: "0.75rem", fontWeight: 600, transition: "all 0.2s" }}>
      {copied ? "✓ Copiado" : "📋 Copiar"}
    </button>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginModal({ onAuth }: { onAuth: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, boxSizing: "border-box", border: "1.5px solid #d1d5db", fontSize: "0.93rem", outline: "none", fontFamily: "inherit", color: "#111827", background: "#f9fafb", marginBottom: 10, transition: "border-color 0.2s" };
  const handleLogin = async () => {
    if (!email || !password || loading) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email, password }) });
      const data = await res.json();
      if (data.ok && data.token) {
        localStorage.setItem("jn_auth_token", data.token);
        localStorage.setItem("jn_user_name", data.name || "");
        localStorage.setItem("jn_user_role", data.role || "user");
        onAuth();
      } else { setError(data.error || "Erro ao fazer login"); }
    } catch { setError("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };
  const handleRegister = async () => {
    if (!name || !email || !password || loading) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", name, email, password }) });
      const data = await res.json();
      if (data.ok) { setSuccess("✅ " + data.message); setName(""); setEmail(""); setPassword(""); }
      else { setError(data.error || "Erro ao cadastrar"); }
    } catch { setError("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };
  const onKey = (e: React.KeyboardEvent, fn: () => void) => { if (e.key === "Enter") { e.preventDefault(); fn(); } };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,10,40,0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', -apple-system, sans-serif", animation: "fadeIn 0.3s ease" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "36px 36px 32px", borderRadius: 24, background: "rgba(255,255,255,0.97)", boxShadow: "0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.6)", textAlign: "center", animation: "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <img src="https://media.base44.com/images/public/69bd9feba10b3ecf67510347/0a59cfd74_JN8.png" alt="JonasNetto IA"
          style={{ height: 64, width: "auto", marginBottom: 8, filter: "brightness(0) saturate(100%) invert(8%) sepia(82%) saturate(2700%) hue-rotate(218deg) brightness(90%) contrast(120%)" }} />
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#001969", margin: "0 0 2px" }}>JonasNetto IA</h1>
        <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginBottom: 22 }}>Inteligência Artificial Comparativa</p>
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 22 }}>
          {(["login", "register"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
              style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.87rem", transition: "all 0.2s", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#001969" : "#6b7280", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
              {t === "login" ? "🔐 Entrar" : "📝 Cadastrar"}
            </button>
          ))}
        </div>
        {tab === "login" && (
          <div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => onKey(e, handleLogin)} placeholder="Seu email" autoFocus style={inputStyle} />
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => onKey(e, handleLogin)} placeholder="Sua senha" style={{ ...inputStyle, marginBottom: 0, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af" }}>{showPwd ? "🙈" : "👁️"}</button>
            </div>
            {error && <p style={{ color: "#dc2626", fontSize: "0.82rem", margin: "0 0 10px", animation: "shake 0.3s ease" }}>❌ {error}</p>}
            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: loading ? "#6b7280" : "#001969", color: "#fff", fontWeight: 700, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 16px rgba(0,25,105,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Verificando...</> : "Entrar"}
            </button>
          </div>
        )}
        {tab === "register" && (
          <div>
            {success ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "18px 16px", marginBottom: 12 }}>
                <p style={{ color: "#16a34a", fontWeight: 600, margin: 0, fontSize: "0.9rem" }}>{success}</p>
                <p style={{ color: "#4b5563", fontSize: "0.82rem", margin: "8px 0 0" }}>Você receberá um email quando sua conta for aprovada.</p>
              </div>
            ) : (
              <>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" autoFocus style={inputStyle} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu email" style={inputStyle} />
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => onKey(e, handleRegister)} placeholder="Crie uma senha (mín. 6 caracteres)" style={{ ...inputStyle, marginBottom: 0, paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af" }}>{showPwd ? "🙈" : "👁️"}</button>
                </div>
                {error && <p style={{ color: "#dc2626", fontSize: "0.82rem", margin: "0 0 10px" }}>❌ {error}</p>}
                <button onClick={handleRegister} disabled={loading} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: loading ? "#6b7280" : "#001969", color: "#fff", fontWeight: 700, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 16px rgba(0,25,105,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {loading ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Aguarde...</> : "Solicitar Acesso"}
                </button>
              </>
            )}
          </div>
        )}
        <p style={{ color: "#d1d5db", fontSize: "0.72rem", margin: "18px 0 0" }}>Acesso sujeito a aprovação do administrador</p>
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({ T, onClose }: { T: Theme; onClose: () => void }) {
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string; status: string; created_date?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState("");
  const token = localStorage.getItem("jn_auth_token");
  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listPending", token }) });
      const data = await res.json();
      if (data.ok) setUsers(data.users || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { loadUsers(); }, []);
  const handleAction = async (userId: string, action: string) => {
    setActionLoading(userId + action);
    try { await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, token, userId }) }); await loadUsers(); } catch {}
    setActionLoading("");
  };
  const filtered = filter === "all" ? users : users.filter(u => u.status === filter);
  const counts: Record<string, number> = { all: users.length, pending: users.filter(u => u.status === "pending").length, approved: users.filter(u => u.status === "approved").length, rejected: users.filter(u => u.status === "rejected").length };
  const statusColor: Record<string, string> = { pending: "#f59e0b", approved: "#16a34a", rejected: "#dc2626" };
  const statusLabel: Record<string, string> = { pending: "⏳ Pendente", approved: "✅ Aprovado", rejected: "❌ Rejeitado" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 640, maxHeight: "85vh", background: T.modalBg, border: "1px solid " + T.modalBorder, borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid " + T.modalBorder, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: T.text }}>👥 Painel de Usuários</h2>
            <p style={{ margin: 0, fontSize: "0.73rem", color: T.textDim }}>Gerencie solicitações de acesso</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "12px 22px 0", borderBottom: "1px solid " + T.modalBorder }}>
          {["all", "pending", "approved", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 14px", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: filter === f ? 700 : 500, fontSize: "0.82rem", background: filter === f ? T.accent : "transparent", color: filter === f ? "#fff" : T.textMuted, borderBottom: "2px solid " + (filter === f ? T.accent : "transparent") }}>
              {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : "Rejeitados"}{" "}
              <span style={{ background: filter === f ? "rgba(255,255,255,0.25)" : T.surface, borderRadius: 10, padding: "1px 7px", fontSize: "0.75rem" }}>{counts[f]}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: T.textDim }}><span style={{ display: "inline-block", width: 24, height: 24, border: "3px solid " + T.surfaceBorder, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: "0.87rem" }}>Nenhum usuário encontrado.</div>
          ) : filtered.map(u => (
            <div key={u.id} style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 12, padding: "13px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.accent + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>{u.role === "admin" ? "👑" : "👤"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: T.text, fontSize: "0.9rem" }}>{u.name} {u.role === "admin" && <span style={{ fontSize: "0.72rem", background: T.accent + "20", color: T.accent, borderRadius: 6, padding: "2px 7px", marginLeft: 4 }}>admin</span>}</div>
                <div style={{ color: T.textMuted, fontSize: "0.78rem" }}>{u.email}</div>
                <div style={{ fontSize: "0.72rem", marginTop: 2 }}>
                  <span style={{ color: statusColor[u.status], fontWeight: 600 }}>{statusLabel[u.status]}</span>
                  {u.created_date && <span style={{ color: T.textDim, marginLeft: 8 }}>{new Date(u.created_date).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
              {u.role !== "admin" && u.status === "pending" && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleAction(u.id, "approve")} disabled={!!actionLoading} style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: actionLoading ? "not-allowed" : "pointer" }}>{actionLoading === u.id + "approve" ? "..." : "✅ Aprovar"}</button>
                  <button onClick={() => handleAction(u.id, "reject")} disabled={!!actionLoading} style={{ background: "transparent", border: "1px solid #dc2626", borderRadius: 8, padding: "7px 14px", color: "#dc2626", fontSize: "0.8rem", fontWeight: 700, cursor: actionLoading ? "not-allowed" : "pointer" }}>{actionLoading === u.id + "reject" ? "..." : "❌ Rejeitar"}</button>
                </div>
              )}
              {u.role !== "admin" && u.status === "approved" && <button onClick={() => handleAction(u.id, "reject")} disabled={!!actionLoading} style={{ background: "transparent", border: "1px solid " + T.surfaceBorder, borderRadius: 8, padding: "7px 12px", color: T.textMuted, fontSize: "0.78rem", cursor: actionLoading ? "not-allowed" : "pointer", flexShrink: 0 }}>Revogar</button>}
              {u.role !== "admin" && u.status === "rejected" && <button onClick={() => handleAction(u.id, "approve")} disabled={!!actionLoading} style={{ background: "transparent", border: "1px solid #16a34a", borderRadius: 8, padding: "7px 12px", color: "#16a34a", fontSize: "0.78rem", cursor: actionLoading ? "not-allowed" : "pointer", flexShrink: 0 }}>Reativar</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose, onThemeChange }: { onClose: () => void; onThemeChange: (t: string) => void }) {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [saved, setSaved] = useState(false);
  const T = getTheme(settings.theme);
  const [adminPwd, setAdminPwd] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminChecking, setAdminChecking] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ hasKey: boolean; gateway: string; maskedKey: string } | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const BACKEND = "https://smart-boy-app-0e7bef6a.base44.app/functions";
  useEffect(() => {
    fetch(BACKEND + "/manageApiKey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) })
      .then(r => r.json()).then(d => { if (d.hasKey !== undefined) setKeyStatus(d); }).catch(() => {});
  }, []);
  const handleAdminUnlock = async () => {
    setAdminChecking(true); setAdminError("");
    try {
      const r = await fetch(BACKEND + "/manageApiKey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "getKey", adminPassword: adminPwd }) });
      const d = await r.json();
      if (d.apiKey) { setAdminUnlocked(true); setNewApiKey(d.apiKey); }
      else { setAdminError(d.error || "Senha incorreta"); }
    } catch { setAdminError("Erro de conexão"); }
    setAdminChecking(false);
  };
  const handleSaveKey = async () => {
    if (!newApiKey.trim()) return;
    setKeySaving(true);
    try {
      await fetch(BACKEND + "/manageApiKey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setKey", adminPassword: adminPwd, apiKey: newApiKey.trim() }) });
      setKeySaved(true); setAdminUnlocked(false); setNewApiKey(""); setTimeout(() => setKeySaved(false), 3000);
    } catch {}
    setKeySaving(false);
  };
  const handleSave = () => {
    saveSettings(settings); onThemeChange(settings.theme);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const inputStyle: React.CSSProperties = { width: "100%", background: T.input, border: "1px solid " + T.inputBorder, borderRadius: 8, padding: "9px 12px", color: T.text, fontSize: "0.88rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: T.isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 420, height: "100vh", background: T.modalBg, border: "1px solid " + T.modalBorder, boxShadow: T.modalShadow, display: "flex", flexDirection: "column", overflowY: "auto", padding: "28px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: T.text }}>⚙️ Configurações</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 12, marginBottom: 22, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid " + T.surfaceBorder, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: T.text }}>🔑 API Key do Servidor</span>
              {keyStatus?.hasKey && <span style={{ fontSize: "0.7rem", background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", borderRadius: 999, padding: "1px 8px", fontWeight: 700, marginLeft: 8 }}>✓ Configurada</span>}
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {keySaved && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#dcfce7", border: "1px solid #86efac", color: "#16a34a", fontSize: "0.84rem", fontWeight: 600, marginBottom: 12 }}>✅ Chave atualizada!</div>}
            {!adminUnlocked ? (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: T.textMuted }}>🔒 Para ver ou alterar a chave, informe a senha de administrador.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="password" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminUnlock()} placeholder="Senha de admin..." style={{ ...inputStyle, flex: 1, border: "1px solid " + (adminError ? "#fca5a5" : T.inputBorder) }} />
                  <button onClick={handleAdminUnlock} disabled={adminChecking} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: adminChecking ? T.textDim : "#001969", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: adminChecking ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>{adminChecking ? "..." : "🔓 Acessar"}</button>
                </div>
                {adminError && <p style={{ margin: "6px 0 0", color: "#dc2626", fontSize: "0.78rem" }}>{adminError}</p>}
              </div>
            ) : (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: "#16a34a", fontWeight: 600 }}>🔓 Admin desbloqueado — altere a chave abaixo:</p>
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <input type={showNewKey ? "text" : "password"} value={newApiKey} onChange={e => setNewApiKey(e.target.value)} placeholder="sk-or-v1-... ou sk-ant-..." style={{ ...inputStyle, paddingRight: 44, fontFamily: "monospace", fontSize: "0.82rem" }} />
                  <button onClick={() => setShowNewKey(!showNewKey)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1rem" }}>{showNewKey ? "🙈" : "👁️"}</button>
                </div>
                {newApiKey && (() => { const gw = GATEWAYS.find(g => g.id === detectGateway(newApiKey)); return gw ? <div style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 7, background: gw.color + "18", border: "1px solid " + gw.color + "44", fontSize: "0.78rem" }}><span style={{ color: gw.color, fontWeight: 700 }}>✓ {gw.name}</span><span style={{ color: T.textMuted, marginLeft: 8 }}>{gw.description}</span></div> : null; })()}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSaveKey} disabled={keySaving || !newApiKey.trim()} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: keySaving ? T.textDim : "#001969", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: (keySaving || !newApiKey.trim()) ? "not-allowed" : "pointer" }}>{keySaving ? "Salvando..." : "💾 Salvar chave"}</button>
                  <button onClick={() => { setAdminUnlocked(false); setNewApiKey(""); setAdminError(""); }} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid " + T.inputBorder, background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: "0.85rem" }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 7 }}><span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase" }}>Tema / Theme</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {THEMES.map(t => (
              <button key={t.id} onClick={() => setSettings({ ...settings, theme: t.id })}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + (settings.theme === t.id ? T.accent : T.inputBorder), background: settings.theme === t.id ? T.accent + "18" : T.input, color: settings.theme === t.id ? T.accent : T.textMuted, fontWeight: settings.theme === t.id ? 700 : 500, cursor: "pointer", fontSize: "0.85rem" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 7 }}><span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase" }}>Modelo para Consolidação</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {MODELS.map(m => {
              const isActive = settings.consolidationModel === m.id;
              return (
                <button key={m.id} onClick={() => setSettings({ ...settings, consolidationModel: m.id })}
                  style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid " + (isActive ? m.color + "66" : T.inputBorder), background: isActive ? m.color + "12" : T.input, color: isActive ? m.color : T.textMuted, fontWeight: isActive ? 700 : 500, cursor: "pointer", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 7 }}>
                  {m.icon} {m.name}
                  {isActive && <span style={{ marginLeft: "auto", background: m.color, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: "0.66rem" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={handleSave} style={{ width: "100%", padding: "11px", background: saved ? "#16a34a" : T.accent, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
          {saved ? "✅ Salvo!" : "💾 Salvar"}
        </button>
      </div>
    </div>
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────
function HistoryModal({ T, onClose, onRestore }: { T: Theme; onClose: () => void; onRestore: (h: ResearchRecord) => void }) {
  const [history, setHistory] = useState<ResearchRecord[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => { setHistory(loadHistory()); setHistLoading(false); }, []);
  const handleDelete = (id: number) => {
    setDeleting(id);
    deleteHistoryRecord(id);
    setHistory(prev => prev.filter(h => h.id !== id));
    setDeleting(null);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: T.isLight ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.modalBg, borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "85vh", border: "1px solid " + T.modalBorder, boxShadow: T.modalShadow, backdropFilter: T.isGlass ? "blur(20px)" : "none", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid " + T.modalBorder, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: T.text }}>📚 Histórico de Pesquisas</h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: T.textDim }}>Research History · {history.length} consulta{history.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {histLoading && <div style={{ color: T.textMuted, textAlign: "center", padding: 40, fontSize: "0.88rem" }}>Carregando...</div>}
          {!histLoading && history.length === 0 && <div style={{ color: T.textMuted, textAlign: "center", padding: 40, fontSize: "0.88rem" }}>Nenhuma pesquisa salva ainda.<br /><em style={{ fontSize: "0.8rem", opacity: 0.7 }}>No saved research yet.</em></div>}
          {!histLoading && history.map(h => {
            const isExp = expanded === h.id;
            const models = (h.models_used || []).map(id => MODELS.find(m => m.id === id)).filter(Boolean) as ModelInfo[];
            const date = new Date(h.created_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
            return (
              <div key={h.id} style={{ background: T.histBg, border: "1px solid " + T.histBorder, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => setExpanded(isExp ? null : h.id)}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: T.text, fontSize: "0.88rem", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.question}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {models.map(mod => <span key={mod.id} style={{ fontSize: "0.72rem", color: mod.color, background: mod.color + "12", border: "1px solid " + mod.color + "33", borderRadius: 999, padding: "1px 7px" }}>{mod.icon} {mod.name}</span>)}
                        <span style={{ fontSize: "0.7rem", color: T.textDim }}>{date}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); onRestore(h); onClose(); }} style={{ background: T.accent + "12", border: "1px solid " + T.accent + "33", borderRadius: 6, padding: "4px 10px", color: T.accent, fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}>↩ Restaurar</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(h.id); }} style={{ background: "transparent", border: "1px solid " + T.surfaceBorder, borderRadius: 6, padding: "4px 8px", color: T.textDim, fontSize: "0.75rem", cursor: deleting === h.id ? "not-allowed" : "pointer" }}>{deleting === h.id ? "..." : "🗑️"}</button>
                    </div>
                  </div>
                </div>
                {isExp && (
                  <div style={{ borderTop: "1px solid " + T.histBorder, padding: "12px 14px" }}>
                    {Object.entries(h.results || {}).map(([modelId, r]) => {
                      const modInfo = MODELS.find(x => x.id === modelId);
                      return (
                        <div key={modelId} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: modInfo ? modInfo.color : T.textMuted, marginBottom: 4 }}>{modInfo ? modInfo.icon + " " + modInfo.name : modelId}</div>
                          <div style={{ fontSize: "0.82rem", color: T.text, lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}><MarkdownRenderer text={r.response || r.error || ""} T={T} /></div>
                        </div>
                      );
                    })}
                    {h.consolidated && (
                      <div style={{ marginTop: 10, padding: "10px 12px", background: T.consolidateBg, border: "1px solid " + T.consolidateBorder, borderRadius: 8 }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: T.isLight ? "#92400e" : "#fbbf24", marginBottom: 4 }}>✨ Consolidação</div>
                        <div style={{ fontSize: "0.82rem", color: T.text, lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}><MarkdownRenderer text={h.consolidated} T={T} /></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Saved Prompts Modal ──────────────────────────────────────────────────────
function SavedPromptsModal({ T, currentPrompt, onClose, onSelect }: { T: Theme; currentPrompt: string; onClose: () => void; onSelect: (t: string) => void }) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>(loadSavedPrompts());
  const [newTitle, setNewTitle] = useState("");
  const inputStyle: React.CSSProperties = { width: "100%", background: T.input, border: "1px solid " + T.inputBorder, borderRadius: 8, padding: "9px 12px", color: T.text, fontSize: "0.88rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const handleSavePrompt = () => {
    if (!currentPrompt.trim() || !newTitle.trim()) return;
    const updated = [...prompts, { id: Date.now(), title: newTitle, text: currentPrompt }];
    saveSavedPrompts(updated); setPrompts(updated); setNewTitle("");
  };
  const handleDeletePrompt = (id: number) => {
    const filtered = prompts.filter(p => p.id !== id);
    saveSavedPrompts(filtered); setPrompts(filtered);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: T.isLight ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.modalBg, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "80vh", border: "1px solid " + T.modalBorder, boxShadow: T.modalShadow, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid " + T.modalBorder, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: T.text }}>⭐ Templates de Prompt</h2>
            <p style={{ margin: 0, fontSize: "0.73rem", color: T.textDim }}>Prompt Templates</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {currentPrompt.trim() && (
            <div style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: T.textDim, marginBottom: 8, textTransform: "uppercase" }}>Salvar prompt atual</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Nome do template..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && handleSavePrompt()} />
                <button onClick={handleSavePrompt} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 7, padding: "9px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap" }}>Salvar</button>
              </div>
            </div>
          )}
          {prompts.length === 0 && <div style={{ color: T.textDim, fontSize: "0.85rem", textAlign: "center", padding: "20px 0" }}>Nenhum template salvo ainda.</div>}
          {prompts.map(p => (
            <div key={p.id} style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 9, padding: "11px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: T.text, fontSize: "0.87rem", marginBottom: 3 }}>{p.title}</div>
                <div style={{ color: T.textMuted, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.text}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => { onSelect(p.text); onClose(); }} style={{ background: T.accent + "12", border: "1px solid " + T.accent + "33", borderRadius: 6, padding: "4px 10px", color: T.accent, fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}>Usar</button>
                <button onClick={() => handleDeletePrompt(p.id)} style={{ background: "transparent", border: "1px solid " + T.surfaceBorder, borderRadius: 6, padding: "4px 8px", color: T.textDim, fontSize: "0.75rem", cursor: "pointer" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function HomeApp() {
  const [authed, setAuthed] = useState(checkAuth());
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState(["openai", "gemini", "deepseek"]);
  const [results, setResults] = useState<Record<string, ModelResult>>({});
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState<Record<string, string>>({ area: "", tema: "", objetivo: "", dados: "", acao: "" });
  const [consolidated, setConsolidated] = useState("");
  const [consolidating, setConsolidating] = useState(false);
  const [showConsolidated, setShowConsolidated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const authData = getAuthData();
  const isAdmin = authData && authData.role === "admin";
  const userName = localStorage.getItem("jn_user_name") || "";
  const [activeGateway, setActiveGateway] = useState<string | null>(null);
  const [theme, setTheme] = useState(loadSettings().theme || "light");
  const [chatHistory, setChatHistory] = useState<HistoryEntry[]>([]);
  const [useHistory, setUseHistory] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [lastHistoryId, setLastHistoryId] = useState<number | null>(null);
  const [speedRanking, setSpeedRanking] = useState<string[]>([]);

  const T = getTheme(theme);
  const settings = loadSettings();
  const hasContext = Object.values(context || {}).some(v => v && v.trim() !== "");
  const hasResults = Object.keys(results || {}).length > 0;
  const successfulResults = Object.entries(results || {}).filter(([, r]) => r && r.response && !r.error);
  const consolidationModelInfo = MODELS.find(m => m.id === settings.consolidationModel) || MODELS[3];
  const gatewayInfo = GATEWAYS.find(g => g.id === activeGateway);
  const imageAttachment = attachments.find(a => a.kind === "image")?.content || null;

  const toggleModel = (id: string) => setSelectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleQuery = async () => {
    if (!prompt.trim() && attachments.length === 0) return;
    if (selectedModels.length === 0) return;
    setLoading(true); setQueryError(""); setResults({}); setConsolidated(""); setShowConsolidated(false); setActiveGateway(null); setSpeedRanking([]);
    try {
      let fullPrompt = buildFullPrompt(context, chatHistory, useHistory, prompt);
      const textAttachments = attachments.filter(a => a.kind === "text" || a.kind === "pdf" || a.kind === "word");
      if (textAttachments.length > 0) {
        const attachText = textAttachments.map(a => "[Arquivo: " + a.name + "]\n" + a.content).join("\n\n---\n\n");
        fullPrompt += "\n\n[Anexos]\n" + attachText;
      }
      const queryRes = await fetch(QUERY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, models: selectedModels, imageBase64: imageAttachment || undefined }),
      });
      if (!queryRes.ok) { const errData = await queryRes.json().catch(() => ({})); throw new Error(errData.error || "Erro no servidor"); }
      const data = await queryRes.json();
      setResults(data.results);
      setLastQuestion(prompt);
      const ranked = Object.entries(data.results || {})
        .filter(([, r]: [string, unknown]) => { const rr = r as ModelResult; return rr.response && !rr.error && rr.time; })
        .sort((a, b) => ((a[1] as ModelResult).time || 0) - ((b[1] as ModelResult).time || 0))
        .map(([id]) => id);
      setSpeedRanking(ranked);
      if (data.gateway) setActiveGateway(data.gateway);
      setAttachments([]);
      try {
        const record = createHistoryRecord({
          question: prompt, context_profile: hasContext ? context : {},
          models_used: selectedModels, results: data.results,
          consolidated: "", gateway: data.gateway || "",
        });
        setLastHistoryId(record.id);
      } catch {}
      const firstSuccess = Object.values(data.results || {}).find((r: unknown) => { const rr = r as ModelResult; return rr.response && !rr.error; }) as ModelResult | undefined;
      if (firstSuccess) {
        const ans = firstSuccess.response!.length > 500 ? firstSuccess.response!.slice(0, 500) + "..." : firstSuccess.response!;
        setChatHistory(prev => [...prev, { question: prompt, answer: ans }]);
      }
    } catch (err) { setQueryError("Erro ao consultar: " + (err as Error).message); }
    finally { setLoading(false); }
  };

  const handleConsolidate = async () => {
    if (successfulResults.length === 0) return;
    setConsolidating(true); setShowConsolidated(true); setConsolidated("");
    const currentSettings = loadSettings();
    const responsesText = successfulResults.map(([id, r]) => {
      const mod = MODELS.find(x => x.id === id);
      return "### " + (mod ? mod.name : id) + "\n" + r.response;
    }).join("\n\n---\n\n");
    const consolidationPrompt = "Voce e um especialista em sintese de informacoes. Abaixo estao respostas de diferentes modelos de IA para a mesma pergunta.\n\nPERGUNTA ORIGINAL:\n" + lastQuestion + "\n\nRESPOSTAS:\n" + responsesText + "\n\nTAREFA: Analise e gere uma versao consolidada que combine os melhores pontos, resolva contradicoes, elimine redundancias e produza um texto coeso. Indique consensos e divergencias.";
    try {
      const fallbackOrder = [currentSettings.consolidationModel, ...["openai", "gemini", "deepseek", "llama"].filter(m => m !== currentSettings.consolidationModel)];
      let consolResponse: string | null = null;
      let lastErr = "Sem resposta";
      for (const modelId of fallbackOrder) {
        try {
          const res = await fetch(QUERY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: consolidationPrompt, models: [modelId] }) });
          const data = await res.json();
          const r: ModelResult = data.results?.[modelId];
          if (r?.response && !r.error) { consolResponse = r.response; break; }
          lastErr = r?.error || data.error || lastErr;
        } catch (e) { lastErr = (e as Error).message; }
      }
      if (consolResponse) {
        setConsolidated(consolResponse);
        if (lastHistoryId) { try { updateHistoryRecord(lastHistoryId, { consolidated: consolResponse }); } catch {} }
        else { try { const match = findHistoryByQuestion(lastQuestion); if (match) updateHistoryRecord(match.id, { consolidated: consolResponse }); } catch {} }
      } else { throw new Error(lastErr); }
    } catch (err) { setConsolidated("Erro na consolidação: " + (err as Error).message); }
    finally { setConsolidating(false); }
  };

  const handleExport = () => {
    const exportText = exportToTxt(lastQuestion, results, consolidated);
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "jonasnetto-ia-" + new Date().toISOString().slice(0, 10) + ".txt"; a.click();
    URL.revokeObjectURL(url);
    setExportDone(true); setTimeout(() => setExportDone(false), 2500);
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachLoading(true);
    const processed = await Promise.all(files.map(processFile));
    setAttachments(prev => [...prev, ...processed]);
    setAttachLoading(false);
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleQuery(); };

  const inputStyle: React.CSSProperties = { width: "100%", background: T.input, border: "1px solid " + T.inputBorder, borderRadius: 8, padding: "9px 12px", color: T.text, fontSize: "0.92rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const surfaceStyle: React.CSSProperties = { background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 12, backdropFilter: T.isGlass ? "blur(12px)" : "none" };
  const cardStyle: React.CSSProperties = { background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 14, backdropFilter: T.cardBlur !== "none" ? T.cardBlur : "none", boxShadow: T.cardShadow, overflow: "hidden" };

  return (
    <>
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", color: T.text, filter: !authed ? "blur(3px) brightness(0.7)" : "none", pointerEvents: !authed ? "none" : "auto", userSelect: !authed ? "none" : "auto", transition: "filter 0.4s ease" }}>
        <style>{`input::placeholder,textarea::placeholder{color:${T.textDim}}`}</style>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onThemeChange={t => setTheme(t)} />}
        {showAdminPanel && <AdminPanel T={T} onClose={() => setShowAdminPanel(false)} />}
        {showHistoryModal && (
          <HistoryModal T={T} onClose={() => setShowHistoryModal(false)} onRestore={h => {
            setPrompt(h.question); setResults(h.results || {}); setLastQuestion(h.question);
            setConsolidated(h.consolidated || ""); setShowConsolidated(!!h.consolidated);
            setSelectedModels(h.models_used || selectedModels);
          }} />
        )}
        {showPromptsModal && <SavedPromptsModal T={T} currentPrompt={prompt} onClose={() => setShowPromptsModal(false)} onSelect={t => setPrompt(t)} />}

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src="https://media.base44.com/images/public/69bd9feba10b3ecf67510347/0a59cfd74_JN8.png" alt="JonasNetto IA"
                style={{ height: 44, width: "auto", filter: T.isLight ? "brightness(0) saturate(100%) invert(8%) sepia(82%) saturate(2700%) hue-rotate(218deg) brightness(90%) contrast(120%)" : "brightness(0) invert(1)" }} />
              <div>
                <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: T.isLight ? T.accent : "transparent", background: T.isLight ? "none" : T.headingGradient, WebkitBackgroundClip: T.isLight ? "none" : "text", WebkitTextFillColor: T.isLight ? T.accent : "transparent" }}>JonasNetto IA</h1>
                <p style={{ margin: 0, fontSize: "0.72rem", color: T.textDim }}>Consulte múltiplos modelos de IA em paralelo</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {gatewayInfo && <span style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: 999, background: gatewayInfo.color + "18", border: "1px solid " + gatewayInfo.color + "66", color: gatewayInfo.color, fontWeight: 600 }}>{gatewayInfo.name}</span>}
              <button onClick={() => setShowHistoryModal(true)} style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 9, padding: "7px 14px", color: T.textMuted, cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}>📚 Histórico</button>
              <button onClick={() => setShowSettings(true)} style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 9, padding: "7px 14px", color: T.textMuted, cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}>⚙️ Config</button>
              {isAdmin && <button onClick={() => setShowAdminPanel(true)} style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 9, padding: "7px 14px", color: T.textMuted, cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}>👥 Usuários</button>}
              <button onClick={() => { localStorage.removeItem("jn_auth_token"); localStorage.removeItem("jn_user_name"); localStorage.removeItem("jn_user_role"); setAuthed(false); }}
                style={{ background: "transparent", border: "1px solid " + (T.isLight ? "#fca5a5" : "#7f1d1d"), borderRadius: 9, padding: "7px 14px", color: T.isLight ? "#dc2626" : "#f87171", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}>
                🔒 {userName ? userName.split(" ")[0] : "Sair"}
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div style={{ ...surfaceStyle, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Modelos <em style={{ fontSize: "0.68rem", fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: "normal" }}>Models</em></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MODELS.map(m => {
                const isSelected = selectedModels.includes(m.id);
                return (
                  <button key={m.id} onClick={() => toggleModel(m.id)}
                    style={{ padding: "7px 16px", borderRadius: 999, border: "1px solid " + (isSelected ? m.color + "66" : T.surfaceBorder), background: isSelected ? m.color + "15" : "transparent", color: isSelected ? m.color : T.textMuted, fontWeight: isSelected ? 700 : 500, cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                    {m.icon} {m.name}
                    {isSelected && <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, display: "inline-block" }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context Panel */}
          <div style={{ ...surfaceStyle, marginBottom: 14, overflow: "hidden" }}>
            <button onClick={() => setShowContext(!showContext)} style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "0.87rem", fontWeight: 500 }}>
              <span>📋 Perfil da Pesquisa <em style={{ fontSize: "0.78rem", fontWeight: 400, fontStyle: "italic", opacity: 0.75 }}>Research Profile</em>
                {hasContext && <span style={{ marginLeft: 8, background: T.accent + "18", border: "1px solid " + T.accent + "33", color: T.accent, borderRadius: 999, padding: "1px 8px", fontSize: "0.7rem", fontWeight: 700 }}>✓ Ativo</span>}
              </span>
              <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{showContext ? "▲" : "▼"}</span>
            </button>
            {showContext && (
              <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {CONTEXT_FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{ display: "block", marginBottom: 5 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textDim, textTransform: "uppercase" }}>{f.label}</span>
                      <em style={{ display: "block", fontSize: "0.68rem", color: T.textDim, fontStyle: "italic", marginTop: 1, opacity: 0.75 }}>{f.labelEn}</em>
                    </label>
                    <input value={context[f.key]} onChange={e => setContext({ ...context, [f.key]: e.target.value })} placeholder={f.placeholder} style={inputStyle} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversation History Toggle */}
          <div style={{ ...surfaceStyle, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => setUseHistory(!useHistory)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: useHistory ? T.accent : T.textMuted, fontWeight: 600, fontSize: "0.85rem", padding: 0 }}>
                <span style={{ width: 38, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", background: useHistory ? T.accent : T.surfaceBorder, transition: "background 0.2s", position: "relative", flexShrink: 0 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", left: useHistory ? 19 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </span>
                🕑 Continuar conversa <em style={{ fontSize: "0.78rem", fontWeight: 400, fontStyle: "italic", opacity: 0.75 }}>Continue conversation</em>
                {chatHistory.length > 0 && <span style={{ background: useHistory ? T.accent : T.surfaceBorder, color: useHistory ? "#fff" : T.textMuted, borderRadius: 999, padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700 }}>{chatHistory.length} troca{chatHistory.length !== 1 ? "s" : ""}</span>}
              </button>
              {chatHistory.length > 0 && <button onClick={() => { setChatHistory([]); setUseHistory(false); }} style={{ background: "none", border: "1px solid " + T.surfaceBorder, borderRadius: 6, cursor: "pointer", color: T.textDim, fontSize: "0.78rem", padding: "3px 10px" }}>🗑️ Limpar</button>}
            </div>
            {useHistory && chatHistory.length > 0 && (
              <div style={{ padding: "0 16px 16px", maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {chatHistory.map((h, i) => (
                  <div key={i} style={{ background: T.isLight ? "#f9fafb" : "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem" }}>
                    <div style={{ color: T.accent, fontWeight: 700, marginBottom: 3 }}>❓ {h.question}</div>
                    <div style={{ color: T.textMuted, lineHeight: 1.5 }}>{h.answer}</div>
                  </div>
                ))}
              </div>
            )}
            {useHistory && chatHistory.length === 0 && <div style={{ padding: "0 16px 14px", color: T.textDim, fontSize: "0.8rem" }}>Faça sua primeira pergunta — o histórico será acumulado automaticamente.</div>}
          </div>

          {/* Prompt */}
          <div style={{ ...surfaceStyle, padding: 16, marginBottom: 20 }}>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta... / Type your question... (Ctrl+Enter para enviar)"
              rows={4} style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: T.text, fontSize: "0.97rem", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.65 }} />
            {attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {attachments.map((a, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.isLight ? "#f0f4ff" : "rgba(129,140,248,0.12)", border: "1px solid " + (T.isLight ? "#c7d2fe" : "rgba(129,140,248,0.3)"), borderRadius: 999, padding: "3px 10px", fontSize: "0.78rem", color: T.accent }}>
                    {a.kind === "image" ? "🖼️" : a.kind === "pdf" ? "📄" : a.kind === "word" ? "📝" : "📄"} {a.name}
                    <button onClick={() => removeAttachment(i)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: "0.85rem", padding: 0, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid " + T.surfaceBorder }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 7, padding: "6px 12px", color: T.textMuted, fontSize: "0.82rem", fontWeight: 500 }}>
                  {attachLoading ? <span style={{ width: 12, height: 12, border: "2px solid " + T.textDim, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> : "📎"}
                  Anexar <em style={{ fontStyle: "italic", fontSize: "0.74rem", opacity: 0.75 }}>Attach</em>
                  <input type="file" multiple accept=".txt,.pdf,.doc,.docx,image/*" onChange={handleFileSelect} style={{ display: "none" }} />
                </label>
                <button onClick={() => setShowPromptsModal(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 7, padding: "6px 12px", color: T.textMuted, fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>⭐ Templates</button>
                <span style={{ color: T.textDim, fontSize: "0.76rem" }}>{selectedModels.length} modelo{selectedModels.length !== 1 ? "s" : ""} · Ctrl+Enter</span>
              </div>
              <button onClick={handleQuery} disabled={loading || (!prompt.trim() && attachments.length === 0)}
                style={{ background: loading ? T.surface : T.accent, color: loading ? T.textMuted : "#fff", border: "1px solid " + (loading ? T.surfaceBorder : "transparent"), borderRadius: 8, padding: "8px 22px", fontWeight: 600, fontSize: "0.88rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                {loading ? <><span style={{ width: 13, height: 13, border: "2px solid " + T.textDim, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Consultando...</> : "🚀 Perguntar / Ask"}
              </button>
            </div>
          </div>

          {/* Error */}
          {queryError && <div style={{ background: T.errorBg, border: "1px solid " + T.errorBorder, borderRadius: 10, padding: "11px 16px", color: T.errorText, marginBottom: 18, fontSize: "0.88rem" }}>⚠️ {queryError}</div>}

          {/* Loading skeletons */}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {selectedModels.map(id => {
                const mod = MODELS.find(x => x.id === id);
                return (
                  <div key={id} style={cardStyle}>
                    <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid " + T.cardBorder, display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: "1.1rem" }}>{mod ? mod.icon : "🤖"}</span>
                      <span style={{ fontWeight: 700, color: mod ? mod.color : T.text, fontSize: "0.92rem" }}>{mod ? mod.name : id}</span>
                      <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: mod ? mod.color : T.accent, animation: "pulse 1.2s ease-in-out infinite" }} />
                    </div>
                    <div style={{ padding: 18 }}>
                      {[80, 65, 90, 50].map((w, i) => <div key={i} style={{ height: 11, borderRadius: 6, background: T.skeleton, marginBottom: 10, width: w + "%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: (i * 0.1) + "s" }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Results */}
          {!loading && hasResults && (
            <>
              {speedRanking.length > 0 && (
                <div style={{ ...surfaceStyle, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>⚡ Velocidade</span>
                  {speedRanking.map((id, i) => {
                    const mod = MODELS.find(x => x.id === id);
                    const r = results[id];
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <span key={id} style={{ display: "flex", alignItems: "center", gap: 5, background: mod ? mod.color + "12" : T.surface, border: "1px solid " + (mod ? mod.color + "33" : T.surfaceBorder), borderRadius: 999, padding: "3px 12px", fontSize: "0.78rem" }}>
                        <span>{medals[i] || (i + 1) + "º"}</span>
                        <span style={{ fontWeight: 700, color: mod ? mod.color : T.text }}>{mod ? mod.icon + " " + mod.name : id}</span>
                        <span style={{ color: i === 0 ? "#16a34a" : T.textMuted, fontWeight: i === 0 ? 700 : 400 }}>{r ? (r.time! / 1000).toFixed(1) + "s" : ""}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button onClick={handleExport} style={{ background: T.isLight ? "#f0fdf4" : "rgba(34,197,94,0.1)", border: "1px solid " + (T.isLight ? "#bbf7d0" : "rgba(34,197,94,0.25)"), borderRadius: 9, padding: "7px 16px", color: T.isLight ? "#16a34a" : "#4ade80", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {exportDone ? "✅ Exportado!" : "⬇️ Exportar TXT / Export"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}>
                {Object.entries(results || {}).map(([id, r]) => {
                  const mod = MODELS.find(x => x.id === id);
                  return (
                    <div key={id} style={cardStyle}>
                      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid " + T.cardBorder, display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ fontSize: "1.1rem" }}>{mod ? mod.icon : "🤖"}</span>
                        <span style={{ fontWeight: 700, color: mod ? mod.color : T.text, fontSize: "0.92rem" }}>{mod ? mod.name : id}</span>
                        {imageAttachment && ["openai", "gemini", "claude"].includes(id) && <span style={{ fontSize: "0.68rem", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 999, padding: "1px 7px", color: "#818cf8", fontWeight: 600 }}>👁️ Vision</span>}
                        {r.time && <SpeedBadge modelId={id} time={r.time} speedRanking={speedRanking} T={T} />}
                        {!r.error && r.response && <CopyButton text={r.response} T={T} />}
                      </div>
                      <div style={{ padding: 18 }}>
                        {r.error ? <div style={{ color: T.errorText, fontSize: "0.85rem", background: T.errorBg, padding: "10px 14px", borderRadius: 8, border: "1px solid " + T.errorBorder }}>⚠️ {r.error}</div> : <MarkdownRenderer text={r.response || ""} T={T} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              {successfulResults.length > 1 && (
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <button onClick={handleConsolidate} disabled={consolidating}
                    style={{ background: T.isLight ? "#fffbeb" : T.consolidateBg, border: "1px solid " + T.consolidateBorder, borderRadius: 10, padding: "10px 28px", color: T.isLight ? "#92400e" : "#fbbf24", fontWeight: 700, fontSize: "0.88rem", cursor: consolidating ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {consolidating ? <><span style={{ width: 13, height: 13, border: "2px solid #fbbf24", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Consolidando...</> : "✨ Consolidar Respostas com " + consolidationModelInfo.icon + " " + consolidationModelInfo.name}
                  </button>
                </div>
              )}
              {showConsolidated && (
                <div style={{ background: T.consolidateBg, border: "1px solid " + T.consolidateBorder, borderRadius: 14, padding: 20, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: "1.1rem" }}>✨</span>
                    <span style={{ fontWeight: 700, color: T.isLight ? "#92400e" : "#fbbf24", fontSize: "0.95rem" }}>Resposta Consolidada / Consolidated Response</span>
                    {!consolidating && consolidated && <CopyButton text={consolidated} T={T} />}
                  </div>
                  {consolidating ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.textMuted, fontSize: "0.88rem" }}>
                      <span style={{ width: 16, height: 16, border: "2px solid " + T.textDim, borderTopColor: T.isLight ? "#92400e" : "#fbbf24", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                      Analisando e consolidando respostas com {consolidationModelInfo.icon} {consolidationModelInfo.name}...
                    </div>
                  ) : <MarkdownRenderer text={consolidated} T={T} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {!authed && <LoginModal onAuth={() => setAuthed(true)} />}
    </>
  );
}

export default function Home() {
  return <ErrorBoundary><HomeApp /></ErrorBoundary>;
}

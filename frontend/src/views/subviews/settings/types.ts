import type { SupportedLanguage, DocumentMetadataItem } from "../../../types";

export const ENGINE_CATALOG_LANGUAGES: SupportedLanguage[] = [
  { code: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
  { code: "pt", label: "Português (Portugal)", flag: "🇵🇹" },
  { code: "en", label: "Inglês (English)", flag: "🇺🇸" },
  { code: "es", label: "Espanhol (Español)", flag: "🇪🇸" },
  { code: "fr", label: "Francês (Français)", flag: "🇫🇷" },
  { code: "de", label: "Alemão (Deutsch)", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "zh-CN", label: "Chinês Simplificado (简体中文)", flag: "🇨🇳" },
  { code: "zh-TW", label: "Chinês Tradicional (繁體中文)", flag: "🇹🇼" },
  { code: "ja", label: "Japonês (日本語)", flag: "🇯🇵" },
  { code: "ko", label: "Coreano (한국어)", flag: "🇰🇷" },
  { code: "ru", label: "Russo (Русский)", flag: "🇷🇺" },
  { code: "nl", label: "Holandês (Nederlands)", flag: "🇳🇱" },
  { code: "pl", label: "Polonês (Polski)", flag: "🇵🇱" },
  { code: "sv", label: "Sueco (Svenska)", flag: "🇸🇪" },
  { code: "da", label: "Dinamarquês (Dansk)", flag: "🇩🇰" },
  { code: "no", label: "Norueguês (Norsk)", flag: "🇳🇴" },
  { code: "fi", label: "Finlandês (Suomi)", flag: "🇫🇮" },
  { code: "cs", label: "Tcheco (Čeština)", flag: "🇨🇿" },
  { code: "el", label: "Grego (Ελληνικά)", flag: "🇬🇷" },
  { code: "he", label: "Hebraico (עברית)", flag: "🇮🇱" },
  { code: "ar", label: "Árabe (العربية)", flag: "🇸🇦" },
  { code: "hi", label: "Hindi (हिन्दी)", flag: "🇮🇳" },
  { code: "tr", label: "Turco (Türkçe)", flag: "🇹🇷" },
  { code: "id", label: "Indonésio (Bahasa Indonesia)", flag: "🇮🇩" },
  { code: "vi", label: "Vietnamita (Tiếng Việt)", flag: "🇻🇳" },
  { code: "th", label: "Tailandês (ไทย)", flag: "🇹🇭" },
  { code: "uk", label: "Ucraniano (Українська)", flag: "🇺🇦" },
  { code: "ro", label: "Romeno (Română)", flag: "🇷🇴" },
  { code: "hu", label: "Húngaro (Magyar)", flag: "🇭🇺" },
  { code: "bg", label: "Búlgaro (Български)", flag: "🇧🇬" },
  { code: "sk", label: "Eslovaco (Slovenčina)", flag: "🇸🇰" },
  { code: "hr", label: "Croata (Hrvatski)", flag: "🇭🇷" },
  { code: "ca", label: "Catalão (Català)", flag: "🇪🇸" },
  { code: "ms", label: "Malaio (Bahasa Melayu)", flag: "🇲🇾" },
  { code: "tl", label: "Filipino / Tagalog", flag: "🇵🇭" },
  { code: "bn", label: "Bengali (বাংলা)", flag: "🇧🇩" },
  { code: "fa", label: "Persa / Farsi (فارسی)", flag: "🇮🇷" },
];

export function formatStatusName(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

export interface DeleteDialogState {
  isOpen: boolean;
  type: "status" | "category" | "tag" | "badge";
  nameOrKey: string;
  label: string;
  referencingDocs: DocumentMetadataItem[];
  onConfirm: () => Promise<void>;
}

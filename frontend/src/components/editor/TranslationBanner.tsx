import React from "react";
import type { SupportedLanguage } from "../../types";

interface TranslationBannerProps {
  currentLanguage: string;
  defaultLanguage: string;
  supportedLanguages: SupportedLanguage[];
  isOutdated?: boolean;
  onSyncToMain: () => void;
  onBackToMain: () => void;
  onUpdateFromMain?: () => void;
  isSyncing?: boolean;
  isUpdating?: boolean;
}

export const TranslationBanner: React.FC<TranslationBannerProps> = ({
  currentLanguage,
  defaultLanguage,
  supportedLanguages,
  isOutdated = false,
  onSyncToMain,
  onBackToMain,
  onUpdateFromMain,
  isSyncing = false,
  isUpdating = false,
}) => {
  const currentLangObj = supportedLanguages.find(
    (l) => l.code.toLowerCase() === currentLanguage.toLowerCase(),
  ) || {
    code: currentLanguage,
    label: currentLanguage,
    flag: "🌐",
  };

  const defaultLangObj = supportedLanguages.find(
    (l) => l.code.toLowerCase() === defaultLanguage.toLowerCase(),
  ) || {
    code: defaultLanguage,
    label: defaultLanguage,
    flag: "🇧🇷",
  };

  return (
    <div
      className="translation-mode-banner"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        background: isOutdated
          ? "linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.05) 100%)"
          : "linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)",
        borderBottom: isOutdated
          ? "1px solid rgba(245, 158, 11, 0.3)"
          : "1px solid rgba(16, 185, 129, 0.25)",
        fontSize: "12.5px",
        color: "var(--color-on-surface, #1e293b)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "16px" }}>{currentLangObj.flag}</span>
        <div>
          <span
            style={{
              fontWeight: 600,
              color: isOutdated ? "#b45309" : "#047857",
            }}
          >
            {currentLangObj.label} ({currentLangObj.code.toUpperCase()})
          </span>

          {isOutdated && (
            <span
              style={{
                marginLeft: "8px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "#fef3c7",
                color: "#92400e",
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              ⚠️ Desatualizado
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {isOutdated && onUpdateFromMain && (
          <button
            type="button"
            onClick={onUpdateFromMain}
            disabled={isUpdating}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 11px",
              borderRadius: "6px",
              border: "1px solid #f59e0b",
              background: "rgba(245, 158, 11, 0.15)",
              color: "#92400e",
              fontSize: "12px",
              fontWeight: 600,
              cursor: isUpdating ? "not-allowed" : "pointer",
            }}
            title="Atualizar esta tradução com as alterações mais recentes feitas no documento oficial"
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "15px",
                animation: isUpdating ? "spin 1s linear infinite" : "none",
              }}
            >
              autorenew
            </span>
            <span>
              {isUpdating ? "Atualizando..." : "Re-traduzir do Oficial"}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onBackToMain}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "5px 10px",
            borderRadius: "6px",
            border: "1px solid var(--color-outline-variant, #cbd5e1)",
            background: "var(--color-surface, #ffffff)",
            color: "var(--color-on-surface, #1e293b)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "15px" }}
          >
            arrow_back
          </span>
          Oficial ({defaultLangObj.code.toUpperCase()})
        </button>

        <button
          type="button"
          onClick={onSyncToMain}
          disabled={isSyncing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            borderRadius: "6px",
            border: "none",
            background: "var(--primary, #2563eb)",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 600,
            cursor: isSyncing ? "not-allowed" : "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
          title="Traduzir as edições feitas neste idioma de volta para o documento oficial com revisão visual de Diff"
        >
          {isSyncing ? (
            <span
              className="material-symbols-outlined"
              style={{ animation: "spin 1s linear infinite", fontSize: "15px" }}
            >
              progress_activity
            </span>
          ) : (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "15px" }}
            >
              sync_alt
            </span>
          )}
          <span>Sincronizar ({defaultLangObj.code.toUpperCase()})</span>
        </button>
      </div>
    </div>
  );
};

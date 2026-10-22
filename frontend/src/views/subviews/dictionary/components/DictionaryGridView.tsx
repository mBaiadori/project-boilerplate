import React from "react";
import { Check, Copy, Edit3, Tag, Trash2 } from "lucide-react";
import { Card, CardContent, IconButton } from "../../../../components/ui";
import type { DictionaryTerm } from "../../../../types";

interface DictionaryGridViewProps {
  filteredTerms: DictionaryTerm[];
  terms: DictionaryTerm[];
  copiedCodeId: string | null;
  onCopyCode: (code: string) => void;
  getDomainColor: (domain?: string) => string;
  getDddCategoryInfo: (cat?: string) => { label: string; color: string };
  onEditTerm: (term: DictionaryTerm, originalIdx: number) => void;
  onDeleteTerm: (originalIdx: number) => void;
}

export const DictionaryGridView: React.FC<DictionaryGridViewProps> = ({
  filteredTerms,
  terms,
  copiedCodeId,
  onCopyCode,
  getDomainColor,
  getDddCategoryInfo,
  onEditTerm,
  onDeleteTerm,
}) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: "14px",
      }}
    >
      {filteredTerms.map((t) => {
        const originalIdx = terms.findIndex(
          (item) =>
            item.term === t.term &&
            (item.codename === t.codename || item.code_name === t.code_name)
        );
        const codename = t.codename || t.code_name || "";
        const isCodeCopied = copiedCodeId === codename;
        const domainColor = getDomainColor(t.domain);
        const dddInfo = getDddCategoryInfo(t.category);
        const synonyms: string[] = (t.synonyms || t.aliases || []) as string[];

        return (
          <Card
            key={`${t.term}-${codename}-${originalIdx}`}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.15s ease",
              border: "1px solid var(--color-outline-variant, #e2e8f0)",
            }}
          >
            <CardContent style={{ padding: "16px" }}>
              {/* Top Row: Domain & Category Badges + Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  {t.domain && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "1px 7px",
                        borderRadius: 10,
                        backgroundColor: `${domainColor}15`,
                        borderColor: `${domainColor}40`,
                        borderWidth: 1,
                        borderStyle: "solid",
                        color: domainColor,
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          backgroundColor: domainColor,
                        }}
                      />
                      {t.domain}
                    </span>
                  )}
                  {t.category && (
                    <span
                      style={{
                        padding: "1px 5px",
                        borderRadius: 4,
                        backgroundColor: `${dddInfo.color}10`,
                        color: dddInfo.color,
                        border: `1px solid ${dddInfo.color}25`,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {t.category}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                  }}
                >
                  <IconButton
                    icon={<Edit3 size={13} />}
                    variant="ghost"
                    size="xs"
                    tooltip="Editar termo"
                    onClick={() => onEditTerm(t, originalIdx)}
                  />
                  <IconButton
                    icon={<Trash2 size={13} />}
                    variant="ghost"
                    size="xs"
                    tooltip="Remover termo"
                    onClick={() => onDeleteTerm(originalIdx)}
                    style={{ color: "var(--color-error, #ef4444)" }}
                  />
                </div>
              </div>

              {/* Title */}
              <h3
                style={{
                  margin: "0 0 6px 0",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--color-on-surface, #0f172a)",
                  lineHeight: 1.3,
                }}
              >
                {t.term}
              </h3>

              {/* Codename Pill */}
              {codename && (
                <div
                  style={{
                    marginBottom: "10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    background: "var(--color-surface-container, #f1f5f9)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  }}
                >
                  <code
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--color-primary, #1a73e8)",
                    }}
                  >
                    {codename}
                  </code>
                  <IconButton
                    size="xs"
                    variant="ghost"
                    onClick={() => onCopyCode(codename)}
                    title={isCodeCopied ? "Copiado!" : "Copiar Code Name"}
                    icon={
                      isCodeCopied ? (
                        <Check size={11} style={{ color: "var(--color-success, #16a34a)" }} />
                      ) : (
                        <Copy size={11} />
                      )
                    }
                  />
                </div>
              )}

              {/* Definition */}
              <p
                style={{
                  margin: 0,
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                  color: "var(--color-on-surface-variant, #334155)",
                }}
              >
                {t.definition}
              </p>

              {/* Synonyms Chips */}
              {synonyms.length > 0 && (
                <div
                  style={{
                    marginTop: "10px",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--color-outline-variant, #f1f5f9)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    flexWrap: "wrap",
                  }}
                >
                  <Tag
                    size={11}
                    style={{ color: "var(--color-outline, #94a3b8)" }}
                  />
                  {synonyms.map((syn: string, sIdx: number) => (
                    <span
                      key={sIdx}
                      style={{
                        fontSize: "10.5px",
                        background: "var(--color-surface-container-high, #f1f5f9)",
                        color: "var(--color-on-surface-variant, #475569)",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        border: "1px solid var(--color-outline-variant, #e2e8f0)",
                      }}
                    >
                      {syn}
                    </span>
                  ))}
                </div>
              )}

              {/* Context Footer */}
              {t.context && (
                <div
                  style={{
                    marginTop: synonyms.length > 0 ? "6px" : "10px",
                    fontSize: "11px",
                    color: "var(--color-on-surface-variant, #64748b)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Contexto:</span>
                  <span>{t.context}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

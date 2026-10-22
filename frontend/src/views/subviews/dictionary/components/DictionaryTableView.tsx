import React from "react";
import { Check, Copy, Edit3, Trash2 } from "lucide-react";
import { Card, IconButton } from "../../../../components/ui";
import type { DictionaryTerm } from "../../../../types";

interface DictionaryTableViewProps {
  filteredTerms: DictionaryTerm[];
  terms: DictionaryTerm[];
  copiedCodeId: string | null;
  onCopyCode: (code: string) => void;
  getDomainColor: (domain?: string) => string;
  getDddCategoryInfo: (cat?: string) => { label: string; color: string };
  onEditTerm: (term: DictionaryTerm, originalIdx: number) => void;
  onDeleteTerm: (originalIdx: number) => void;
}

export const DictionaryTableView: React.FC<DictionaryTableViewProps> = ({
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
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--color-surface-container, #f8fafc)",
                borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
              }}
            >
              <th
                style={{
                  padding: "12px 18px",
                  fontWeight: 600,
                  color: "var(--color-on-surface, #334155)",
                  width: "24%",
                }}
              >
                Termo & Sinônimos
              </th>
              <th
                style={{
                  padding: "12px 18px",
                  fontWeight: 600,
                  color: "var(--color-on-surface, #334155)",
                  width: "18%",
                }}
              >
                Code Name Oficial
              </th>
              <th
                style={{
                  padding: "12px 18px",
                  fontWeight: 600,
                  color: "var(--color-on-surface, #334155)",
                  width: "16%",
                }}
              >
                Domínio & Tipo
              </th>
              <th
                style={{
                  padding: "12px 18px",
                  fontWeight: 600,
                  color: "var(--color-on-surface, #334155)",
                  width: "32%",
                }}
              >
                Definição & Contexto
              </th>
              <th
                style={{
                  padding: "12px 18px",
                  fontWeight: 600,
                  color: "var(--color-on-surface, #334155)",
                  width: "10%",
                  textAlign: "right",
                }}
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
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
                <tr
                  key={`${t.term}-${codename}-${originalIdx}`}
                  style={{
                    borderBottom: "1px solid var(--color-outline-variant, #f1f5f9)",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--color-surface-container, #f8fafc)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {/* Term & Synonyms */}
                  <td style={{ padding: "12px 18px", verticalAlign: "top" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--color-on-surface, #0f172a)",
                        fontSize: "13.5px",
                      }}
                    >
                      {t.term}
                    </div>
                    {synonyms.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        {synonyms.map((syn: string, sIdx: number) => (
                          <span
                            key={sIdx}
                            style={{
                              fontSize: "10.5px",
                              background:
                                "var(--color-surface-container-high, #f1f5f9)",
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
                  </td>

                  {/* Code Name Badge with 1-click Copy */}
                  <td style={{ padding: "12px 18px", verticalAlign: "top" }}>
                    {codename ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <code
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            background:
                              "var(--color-surface-container-high, #e0f2fe)",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            fontSize: "11.5px",
                            color: "var(--color-primary, #0284c7)",
                            fontWeight: 600,
                            border: "1px solid rgba(2, 132, 199, 0.2)",
                          }}
                        >
                          {codename}
                        </code>
                        <IconButton
                          icon={
                            isCodeCopied ? (
                              <Check
                                size={12}
                                style={{
                                  color: "var(--color-success, #16a34a)",
                                }}
                              />
                            ) : (
                              <Copy size={12} />
                            )
                          }
                          variant="ghost"
                          size="xs"
                          tooltip={
                            isCodeCopied ? "Copiado!" : "Copiar Code Name"
                          }
                          onClick={() => onCopyCode(codename)}
                        />
                      </div>
                    ) : (
                      <span
                        style={{
                          color: "var(--color-outline, #94a3b8)",
                          fontSize: "12px",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  {/* Domain & Category Badges */}
                  <td style={{ padding: "12px 18px", verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {t.domain && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            width: "fit-content",
                            padding: "1px 7px",
                            borderRadius: 10,
                            backgroundColor: `${domainColor}15`,
                            borderColor: `${domainColor}40`,
                            borderWidth: 1,
                            borderStyle: "solid",
                            color: domainColor,
                            fontSize: 11,
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
                            display: "inline-flex",
                            alignItems: "center",
                            width: "fit-content",
                            padding: "1px 6px",
                            borderRadius: 4,
                            backgroundColor: `${dddInfo.color}10`,
                            color: dddInfo.color,
                            border: `1px solid ${dddInfo.color}25`,
                            fontSize: 10.5,
                            fontWeight: 600,
                          }}
                        >
                          {t.category}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Definition & Context */}
                  <td
                    style={{
                      padding: "12px 18px",
                      verticalAlign: "top",
                      color: "var(--color-on-surface-variant, #334155)",
                      lineHeight: 1.5,
                      fontSize: "13px",
                    }}
                  >
                    <div>{t.definition}</div>
                    {t.context && (
                      <div
                        style={{
                          marginTop: "4px",
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
                  </td>

                  {/* Actions */}
                  <td
                    style={{
                      padding: "12px 18px",
                      verticalAlign: "top",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <IconButton
                      icon={<Edit3 size={14} />}
                      variant="ghost"
                      size="xs"
                      tooltip="Editar termo"
                      onClick={() => onEditTerm(t, originalIdx)}
                    />
                    <IconButton
                      icon={<Trash2 size={14} />}
                      variant="ghost"
                      size="xs"
                      tooltip="Remover termo"
                      onClick={() => onDeleteTerm(originalIdx)}
                      style={{ color: "var(--color-error, #ef4444)" }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

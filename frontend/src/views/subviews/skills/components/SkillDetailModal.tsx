import React from "react";
import { BookOpen, Download, Play, Trash2, Wrench } from "lucide-react";
import { Badge, Button, Modal } from "../../../../components/ui";
import type { SkillItem } from "../../../../types";
import { getCategoryIcon } from "../utils/categoryIcons";

interface SkillDetailModalProps {
  selectedSkill: SkillItem | null;
  onClose: () => void;
  isInstalled: boolean;
  onUninstall: (skillId: string) => void;
  onActivateCopilot: (skill: SkillItem) => void;
  onInstall: (skill: SkillItem) => void;
}

export const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  selectedSkill,
  onClose,
  isInstalled,
  onUninstall,
  onActivateCopilot,
  onInstall,
}) => {
  if (!selectedSkill) return null;

  return (
    <Modal
      isOpen={Boolean(selectedSkill)}
      onClose={onClose}
      title={selectedSkill.title || selectedSkill.name}
      subtitle={`id: ${selectedSkill.id} • v${selectedSkill.version} • categoria: ${selectedSkill.category}`}
      icon={getCategoryIcon(selectedSkill.category)}
      size="lg"
      footer={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {isInstalled ? (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onUninstall(selectedSkill.id)}
                icon={<Trash2 size={14} />}
              >
                Desinstalar do Projeto
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onActivateCopilot(selectedSkill);
                  onClose();
                }}
                icon={<Play size={14} />}
              >
                Ativar no Copilot Agora
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                Fechar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onInstall(selectedSkill);
                  onClose();
                }}
                icon={<Download size={14} />}
              >
                Instalar no Projeto
              </Button>
            </>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Description */}
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--color-outline)",
              marginBottom: "4px",
            }}
          >
            Descrição
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--color-on-surface)",
              lineHeight: 1.5,
            }}
          >
            {selectedSkill.description}
          </p>
        </div>

        {/* Tools */}
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--color-outline)",
              marginBottom: "6px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Wrench size={13} style={{ color: "var(--color-primary)" }} />
            Ferramentas Autônomas Vinculadas
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {selectedSkill.tools && selectedSkill.tools.length > 0 ? (
              selectedSkill.tools.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: "11.5px",
                    fontFamily: "var(--font-mono, monospace)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "var(--color-surface-container-high)",
                    color: "var(--color-primary)",
                    border: "1px solid var(--color-outline-variant)",
                  }}
                >
                  {t}
                </span>
              ))
            ) : (
              <span style={{ fontSize: "12px", color: "var(--color-outline)" }}>
                Nenhuma ferramenta especial necessária.
              </span>
            )}
          </div>
        </div>

        {/* Suggested Templates */}
        {selectedSkill.suggested_templates &&
          selectedSkill.suggested_templates.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--color-outline)",
                  marginBottom: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <BookOpen size={13} style={{ color: "var(--color-success)" }} />
                Templates Recomendados
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {selectedSkill.suggested_templates.map((tpl) => (
                  <Badge key={tpl} variant="success" size="sm">
                    {tpl}
                  </Badge>
                ))}
              </div>
            </div>
          )}

        {/* Instructions / SKILL.md */}
        {selectedSkill.content && (
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--color-outline)",
                marginBottom: "6px",
              }}
            >
              Instruções do Agente (SKILL.md)
            </div>
            <pre
              style={{
                fontSize: "11.5px",
                lineHeight: "1.45",
                fontFamily: "var(--font-mono, monospace)",
                padding: "12px",
                borderRadius: "var(--radius-md, 8px)",
                background: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
                color: "var(--color-on-surface)",
                whiteSpace: "pre-wrap",
                overflowX: "auto",
                maxHeight: "240px",
                margin: 0,
              }}
            >
              {selectedSkill.content}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
};

import React from "react";
import { CheckCircle2, Download, Eye, Play, Wrench } from "lucide-react";
import { Badge, Button, Card, CardContent, CardFooter, CardHeader } from "../../../../components/ui";
import type { SkillItem } from "../../../../types";

interface SkillCardProps {
  skill: SkillItem;
  installed: boolean;
  isActiveInCopilot: boolean;
  onOpenDetails: (skill: SkillItem) => void;
  onActivateCopilot: (skill: SkillItem) => void;
  onInstall: (skill: SkillItem) => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  installed,
  isActiveInCopilot,
  onOpenDetails,
  onActivateCopilot,
  onInstall,
}) => {
  const isSystem = skill.source === "system";
  const isProject = skill.source === "project";

  return (
    <Card
      key={skill.id}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: isActiveInCopilot
          ? "2px solid var(--color-primary)"
          : "1px solid var(--color-outline-variant)",
      }}
    >
      <CardHeader
        title={skill.title || skill.name}
        subtitle={`v${skill.version} • ${skill.id}`}
        action={
          <div
            style={{
              display: "flex",
              gap: "4px",
              alignItems: "center",
            }}
          >
            {skill.category && (
              <Badge variant="primary" size="sm">
                {skill.category}
              </Badge>
            )}
            {isSystem ? (
              <Badge variant="info" size="sm">
                Sistema
              </Badge>
            ) : isProject ? (
              <Badge variant="success" size="sm">
                Projeto
              </Badge>
            ) : (
              <Badge variant="purple" size="sm">
                Comunidade
              </Badge>
            )}
            {installed && (
              <Badge variant="success" size="sm" dot>
                Ativa
              </Badge>
            )}
          </div>
        }
      />

      <CardContent
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12.5px",
            color: "var(--color-on-surface-variant)",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {skill.description}
        </p>

        {/* Tools */}
        {skill.tools && skill.tools.length > 0 && (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {skill.tools.slice(0, 3).map((tool) => (
              <span
                key={tool}
                style={{
                  fontSize: "10.5px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "var(--color-surface-container-high)",
                  color: "var(--color-on-surface-variant)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  border: "1px solid var(--color-outline-variant)",
                }}
              >
                <Wrench
                  size={10}
                  style={{ color: "var(--color-primary)" }}
                />
                {tool}
              </span>
            ))}
            {skill.tools.length > 3 && (
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--color-outline)",
                }}
              >
                +{skill.tools.length - 3}
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter
        style={{
          borderTop: "1px solid var(--color-outline-variant)",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onOpenDetails(skill)}
          icon={<Eye size={14} />}
        >
          Detalhes
        </Button>

        {installed ? (
          <Button
            variant={isActiveInCopilot ? "primary" : "secondary"}
            size="sm"
            fullWidth
            onClick={() => onActivateCopilot(skill)}
            icon={
              isActiveInCopilot ? (
                <CheckCircle2 size={14} />
              ) : (
                <Play size={14} />
              )
            }
          >
            {isActiveInCopilot ? "Ativa no Copilot" : "Ativar no Copilot"}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => onInstall(skill)}
            icon={<Download size={14} />}
          >
            Instalar no Projeto
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

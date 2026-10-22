import React from "react";
import { Layers, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardContent, Badge, Button } from "../../../../components/ui";

interface TemplatePromptSectionProps {
  activeRepoName?: string;
  onNavigateToTemplates: () => void;
}

export const TemplatePromptSection: React.FC<TemplatePromptSectionProps> = ({
  onNavigateToTemplates,
}) => {
  return (
    <section id="template-prompt" style={{ scrollMarginTop: "72px" }}>
      <Card variant="elevated">
        <CardHeader
          title={
            <div className="ui-row ui-row--align-center ui-row--sm">
              <Layers size={17} style={{ color: "#8b5cf6" }} />
              <span>Criador de Templates</span>
            </div>
          }
          subtitle="Crie, customize e gerencie templates de documentação viva no editor dedicado."
          actions={<Badge variant="purple">Template Studio</Badge>}
        />

        <CardContent>
          <div className="ui-panel ui-panel--subtle ui-row ui-row--align-center ui-row--justify-between ui-row--wrap ui-row--md">
            <div
              className="ui-stack ui-stack--xs"
              style={{ flex: 1, minWidth: "260px" }}
            >
              <strong className="ui-text-title">
                Editor & Estúdio de Templates
              </strong>
              <span className="ui-text-body-sm ui-text-muted">
                Acesse o editor rico para criar novos templates, importar
                modelos da comunidade e editar o conteúdo em Markdown.
              </span>
            </div>

            <Button
              variant="primary"
              leftIcon={<ExternalLink size={14} />}
              onClick={onNavigateToTemplates}
            >
              Abrir Editor de Templates
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

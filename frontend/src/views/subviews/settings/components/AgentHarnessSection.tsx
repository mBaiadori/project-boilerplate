import React from "react";
import { Terminal, Zap, Sparkles, Cpu, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardContent, Stack, Badge, FormField, Input, Button } from "../../../../components/ui";

interface AgentHarnessSectionProps {
  harnessProvider: string;
  setHarnessProvider: (val: string) => void;
  detectedProviders: Array<{
    id: string;
    name: string;
    description: string;
    mode: string;
    isAvailable: boolean;
    isAuthenticated: boolean;
    statusMessage?: string;
  }>;
  agentEffort: "low" | "medium" | "high";
  setAgentEffort: (val: "low" | "medium" | "high") => void;
  isCheckingHarness: boolean;
  checkHarnessProviders: () => void;
  harnessCheckFeedback: string | null;
  antigravityCliPath: string;
  setAntigravityCliPath: (val: string) => void;
  claudeCliPath: string;
  setClaudeCliPath: (val: string) => void;
}

export const AgentHarnessSection: React.FC<AgentHarnessSectionProps> = ({
  harnessProvider,
  setHarnessProvider,
  detectedProviders,
  agentEffort,
  setAgentEffort,
  isCheckingHarness,
  checkHarnessProviders,
  harnessCheckFeedback,
  antigravityCliPath,
  setAntigravityCliPath,
  claudeCliPath,
  setClaudeCliPath,
}) => {
  return (
    <Card variant="elevated">
      <CardHeader
        title={
          <div className="ui-row ui-row--align-center ui-row--sm">
            <Terminal size={17} className="ui-text-primary" />
            <span>Agentes Conectados & CLI Harness (Proxy)</span>
          </div>
        }
        subtitle="Execução de alto desempenho conectada aos agentes e CLIs autenticados no computador."
        actions={
          <Badge
            variant={
              harnessProvider === "antigravity"
                ? "primary"
                : harnessProvider === "claude-code"
                  ? "warning"
                  : "neutral"
            }
          >
            {harnessProvider.toUpperCase()}
          </Badge>
        }
      />

      <CardContent>
        <Stack gap="md">
          {/* Seleção de Harness */}
          <div className="ui-grid-cards">
            {[
              {
                id: "antigravity",
                name: "Google Antigravity Agent",
                cliName: "agy",
                sub: "Agente multi-ferramenta com streaming SSE e raciocínio contextual",
                icon: <Zap size={15} className="ui-text-primary" />,
                detected:
                  detectedProviders.find((p) => p.id === "antigravity")
                    ?.isAvailable ?? true,
                statusMsg:
                  detectedProviders.find((p) => p.id === "antigravity")
                    ?.statusMessage || "Detectado em ~/.local/bin/agy",
              },
              {
                id: "claude-code",
                name: "Claude Code CLI",
                cliName: "claude",
                sub: "Harness conectado ao agente oficial Claude Code CLI",
                icon: <Sparkles size={15} className="ui-text-warning" />,
                detected:
                  detectedProviders.find((p) => p.id === "claude-code")
                    ?.isAvailable ?? true,
                statusMsg:
                  detectedProviders.find((p) => p.id === "claude-code")
                    ?.statusMessage || "Detectado em ~/.local/bin/claude",
              },
              {
                id: "direct-api",
                name: "Direct API Fallback",
                cliName: "RAW / SDK",
                sub: "Chamadas diretas de modelo via SDK e chaves de API em nuvem",
                icon: <Cpu size={15} className="ui-text-success" />,
                detected: true,
                statusMsg: "Sempre disponível com chaves de API",
              },
            ].map((item) => {
              const isSelected = harnessProvider === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setHarnessProvider(item.id)}
                  className={`ui-select-tile ${isSelected ? "ui-select-tile--selected" : ""}`}
                >
                  <div className="ui-select-tile__header">
                    <div className="ui-row ui-row--align-center ui-row--xs">
                      {item.icon}
                      <strong className="ui-text-title">
                        {item.name}
                      </strong>
                    </div>
                    <Badge
                      variant={item.detected ? "success" : "danger"}
                      size="sm"
                      dot
                    >
                      {item.detected ? "Detectado" : "Não Localizado"}
                    </Badge>
                  </div>
                  <p className="ui-select-tile__sub">{item.sub}</p>
                  <span
                    className={`ui-text-caption ${item.detected ? "ui-text-success" : "ui-text-danger"}`}
                  >
                    {item.statusMsg}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Parâmetros do Agente */}
          <div className="ui-grid-2cols">
            <FormField label="Raciocínio do Agente:">
              <div className="ui-segmented-group">
                {[
                  { id: "low", label: "⚡ Rápido", sub: "" },
                  { id: "medium", label: "⚖️ Equilibrado", sub: "" },
                  { id: "high", label: "🧠 Profundo", sub: "" },
                ].map((eff) => {
                  const isEffSelected = agentEffort === eff.id;
                  return (
                    <button
                      key={eff.id}
                      type="button"
                      onClick={() => setAgentEffort(eff.id as any)}
                      className={`ui-segmented-btn ${isEffSelected ? "ui-segmented-btn--active" : ""}`}
                    >
                      <div>{eff.label}</div>
                      <div className="ui-text-caption ui-text-muted">
                        {eff.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormField>

            <div className="ui-stack ui-stack--xs">
              <label className="ui-text-subtitle ui-text-bold">
                Status da Conexão CLI:
              </label>
              <div className="ui-row ui-row--align-center ui-row--sm">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={
                    <RefreshCw
                      size={13}
                      className={isCheckingHarness ? "spinning" : ""}
                    />
                  }
                  onClick={checkHarnessProviders}
                  disabled={isCheckingHarness}
                >
                  {isCheckingHarness
                    ? "Verificando..."
                    : "Testar Detecção de CLIs"}
                </Button>
                {harnessCheckFeedback && (
                  <span className="ui-text-caption ui-text-success ui-text-bold">
                    {harnessCheckFeedback}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Caminhos customizados para portabilidade */}
          <div className="ui-grid-2cols">
            <FormField label="Caminho Customizado Antigravity CLI (Opcional):">
              <Input
                placeholder="Ex: ~/.local/bin/agy ou /usr/local/bin/agy"
                value={antigravityCliPath}
                onChange={(e) => setAntigravityCliPath(e.target.value)}
              />
            </FormField>
            <FormField label="Caminho Customizado Claude Code CLI (Opcional):">
              <Input
                placeholder="Ex: ~/.local/bin/claude ou /usr/local/bin/claude"
                value={claudeCliPath}
                onChange={(e) => setClaudeCliPath(e.target.value)}
              />
            </FormField>
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
};

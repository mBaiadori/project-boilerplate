import React from "react";
import { Cpu, RefreshCw, Save } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Stack,
  Badge,
  FormField,
  Input,
  SelectDropdown,
  IconButton,
  Button,
} from "../../../../components/ui";
import type { SelectOption } from "../../../../components/ui";

interface AIEngineSectionProps {
  provider: string;
  setProvider: (val: string) => void;
  model: string;
  setModel: (val: string) => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  endpoint: string;
  setEndpoint: (val: string) => void;
  selectOptions: SelectOption[];
  fetchModelsForProvider: (provId: string, customKey?: string, customEp?: string) => Promise<void>;
  isLoadingModels: boolean;
  handleSaveAISettings: () => Promise<void>;
}

export const AIEngineSection: React.FC<AIEngineSectionProps> = ({
  provider,
  setProvider,
  model,
  setModel,
  apiKey,
  setApiKey,
  endpoint,
  setEndpoint,
  selectOptions,
  fetchModelsForProvider,
  isLoadingModels,
  handleSaveAISettings,
}) => {
  return (
    <Card variant="elevated">
      <CardHeader
        title={
          <div className="ui-row ui-row--align-center ui-row--sm">
            <Cpu size={17} className="ui-text-success" />
            <span>Motor de Inteligência Artificial</span>
          </div>
        }
        subtitle="Provedor e modelo para assistência e copiloto."
        actions={<Badge variant="success">{provider.toUpperCase()}</Badge>}
      />

      <CardContent>
        <Stack gap="md">
          <div className="ui-grid-cards ui-grid-cards--sm">
            {[
              {
                id: "gemini",
                name: "Google Gemini",
                sub: "Flash 2.5 & Pro",
              },
              { id: "openai", name: "OpenAI", sub: "GPT-4o & o3-mini" },
              {
                id: "anthropic",
                name: "Anthropic",
                sub: "Claude 3.7 & 3.5",
              },
              { id: "deepseek", name: "DeepSeek", sub: "V3 & R1" },
              { id: "local", name: "Ollama Local", sub: "Localhost" },
            ].map((p) => {
              const isSelected = provider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setProvider(p.id);
                    fetchModelsForProvider(p.id, apiKey, endpoint);
                  }}
                  className={`ui-select-tile ${isSelected ? "ui-select-tile--success-selected" : ""}`}
                >
                  <strong className="ui-text-title">{p.name}</strong>
                  <span className="ui-select-tile__sub">{p.sub}</span>
                </div>
              );
            })}
          </div>

          <div className="ui-grid-2cols">
            <FormField label="Modelo Selecionado:">
              <div
                className="ui-row ui-row--align-center ui-row--xs"
                style={{ width: "100%" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SelectDropdown
                    value={model}
                    options={selectOptions}
                    onChange={(val) => setModel(val)}
                    placeholder="Selecione o modelo..."
                    searchable={selectOptions.length > 5}
                    searchPlaceholder="Filtrar..."
                    leadingIcon="smart_toy"
                  />
                </div>
                <IconButton
                  size="sm"
                  bordered
                  tooltip="Recarregar modelos do provedor"
                  onClick={() =>
                    fetchModelsForProvider(provider, apiKey, endpoint)
                  }
                  disabled={isLoadingModels}
                >
                  <RefreshCw
                    size={13}
                    className={isLoadingModels ? "spinning" : ""}
                  />
                </IconButton>
              </div>
            </FormField>

            <FormField label="Chave de API (API Key):">
              <Input
                type="password"
                placeholder="Cole sua chave aqui..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() =>
                  apiKey.trim() &&
                  fetchModelsForProvider(provider, apiKey, endpoint)
                }
              />
            </FormField>
          </div>

          {provider === "local" && (
            <FormField label="Endpoint Local (Ollama):">
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </FormField>
          )}
        </Stack>
      </CardContent>

      <CardFooter>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save size={13} />}
          onClick={handleSaveAISettings}
        >
          Salvar Motor de IA
        </Button>
      </CardFooter>
    </Card>
  );
};

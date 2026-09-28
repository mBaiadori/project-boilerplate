import React, { useState, useEffect, useMemo } from "react";
import { useAI } from "../../context/AIContext";
import { API } from "../../services/api";
import { SelectDropdown, type SelectOption } from "../common/SelectDropdown";
import {
  Modal,
  Button,
  FormField,
  Input,
  Badge,
  AlertBanner,
} from "../ui";
import { RefreshCw, Edit2, Cpu } from "lucide-react";

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    desc: "Gemini 2.5 Flash / 2.5 Pro",
    needsKey: true,
    hasEndpoint: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    desc: "GPT-4o / GPT-4o-mini",
    needsKey: true,
    hasEndpoint: false,
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    desc: "Claude 3.7 & 3.5 Sonnet",
    needsKey: true,
    hasEndpoint: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek API",
    desc: "DeepSeek V3 / R1",
    needsKey: true,
    hasEndpoint: false,
  },
  {
    id: "local",
    name: "Ollama Local",
    desc: "Offline & Sem Chave",
    needsKey: false,
    hasEndpoint: true,
    defaultEndpoint: "http://localhost:11434/v1",
  },
];

interface DetailedModelItem {
  id: string;
  name: string;
  description?: string;
}

export const AISettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    aiSettings,
    saveAISettings,
  } = useAI();
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [modelsList, setModelsList] = useState<DetailedModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isDynamicList, setIsDynamicList] = useState(false);
  const [isCustomModelInput, setIsCustomModelInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    if (aiSettings) {
      const activeProv =
        aiSettings.active_provider || aiSettings.provider || "gemini";
      setSelectedProvider(activeProv);
      setModel(
        aiSettings.active_model ||
          aiSettings.model ||
          (activeProv === "gemini" ? "gemini-2.5-flash" : "gpt-4o"),
      );
      const prov = aiSettings.providers?.[activeProv];
      if (prov) {
        setEndpoint(prov.custom_endpoint || "");
      }
    }
  }, [aiSettings, isSettingsModalOpen]);

  const fetchModelsForProvider = async (
    provId: string,
    customKey?: string,
    customEp?: string,
  ) => {
    setIsLoadingModels(true);
    try {
      const res = await API.getAIModels({
        provider: provId,
        api_key: customKey || apiKey || undefined,
        custom_endpoint: customEp || endpoint || undefined,
      });

      if (res.ok && res.data) {
        let items: DetailedModelItem[] = [];
        if (res.data.detailedModels && res.data.detailedModels.length > 0) {
          items = res.data.detailedModels;
        } else if (res.data.models && res.data.models.length > 0) {
          items = res.data.models.map((m: any) =>
            typeof m === "string" ? { id: m, name: m } : m,
          );
        }

        if (items.length > 0) {
          setModelsList(items);
          setIsDynamicList(Boolean(res.data.isDynamic));
          const exists = items.some((m) => m.id === model);
          if (!exists && items[0]) {
            setModel(items[0].id);
          }
          if (res.data.isDynamic) {
            setStatusMessage({
              text:
                res.data.message ||
                `Carregados ${items.length} modelos dinamicamente via API`,
              type: "success",
            });
          }
        }
      }
    } catch (err) {
      console.warn("[AISettingsModal] Erro ao buscar modelos:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    if (isSettingsModalOpen) {
      fetchModelsForProvider(selectedProvider);
    }
  }, [selectedProvider, isSettingsModalOpen]);

  // Transform modelsList to SelectOption array
  const selectOptions: SelectOption[] = useMemo(() => {
    if (modelsList.length === 0) {
      return [
        { value: model, label: model, description: "Modelo ativo selecionado" },
        {
          value: "gemini-2.5-flash",
          label: "Gemini 2.5 Flash",
          description: "Alta velocidade e capacidades multimodais",
          badge: "Flash",
          badgeType: "success",
        },
        {
          value: "gemini-2.5-pro",
          label: "Gemini 2.5 Pro",
          description: "Raciocínio complexo e codificação profunda",
          badge: "Pro",
          badgeType: "warning",
        },
        {
          value: "gemini-1.5-flash",
          label: "Gemini 1.5 Flash",
          description: "Modelo versátil",
          badge: "Flash",
          badgeType: "info",
        },
      ];
    }

    return modelsList.map((m) => {
      let badge: string | undefined;
      let badgeType:
        | "primary"
        | "success"
        | "warning"
        | "neutral"
        | "info" = "primary";

      if (m.id.includes("pro")) {
        badge = "Pro";
        badgeType = "warning";
      } else if (m.id.includes("flash")) {
        badge = "Flash";
        badgeType = "success";
      } else if (m.id.includes("reason") || m.id.includes("r1")) {
        badge = "Reasoner";
        badgeType = "info";
      }

      return {
        value: m.id,
        label: m.name !== m.id ? m.name : m.id,
        description: m.description || m.id,
        icon: "smart_toy",
        badge,
        badgeType,
      };
    });
  }, [modelsList, model]);

  if (!isSettingsModalOpen) return null;

  const currentProviderConfig =
    PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  const handleManualFetchModels = () => {
    setStatusMessage(null);
    fetchModelsForProvider(selectedProvider, apiKey, endpoint);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await saveAISettings(
      selectedProvider,
      model,
      apiKey || undefined,
      endpoint || undefined,
    );
    setIsSaving(false);
    if (success) {
      setStatusMessage({
        text: "Configurações de IA salvas com sucesso!",
        type: "success",
      });
      setTimeout(() => {
        closeSettingsModal();
      }, 700);
    } else {
      setStatusMessage({
        text: "Erro ao salvar configurações.",
        type: "error",
      });
    }
  };

  return (
    <Modal
      isOpen={isSettingsModalOpen}
      onClose={closeSettingsModal}
      size="lg"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Cpu size={20} style={{ color: "#10b981" }} />
          <span>Configurar Provedor de IA</span>
        </div>
      }
      subtitle="Escolha o provedor e modelo de LLM ativo no workspace"
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button variant="secondary" size="sm" onClick={closeSettingsModal}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
          >
            Salvar & Ativar
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Grade de Seleção de Provedor */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {PROVIDERS.map((p) => {
            const provState = aiSettings?.providers?.[p.id];
            const isConfigured = provState ? provState.configured : false;
            const isSelected = selectedProvider === p.id;

            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProvider(p.id);
                  if (p.id === "local" && !endpoint)
                    setEndpoint(p.defaultEndpoint || "");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: isSelected
                    ? "2px solid #10b981"
                    : "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                  background: isSelected
                    ? "rgba(16, 185, 129, 0.08)"
                    : "var(--md-sys-color-surface, #ffffff)",
                  cursor: "pointer",
                  transition: "all 0.16s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "13px",
                      color: isSelected ? "#059669" : "inherit",
                    }}
                  >
                    {p.name}
                  </strong>
                  <input
                    type="radio"
                    name="ai-provider-radio"
                    value={p.id}
                    checked={isSelected}
                    onChange={() => setSelectedProvider(p.id)}
                    style={{ accentColor: "#10b981" }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--md-sys-color-on-surface-variant, #5f6368)",
                    marginTop: 2,
                    display: "block",
                  }}
                >
                  {p.desc}
                </span>
                <div style={{ marginTop: 6 }}>
                  <Badge
                    variant={isConfigured ? "success" : "neutral"}
                    size="sm"
                    hasDot
                  >
                    {isConfigured ? "Configurado" : "Pendente"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modelo de IA */}
        <FormField
          label="Modelo de IA:"
          helperText={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 2,
              }}
            >
              <span>
                {isDynamicList
                  ? "Modelos carregados dinamicamente da API"
                  : "Lista padrão de modelos"}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={
                    <RefreshCw
                      size={12}
                      className={isLoadingModels ? "spinning" : ""}
                    />
                  }
                  onClick={handleManualFetchModels}
                  disabled={isLoadingModels}
                >
                  {isLoadingModels ? "Consultando..." : "Atualizar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Edit2 size={12} />}
                  onClick={() => setIsCustomModelInput(!isCustomModelInput)}
                >
                  {isCustomModelInput ? "Usar Lista" : "Digitar"}
                </Button>
              </div>
            </div>
          }
        >
          {isCustomModelInput ? (
            <Input
              id="ai-model-select"
              placeholder="Ex: gemini-2.5-flash, gpt-4o"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          ) : (
            <SelectDropdown
              id="ai-model-select"
              value={model}
              options={selectOptions}
              onChange={(val) => setModel(val)}
              placeholder="Selecione o modelo de IA..."
              searchable={selectOptions.length > 5}
              searchPlaceholder="Filtrar modelos..."
              leadingIcon="smart_toy"
            />
          )}
        </FormField>

        {currentProviderConfig.needsKey && (
          <FormField
            label="API Key do Provedor:"
            helperText="Necessária para consulta de modelos e assistente IA"
          >
            <Input
              id="ai-api-key"
              type="password"
              placeholder="Insira sua chave de API (opcional se definida no ambiente)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={() => {
                if (apiKey.trim()) {
                  fetchModelsForProvider(selectedProvider, apiKey, endpoint);
                }
              }}
            />
          </FormField>
        )}

        {currentProviderConfig.hasEndpoint && (
          <FormField label="Endpoint Customizado (Ollama / Local):">
            <Input
              id="ai-custom-endpoint"
              placeholder="http://localhost:11434/v1"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              onBlur={() =>
                fetchModelsForProvider(selectedProvider, apiKey, endpoint)
              }
            />
          </FormField>
        )}

        {statusMessage && (
          <AlertBanner
            type={statusMessage.type === "success" ? "success" : "error"}
            message={statusMessage.text}
            onClose={() => setStatusMessage(null)}
          />
        )}
      </div>
    </Modal>
  );
};

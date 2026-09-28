import React, { useState, useEffect } from "react";
import { Modal, Button, Badge } from "../ui";
import { 
  Compass, 
  FileText, 
  Sparkles, 
  SpellCheck, 
  BookOpen, 
  Layers, 
  History, 
  ArrowUpRight, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Navigation 
} from "lucide-react";

export interface OnboardingStep {
  id: string;
  tag: string;
  title: string;
  description: string;
  howToAccess: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  actionLabel?: string;
  onAction?: () => void;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateView: (
    view: "editor" | "dictionary" | "wiki" | "templates" | "prs" | "settings",
  ) => void;
  onToggleCopilot: () => void;
  onOpenGitModal: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onNavigateView,
  onToggleCopilot,
  onOpenGitModal,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: "docs",
      tag: "Módulo Central",
      title: "Edição rica de especificações e documentos com blocos vivos",
      description:
        "Crie e organize documentação técnica padronizada em Markdown com suporte a tabelas, diagramas Mermaid e alertas visuais.",
      howToAccess:
        "Menu lateral esquerdo → Documentos (ou selecione qualquer arquivo na árvore à esquerda).",
      icon: <FileText size={24} />,
      iconColor: "var(--color-primary)",
      iconBg: "var(--color-primary-container)",
      badgeVariant: "primary",
      actionLabel: "Ir para Documentos",
      onAction: () => {
        onNavigateView("editor");
        onClose();
      },
    },
    {
      id: "copilot",
      tag: "Inteligência Artificial",
      title:
        "Assistente contextual para gerar, analisar e refatorar especificações",
      description:
        "Converse com o modelo de IA diretamente sobre o documento ativo, valide requisitos de arquitetura e refine parágrafos selecionados.",
      howToAccess:
        "Botão Copilot IA no canto superior direito do header ou selecione um trecho no editor.",
      icon: <Sparkles size={24} />,
      iconColor: "#a855f7",
      iconBg: "rgba(168, 85, 247, 0.15)",
      badgeVariant: "purple",
      actionLabel: "Abrir Copilot IA",
      onAction: () => {
        onToggleCopilot();
        onClose();
      },
    },
    {
      id: "dictionary",
      tag: "Vocabulário Oficial",
      title: "Dicionário Ubíquo para padronizar conceitos e regras de negócio",
      description:
        "Mantenha termos e regras canônicas alinhadas para que os desenvolvedores e os agentes de IA usem sempre a mesma terminologia.",
      howToAccess: "Menu lateral esquerdo → Dicionário.",
      icon: <SpellCheck size={24} />,
      iconColor: "var(--color-info)",
      iconBg: "rgba(14, 165, 233, 0.15)",
      badgeVariant: "info",
      actionLabel: "Ir para Dicionário",
      onAction: () => {
        onNavigateView("dictionary");
        onClose();
      },
    },
    {
      id: "wiki",
      tag: "Base de Conhecimento",
      title: "Wiki viva de decisões e arquitetura no padrão Karpathy LLM-Wiki",
      description:
        "Armazene decisões técnicas, referências arquiteturais e notas consultáveis por humanos e agentes inteligentes.",
      howToAccess: "Menu lateral esquerdo → Wiki IA.",
      icon: <BookOpen size={24} />,
      iconColor: "var(--color-success)",
      iconBg: "rgba(16, 185, 129, 0.15)",
      badgeVariant: "success",
      actionLabel: "Ir para Wiki IA",
      onAction: () => {
        onNavigateView("wiki");
        onClose();
      },
    },
    {
      id: "templates",
      tag: "Modelos Prontos",
      title: "Catálogo de templates para criar RFCs, ADRs e PRDs em segundos",
      description:
        "Modelos estruturados para decisões de arquitetura, requisitos de produto e histórias de usuário com assistentes dedicados.",
      howToAccess:
        'Menu lateral esquerdo → Templates (ou botão "+" na árvore de arquivos).',
      icon: <Layers size={24} />,
      iconColor: "var(--color-warning)",
      iconBg: "rgba(245, 158, 11, 0.15)",
      badgeVariant: "warning",
      actionLabel: "Ir para Templates",
      onAction: () => {
        onNavigateView("templates");
        onClose();
      },
    },
    {
      id: "git",
      tag: "Evolução & Versões",
      title:
        "Controle de versões com auditoria de alterações e revisão visual de mudanças",
      description:
        "Acompanhe o histórico de marcos, alterne entre trilhas de trabalho e audite todas as alterações antes de publicar.",
      howToAccess:
        "Botão Versões no header superior ou menu lateral → Revisões",
      icon: <History size={24} />,
      iconColor: "#ec4899",
      iconBg: "rgba(236, 72, 153, 0.15)",
      badgeVariant: "purple",
      actionLabel: "Abrir Central de Versões",
      onAction: () => {
        onOpenGitModal();
        onClose();
      },
    },
  ];

  const totalSteps = steps.length;
  const activeStep = steps[currentStep];

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (currentStep < totalSteps - 1) {
          setCurrentStep((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep, totalSteps, onClose]);

  if (!isOpen) return null;

  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guia Rápido & Funcionalidades"
      icon={<Compass size={18} />}
      size="md"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {/* Step Indicator Dots */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {steps.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Ir para card ${index + 1}`}
                onClick={() => setCurrentStep(index)}
                style={{
                  width: index === currentStep ? "20px" : "7px",
                  height: "7px",
                  borderRadius: "4px",
                  background:
                    index === currentStep
                      ? activeStep.iconColor
                      : "var(--color-outline-variant)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>

          {/* Action & Nav Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {activeStep.onAction && (
              <Button
                variant="secondary"
                size="sm"
                onClick={activeStep.onAction}
                icon={<ArrowUpRight size={14} />}
              >
                {activeStep.actionLabel}
              </Button>
            )}

            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                icon={<ChevronLeft size={14} />}
              >
                Anterior
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              icon={currentStep === totalSteps - 1 ? <Check size={14} /> : <ChevronRight size={14} />}
            >
              {currentStep === totalSteps - 1 ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            background: "var(--color-surface-container-highest)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercentage}%`,
              background: `linear-gradient(90deg, ${activeStep.iconColor}, var(--color-primary))`,
              transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        {/* Card Top: Icon & Category Tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-md, 12px)",
              background: activeStep.iconBg,
              color: activeStep.iconColor,
            }}
          >
            {activeStep.icon}
          </div>

          <Badge variant={activeStep.badgeVariant || "primary"} size="md">
            {activeStep.tag}
          </Badge>
        </div>

        {/* Card Headline & Description */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
              lineHeight: 1.4,
              color: "var(--color-on-surface)",
            }}
          >
            {activeStep.title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "13.5px",
              lineHeight: 1.55,
              color: "var(--color-on-surface-variant)",
            }}
          >
            {activeStep.description}
          </p>
        </div>

        {/* Callout: Como acessar */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "var(--radius-md, 8px)",
            background: "var(--color-surface-container-high)",
            border: "1px solid var(--color-outline-variant)",
          }}
        >
          <Navigation
            size={16}
            style={{
              color: activeStep.iconColor,
              marginTop: "2px",
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--color-outline)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Como acessar:
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-on-surface)",
                lineHeight: 1.4,
              }}
            >
              {activeStep.howToAccess}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

import React, { useState, useEffect } from "react";

export interface OnboardingStep {
  id: string;
  tag: string;
  title: string;
  description: string;
  howToAccess: string;
  icon: string;
  iconColor: string;
  iconBg: string;
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
      icon: "description",
      iconColor: "#3b82f6",
      iconBg: "rgba(59, 130, 246, 0.15)",
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
      icon: "auto_awesome",
      iconColor: "#a855f7",
      iconBg: "rgba(168, 85, 247, 0.15)",
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
      icon: "spellcheck",
      iconColor: "#0ea5e9",
      iconBg: "rgba(14, 165, 233, 0.15)",
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
      icon: "menu_book",
      iconColor: "#10b981",
      iconBg: "rgba(16, 185, 129, 0.15)",
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
      icon: "auto_stories",
      iconColor: "#f59e0b",
      iconBg: "rgba(245, 158, 11, 0.15)",
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
      icon: "history_edu",
      iconColor: "#ec4899",
      iconBg: "rgba(236, 72, 153, 0.15)",
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
    <div
      id="modal-onboarding-guide"
      className="modal-backdrop"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-box onboarding-modal-box"
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "var(--bg-surface, #1e293b)",
          border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
          borderRadius: "16px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Top Mini Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            background: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercentage}%`,
              background: `linear-gradient(90deg, ${activeStep.iconColor}, #38bdf8)`,
              transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom:
              "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "20px", color: "var(--primary, #3b82f6)" }}
            >
              explore
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-heading, #f8fafc)",
              }}
            >
              Guia Rápido & Funcionalidades
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 600,
                color: "var(--text-dim, #94a3b8)",
                background: "rgba(255, 255, 255, 0.06)",
                padding: "3px 8px",
                borderRadius: "10px",
              }}
            >
              {currentStep + 1} de {totalSteps}
            </span>
            <button
              className="btn-close"
              aria-label="Fechar Guia"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-dim, #94a3b8)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                padding: "4px",
                borderRadius: "6px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "18px" }}
              >
                close
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body / Active Card Content */}
        <div
          className="modal-body"
          style={{
            padding: "24px 24px 20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
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
                width: "46px",
                height: "46px",
                borderRadius: "12px",
                background: activeStep.iconBg,
                color: activeStep.iconColor,
                boxShadow: `0 4px 14px ${activeStep.iconBg}`,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "26px" }}
              >
                {activeStep.icon}
              </span>
            </div>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: activeStep.iconColor,
                background: activeStep.iconBg,
                padding: "4px 10px",
                borderRadius: "20px",
                border: `1px solid ${activeStep.iconColor}33`,
              }}
            >
              {activeStep.tag}
            </span>
          </div>

          {/* Card Headline & Description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 700,
                lineHeight: 1.35,
                color: "var(--text-heading, #f8fafc)",
              }}
            >
              {activeStep.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                lineHeight: 1.5,
                color: "var(--text-normal, #cbd5e1)",
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
              borderRadius: "10px",
              background: "var(--bg-card-header, rgba(255, 255, 255, 0.04))",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "18px",
                color: activeStep.iconColor,
                marginTop: "2px",
                flexShrink: 0,
              }}
            >
              near_me
            </span>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--text-dim, #94a3b8)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Como acessar:
              </span>
              <span
                style={{
                  fontSize: "12.5px",
                  fontWeight: 500,
                  color: "var(--text-heading, #f1f5f9)",
                  lineHeight: 1.4,
                }}
              >
                {activeStep.howToAccess}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 22px 18px 22px",
            borderTop:
              "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
            background: "var(--bg-surface-dim, rgba(0, 0, 0, 0.1))",
          }}
        >
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
                      : "rgba(255, 255, 255, 0.2)",
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
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={activeStep.onAction}
                style={{
                  fontSize: "12px",
                  padding: "5px 11px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>{activeStep.actionLabel}</span>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "14px" }}
                >
                  arrow_outward
                </span>
              </button>
            )}

            {currentStep > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handlePrev}
                style={{ fontSize: "12px", padding: "5px 10px" }}
              >
                Anterior
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleNext}
              style={{
                fontSize: "12px",
                padding: "5px 14px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background:
                  currentStep === totalSteps - 1
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : undefined,
              }}
            >
              <span>
                {currentStep === totalSteps - 1 ? "Concluir" : "Próximo"}
              </span>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "15px" }}
              >
                {currentStep === totalSteps - 1 ? "check" : "chevron_right"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

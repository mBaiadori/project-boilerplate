// =============================================================================
// COMPONENT: INTERACTIVE ONBOARDING WIZARD (STEP-BY-STEP PLATFORM TOUR)
// =============================================================================

export function initOnboardingModal({ onStartExploring } = {}) {
  const modal = document.getElementById("onboarding-modal");
  const btnClose = document.getElementById("btn-close-onboarding");
  const btnSkip = document.getElementById("btn-skip-onboarding");
  const btnPrev = document.getElementById("btn-prev-onboarding");
  const btnNext = document.getElementById("btn-next-onboarding");
  const slidesContainer = document.getElementById(
    "onboarding-slides-container",
  );
  const dotsContainer = document.getElementById("onboarding-dots-container");
  const currentStepText = document.getElementById("onboarding-step-counter");

  const slides = [
    {
      badge: "Fundação",
      icon: "account_balance",
      title: "Bem-vindo ao Context OS: Constituição do Projeto",
      description:
        "Cada repositório é governado por um documento mestre (<code>index.md</code>) baseado em uma sólida <strong>Visão Estratégica</strong> (Propósito, Proposta de Valor, Stakeholders, Escopo, Cronograma, Método e Custos).",
      bullets: [
        "<strong>Visão Centralizada:</strong> Apresentação clara do produto e valor estratégico sem poluição de arquivos.",
        "<strong>Arquiteto Guardião (IA):</strong> O assistente ao lado ajuda você a preencher as Definições Estratégicas e o Dicionário Ubíquo.",
        "<strong>Governança Viva:</strong> O mapa de domínios e contratos é atualizado automaticamente conforme o projeto evolui.",
      ],
      tipIcon: "lightbulb",
      tipText:
        "Dica: Você está na view <strong>Projeto</strong>. Ela é a porta de entrada e documento de apresentação do seu software!",
    },
    {
      badge: "Bounded Contexts (DDD)",
      icon: "category",
      title: "Domínios de Negócio & Features L1 a L4",
      description:
        "No menu <strong>Documentos</strong>, você navega na estrutura limpa da pasta <code>domains/</code>, organizada em camadas arquiteturais.",
      bullets: [
        "<strong>L2 (Domínios Centrais):</strong> Bounded contexts principais (ex: <code>domains/faturamento/</code>).",
        "<strong>L3 (Subdomínios / Áreas):</strong> Especializações funcionais (ex: <code>domains/faturamento/pix/</code>).",
        "<strong>L4 (Features & Esteiras):</strong> Esteiras completas com 8 documentos s (Ideação, KPIs, Regras, BDD Gherkin, etc.).",
      ],
      tipIcon: "lightbulb",
      tipText:
        "Dica: Use o botão <strong>+ Nova Feature</strong> na barra superior para criar uma esteira completa em 1 clique.",
    },
    {
      badge: "Arquitetura & ADRs",
      icon: "engineering",
      title: "Engenharia, Decisões Técnicas & Contratos",
      description:
        "A view <strong>Engenharia</strong> substitui pastas desorganizadas por um catálogo formal da pasta <code>engenharia/</code>.",
      bullets: [
        "<strong>Architecture Decision Records (ADRs):</strong> Registre decisões imutáveis (ex: Transactional Outbox, Kafka, Autenticação JWT).",
        "<strong>Contratos de Mensageria & APIs:</strong> Padrões de payload e integração entre microsserviços.",
        "<strong>Gerador de ADR com IA:</strong> Descreva o problema e deixe a IA formular o padrão arquitetural em segundos.",
      ],
      tipIcon: "lightbulb",
      tipText:
        "Dica: ADRs garantem que decisões técnicas sejam rastreáveis e compreensíveis por novos desenvolvedores.",
    },
    {
      badge: "Template Store",
      icon: "storefront",
      title: "Template Store & Catálogo ",
      description:
        "Acelere o desenvolvimento utilizando modelos pré-validados da comunidade e da sua organização.",
      bullets: [
        "<strong>Packs 1-Click:</strong> Instale templates de Checkout, Mensageria, KYC, Autenticação e APIs.",
        "<strong>Assistentes Especialistas:</strong> Cada template inclui um prompt de IA customizado para guiar o preenchimento.",
        "<strong>Criador de Templates:</strong> Crie novos templates personalizados com o gerador de meta-prompts.",
      ],
      tipIcon: "lightbulb",
      tipText:
        "Dica: Templates instalados ficam na pasta <code>templates/</code> do seu repositório Git.",
    },
    {
      badge: "Governança & Git",
      icon: "shield",
      title: "Edição Ágil no Workspace & Pull Requests Seguros",
      description:
        "Trabalhe com total liberdade e controle de qualidade contínuo.",
      bullets: [
        "<strong>Modo Ágil:</strong> Edite e salve múltiplos documentos no workspace sem criar dezenas de commits isolados.",
        "<strong>Central de Diffs & PR:</strong> Revise alterações pendentes com guardrails de risco e abra um Pull Request único para a branch <code>main</code>.",
        "<strong>Auditoria de Qualidade:</strong> O verificador automático identifica links quebrados, metadados órfãos e feedback loops pendentes.",
      ],
      tipIcon: "verified",
      tipText:
        "Tudo pronto! Clique em <strong>Começar a Explorar</strong> para iniciar a jornada com o Context OS.",
    },
  ];

  let currentStep = 0;
  let activeRepoName = "";

  function renderStep(idx) {
    currentStep = Math.max(0, Math.min(idx, slides.length - 1));
    const s = slides[currentStep];

    if (currentStepText) {
      currentStepText.textContent = `Etapa ${currentStep + 1} de ${slides.length}`;
    }

    if (slidesContainer) {
      slidesContainer.innerHTML = `
        <div class="onboarding-slide" style="display: flex; flex-direction: column; gap: 14px; animation: fadeIn 0.2s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="pill-dot info" style="font-weight: 700; font-size: 12px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
              <span class="material-symbols-outlined icon-xs">${s.icon}</span> ${s.badge}
            </span>
          </div>

          <h3 style="font-size: 18.5px; margin: 0; color: var(--text-normal); font-family: var(--font-display, var(--font-main)); font-weight: 700;">${s.title}</h3>
          <p style="font-size: 13.5px; line-height: 1.5; color: var(--text-muted); margin: 0;">${s.description}</p>

          <div style="background: var(--bg-surface, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 14px 16px;">
            <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 9px; font-size: 12.5px; color: var(--text-normal);">
              ${s.bullets.map((b) => `<li style="line-height: 1.45;">${b}</li>`).join("")}
            </ul>
          </div>

          <div class="onboarding-tip-box" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-left: 3.5px solid var(--primary, #3b82f6); border-radius: 8px; padding: 11px 15px; display: flex; align-items: flex-start; gap: 10px; box-sizing: border-box;">
            <span class="material-symbols-outlined" style="font-size: 18px; line-height: 1.4; color: var(--primary, #2563eb); flex-shrink: 0;">${s.tipIcon || "lightbulb"}</span>
            <div style="font-size: 12.5px; line-height: 1.5; color: #1e3a8a; flex: 1; margin: 0;">${s.tipText || s.tip}</div>
          </div>
        </div>
      `;
    }

    // Render Dots
    if (dotsContainer) {
      dotsContainer.innerHTML = slides
        .map(
          (_, i) => `
        <button class="onboarding-dot ${i === currentStep ? "active" : ""}" data-step="${i}" title="Ir para etapa ${i + 1}" style="width: ${i === currentStep ? "22px" : "8px"}; height: 8px; border-radius: 4px; border: none; background: ${i === currentStep ? "var(--primary, #0052cc)" : "#cbd5e1"}; cursor: pointer; transition: all 0.2s ease;"></button>
      `,
        )
        .join("");

      dotsContainer.querySelectorAll(".onboarding-dot").forEach((dot) => {
        dot.addEventListener("click", () => {
          renderStep(parseInt(dot.dataset.step, 10));
        });
      });
    }

    // Navigation buttons state
    if (btnPrev) {
      btnPrev.style.display = currentStep > 0 ? "inline-flex" : "none";
    }

    if (btnNext) {
      if (currentStep === slides.length - 1) {
        btnNext.innerHTML =
          '<span class="material-symbols-outlined icon-xs">rocket_launch</span> Começar a Explorar';
        btnNext.className = "btn btn-primary btn-sm";
      } else {
        btnNext.textContent = "Próximo ›";
        btnNext.className = "btn btn-primary btn-sm";
      }
    }
  }

  function open(repoName = "", force = false) {
    activeRepoName = repoName;
    const seenKey = `onboarding_seen_${repoName}`;
    if (!force && repoName && localStorage.getItem(seenKey)) {
      return; // Already seen for this repo
    }
    currentStep = 0;
    renderStep(0);
    if (modal) modal.style.display = "flex";
  }

  function close() {
    if (activeRepoName) {
      localStorage.setItem(`onboarding_seen_${activeRepoName}`, "true");
    }
    if (modal) modal.style.display = "none";
    if (onStartExploring) onStartExploring();
  }

  if (btnClose) btnClose.addEventListener("click", close);
  if (btnSkip) btnSkip.addEventListener("click", close);

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      renderStep(currentStep - 1);
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      if (currentStep < slides.length - 1) {
        renderStep(currentStep + 1);
      } else {
        close();
      }
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (modal && modal.style.display === "flex") {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && currentStep < slides.length - 1)
        renderStep(currentStep + 1);
      else if (e.key === "ArrowLeft" && currentStep > 0)
        renderStep(currentStep - 1);
    }
  });

  return {
    open,
    close,
  };
}

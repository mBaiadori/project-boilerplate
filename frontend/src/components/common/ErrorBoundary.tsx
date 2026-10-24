import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Erro capturado na árvore de componentes:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || "Ocorreu um erro inesperado na interface.";
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || "";

      return (
        <div
          id="app-error-boundary-fallback"
          style={{
            minHeight: "100vh",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--md-sys-color-surface-container-low, var(--color-surface, #f8f9fa))",
            color: "var(--md-sys-color-on-surface, var(--color-text-primary, #202124))",
            padding: "24px",
            boxSizing: "border-box",
            fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          }}
        >
          <div
            style={{
              maxWidth: "580px",
              width: "100%",
              backgroundColor: "var(--md-sys-color-surface, #ffffff)",
              borderRadius: "16px",
              border: "1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.12))",
              boxShadow: "var(--md-sys-elevation-3, 0 4px 12px rgba(0, 0, 0, 0.12))",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "var(--md-sys-color-error-container, #fce8e6)",
                  color: "var(--md-sys-color-error, #d93025)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid rgba(217, 48, 37, 0.18)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                  error_outline
                </span>
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--md-sys-color-on-surface, #202124)",
                  }}
                >
                  Algo deu errado nesta tela
                </h2>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13.5px",
                    color: "var(--md-sys-color-on-surface-variant, #5f6368)",
                  }}
                >
                  A aplicação encontrou uma falha de renderização e evitou que a tela ficasse em branco.
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "var(--md-sys-color-error-container, #fce8e6)",
                border: "1px solid rgba(217, 48, 37, 0.3)",
                borderLeft: "4px solid var(--md-sys-color-error, #d93025)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--md-sys-color-on-error-container, #c5221f)",
                fontFamily: "var(--font-family-mono, monospace)",
                wordBreak: "break-word",
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </div>

            {errorStack && (
              <details style={{ fontSize: "12.5px", color: "var(--md-sys-color-on-surface-variant, #5f6368)" }}>
                <summary style={{ cursor: "pointer", userSelect: "none", outline: "none", marginBottom: "8px", fontWeight: 500 }}>
                  Ver detalhes técnicos do erro
                </summary>
                <pre
                  style={{
                    margin: 0,
                    maxHeight: "160px",
                    overflowY: "auto",
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "var(--md-sys-color-surface-container-high, #e8eaed)",
                    color: "var(--md-sys-color-on-surface, #202124)",
                    border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                    fontSize: "11.5px",
                    lineHeight: 1.45,
                    fontFamily: "var(--font-family-mono, monospace)",
                  }}
                >
                  {errorStack}
                </pre>
              </details>
            )}

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                marginTop: "4px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  backgroundColor: "transparent",
                  color: "var(--md-sys-color-on-surface, #202124)",
                  border: "1px solid var(--md-sys-color-outline, #747775)",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Tentar Novamente
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  backgroundColor: "var(--md-sys-color-secondary-container, #e8eaed)",
                  color: "var(--md-sys-color-on-secondary-container, #202124)",
                  border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                  cursor: "pointer",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.85";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                Recarregar Página
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  backgroundColor: "var(--md-sys-color-primary, #1a73e8)",
                  color: "var(--md-sys-color-on-primary, #ffffff)",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "var(--md-sys-elevation-1, 0 1px 3px rgba(0, 0, 0, 0.12))",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

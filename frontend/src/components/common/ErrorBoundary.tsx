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
            backgroundColor: "var(--md-sys-color-surface, var(--color-surface, #0f172a))",
            color: "var(--md-sys-color-on-surface, var(--color-text-primary, #f8fafc))",
            padding: "24px",
            boxSizing: "border-box",
            fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          }}
        >
          <div
            style={{
              maxWidth: "560px",
              width: "100%",
              backgroundColor: "var(--md-sys-color-surface-container, var(--color-surface-container, #1e293b))",
              borderRadius: "16px",
              border: "1px solid var(--md-sys-color-outline-variant, var(--color-border-subtle, rgba(255, 255, 255, 0.1)))",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
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
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "var(--color-danger, #ef4444)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
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
                    color: "var(--md-sys-color-on-surface, var(--color-text-primary, #f8fafc))",
                  }}
                >
                  Algo deu errado nesta tela
                </h2>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13.5px",
                    color: "var(--md-sys-color-on-surface-variant, var(--color-text-secondary, #94a3b8))",
                  }}
                >
                  A aplicação encontrou uma falha de renderização e evitou que a tela ficasse em branco.
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "13px",
                color: "var(--color-danger-light, #fca5a5)",
                fontFamily: "var(--font-family-mono, monospace)",
                wordBreak: "break-word",
              }}
            >
              {errorMessage}
            </div>

            {errorStack && (
              <details style={{ fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
                <summary style={{ cursor: "pointer", userSelect: "none", outline: "none", marginBottom: "8px" }}>
                  Ver detalhes técnicos do erro
                </summary>
                <pre
                  style={{
                    margin: 0,
                    maxHeight: "160px",
                    overflowY: "auto",
                    padding: "10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    color: "#cbd5e1",
                    fontSize: "11px",
                    lineHeight: 1.4,
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
                  color: "var(--color-text-secondary, #cbd5e1)",
                  border: "1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.15))",
                  cursor: "pointer",
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
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
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
                  backgroundColor: "var(--color-primary, #2563eb)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
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

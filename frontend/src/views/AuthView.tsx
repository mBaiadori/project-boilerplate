import { ExternalLink, Monitor, Sparkles, User, Trash2, LogIn, Plus } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardContent,
  FormField,
  IconButton,
  Input,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { t } = useTranslation(["auth", "common", "repos"]);
  const { loginWithToken, loginLocal, accounts, switchAccount, removeAccount } = useAuth();
  const [token, setToken] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(accounts.length === 0);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "error" | "info" | "success";
  } | null>(null);

  const currentProviderName = "GitHub";

  const handleSelectAccount = async (accountId: string) => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await switchAccount(accountId);
      if (res.success) {
        onLoginSuccess();
      } else {
        setStatusMessage({
          text: res.error || t("auth:statusDefaultError"),
          type: "error",
        });
      }
    } catch {
      setStatusMessage({ text: t("auth:statusServerError"), type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatusMessage({
        text: t("auth:statusPromptToken", { provider: currentProviderName }),
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage({
      text: t("auth:statusConnecting", { provider: currentProviderName }),
      type: "info",
    });

    try {
      const result = await loginWithToken(token.trim());
      if (result.success) {
        setStatusMessage({ text: t("auth:statusSuccess"), type: "success" });
        onLoginSuccess();
      } else {
        setStatusMessage({
          text: result.error || t("auth:statusDefaultError"),
          type: "error",
        });
      }
    } catch {
      setStatusMessage({ text: t("auth:statusServerError"), type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalModeLogin = async () => {
    setIsLoading(true);
    setStatusMessage({ text: t("auth:statusStartingLocal"), type: "info" });
    try {
      await loginLocal();
      onLoginSuccess();
    } catch {
      setStatusMessage({ text: t("auth:statusLocalError"), type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="view-auth"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        width: "100%",
        padding: "24px 16px",
        boxSizing: "border-box",
        background:
          "radial-gradient(ellipse at top, var(--color-surface-container-high) 0%, var(--color-surface) 75%)",
        position: "relative",
        overflowY: "auto",
      }}
    >
      {/* Top right language switcher */}
      <div
        style={{ position: "absolute", top: "16px", right: "20px", zIndex: 10 }}
      >
        <LanguageSwitcher />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Header Hero Branding */}
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "16px",
              background: "var(--color-primary-container)",
              color: "var(--color-primary)",
              fontSize: "11.5px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              border:
                "1px solid rgba(var(--color-primary-rgb, 59, 130, 246), 0.2)",
            }}
          >
            <Sparkles size={13} />
            <span>{t("auth:badge")}</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 800,
              color: "var(--color-on-surface)",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
            }}
          >
            {t("auth:heroTitle")}
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "500px",
              fontSize: "13px",
              color: "var(--color-on-surface-variant)",
              lineHeight: 1.45,
            }}
          >
            {t("auth:heroSubtitle")}
          </p>
        </div>

        {/* Main Auth Card */}
        <Card
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <CardContent
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            {/* Status Alert if any */}
            {statusMessage && (
              <AlertBanner
                variant={statusMessage.type}
                title={statusMessage.text}
                onClose={() => setStatusMessage(null)}
              />
            )}

            {/* Section: Saved Accounts (if any) */}
            {accounts.length > 0 && !showTokenForm && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--color-on-surface)",
                    }}
                  >
                    {t("auth:savedAccountsTitle", "Contas Salvas")}
                  </h2>
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: "12px",
                      color: "var(--color-on-surface-variant)",
                    }}
                  >
                    {t("auth:savedAccountsSubtitle", "Selecione uma conta para entrar rapidamente:")}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "260px",
                    overflowY: "auto",
                    paddingRight: "2px",
                  }}
                >
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        backgroundColor: "var(--color-surface-container-low, #f8f9fa)",
                        border: "1px solid var(--color-outline-variant, #dadce0)",
                        borderRadius: "var(--radius-md, 8px)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {acc.user?.avatar_url ? (
                          <img
                            src={acc.user.avatar_url}
                            alt={acc.user.login}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "1.5px solid var(--color-primary-container, #d2e3fc)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: "var(--color-primary-container, #d2e3fc)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--color-primary, #1a73e8)",
                            }}
                          >
                            <User size={18} />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13.5px",
                              fontWeight: 600,
                              color: "var(--color-on-surface, #202124)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {acc.user?.name || acc.user?.login}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--color-on-surface-variant, #5f6368)",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span>@{acc.user?.login}</span>
                            <Badge variant="subtle" size="sm">
                              {acc.git_provider === "local" ? "Modo Local" : "GitHub"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleSelectAccount(acc.id)}
                          leftIcon={<LogIn size={14} />}
                        >
                          {t("auth:signInAs", "Entrar")}
                        </Button>

                        <IconButton
                          size="sm"
                          tooltip={t("auth:removeAccountTooltip", "Remover conta salva")}
                          onClick={async () => {
                            await removeAccount(acc.id);
                          }}
                        >
                          <Trash2 size={15} style={{ color: "var(--color-error, #d93025)" }} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: "6px 0 2px",
                  }}
                >
                  <div style={{ flex: 1, height: "1px", background: "var(--color-outline-variant)" }} />
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--color-outline)",
                      textTransform: "uppercase",
                    }}
                  >
                    {t("common:or")}
                  </span>
                  <div style={{ flex: 1, height: "1px", background: "var(--color-outline-variant)" }} />
                </div>

                <Button
                  variant="subtle"
                  size="sm"
                  fullWidth
                  type="button"
                  onClick={() => setShowTokenForm(true)}
                  icon={<Plus size={14} />}
                >
                  {t("auth:addNewAccount", "Adicionar nova conta / token")}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  type="button"
                  onClick={handleLocalModeLogin}
                  disabled={isLoading}
                  icon={<Monitor size={14} />}
                >
                  {t("auth:localModeButton")}
                </Button>
              </div>
            )}

            {/* Section: Token Form (when no accounts saved or clicked Add Account) */}
            {(accounts.length === 0 || showTokenForm) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--color-on-surface)",
                      }}
                    >
                      {t("auth:accessTitle")}
                    </h2>
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        fontSize: "12px",
                        color: "var(--color-on-surface-variant)",
                      }}
                    >
                      {t("auth:accessSubtitle")}
                    </p>
                  </div>

                  {accounts.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTokenForm(false)}
                    >
                      {t("auth:savedAccountsTitle", "Ver Salvas")}
                    </Button>
                  )}
                </div>

                <a
                  id="btn-open-github-token"
                  href="https://github.com/settings/tokens/new?scopes=repo,read:org,user&description=Context+OS"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "var(--radius-md, 6px)",
                    background: "var(--color-surface-container-high)",
                    color: "var(--color-on-surface)",
                    fontWeight: 600,
                    fontSize: "12px",
                    textDecoration: "none",
                    border: "1px solid var(--color-outline-variant)",
                  }}
                >
                  <span>{t("auth:generateTokenGithub")}</span>
                  <ExternalLink size={13} />
                </a>

                <form
                  onSubmit={handleTokenLogin}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <FormField
                    label={t("auth:tokenLabel", {
                      provider: currentProviderName,
                    })}
                    helperText={t("auth:tokenHelperGithub")}
                  >
                    <Input
                      type="password"
                      id="pat-token-input"
                      placeholder={t("auth:tokenPlaceholderGithub")}
                      autoComplete="off"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                  </FormField>

                  <Button
                    id="btn-token-login"
                    variant="primary"
                    size="md"
                    fullWidth
                    type="submit"
                    loading={isLoading}
                  >
                    {t("auth:connectButton", { provider: currentProviderName })}
                  </Button>
                </form>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: "2px 0",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      background: "var(--color-outline-variant)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--color-outline)",
                      textTransform: "uppercase",
                    }}
                  >
                    {t("common:or")}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      background: "var(--color-outline-variant)",
                    }}
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  type="button"
                  onClick={handleLocalModeLogin}
                  disabled={isLoading}
                  icon={<Monitor size={14} />}
                >
                  {t("auth:localModeButton")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


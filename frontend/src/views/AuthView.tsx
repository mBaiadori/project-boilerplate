import { 
  Building2, 
  ExternalLink, 
  Monitor, 
  Sparkles, 
  User as UserIcon, 
  Trash2, 
  LogIn, 
  Copy, 
  Check, 
  Loader2, 
  ArrowRight, 
  KeyRound,
  ShieldCheck
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";
import {
  AlertBanner,
  Button,
  Card,
  CardContent,
  FormField,
  IconButton,
  Input,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { API } from "../services/api";
import type { User } from "../types";

interface AuthViewProps {
  onLoginSuccess: () => void;
}

type AuthMode = "initial" | "device_pairing" | "org_onboarding" | "manual_token";

interface DeviceCodeData {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { t } = useTranslation(["auth", "common", "repos"]);
  const { 
    loginWithToken, 
    loginLocal, 
    accounts, 
    switchAccount, 
    removeAccount, 
    refreshAuth 
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("initial");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "error" | "info" | "success";
  } | null>(null);

  // Device Flow State (RFC 8628)
  const [deviceData, setDeviceData] = useState<DeviceCodeData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string>("");
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Onboarding da Organização
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [orgName, setOrgName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgWebFlowUrl, setOrgWebFlowUrl] = useState<string | null>(null);

  // Manual Token Fallback (Opção Avançada Oculta por Padrão)
  const [manualToken, setManualToken] = useState("");

  // Limpeza de timers de polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  /**
   * Dispara o Device Authorization Grant (RFC 8628)
   */
  const handleStartDeviceFlow = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    setCopiedCode(false);

    try {
      const res = await API.requestDeviceCode();
      if (!res.ok || !res.data.success || !res.data.device_code) {
        setStatusMessage({
          text: res.data?.error || t("auth:statusServerError"),
          type: "error",
        });
        setIsLoading(false);
        return;
      }

      const data: DeviceCodeData = {
        device_code: res.data.device_code,
        user_code: res.data.user_code || "",
        verification_uri: res.data.verification_uri || "https://github.com/login/device",
        expires_in: res.data.expires_in || 900,
        interval: res.data.interval || 5,
      };

      setDeviceData(data);
      setMode("device_pairing");
      setPollingStatus(t("auth:waitingAuthorization", "Aguardando confirmação no navegador..."));

      // Tenta copiar código para clipboard imediatamente
      if (data.user_code) {
        try {
          await navigator.clipboard.writeText(data.user_code);
          setCopiedCode(true);
        } catch {}
      }

      // Inicia polling com o intervalo fornecido pelo provedor
      startPolling(data.device_code, data.interval);
    } catch (err: any) {
      setStatusMessage({
        text: err.message || t("auth:statusServerError"),
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Executa o Polling silencioso da RFC 8628
   */
  const startPolling = (deviceCode: string, initialInterval: number) => {
    stopPolling();
    let currentInterval = Math.max(initialInterval || 5, 5) * 1000;

    const poll = async () => {
      try {
        const res = await API.pollDeviceToken(deviceCode);
        if (!res.ok) return;

        const data = res.data;

        if (data.status === "pending") {
          setPollingStatus(t("auth:waitingAuthorization", "Aguardando confirmação no navegador..."));
        } else if (data.status === "slow_down") {
          stopPolling();
          currentInterval = ((data.interval || 10) + 2) * 1000;
          pollTimerRef.current = setInterval(poll, currentInterval);
        } else if (data.status === "expired") {
          stopPolling();
          setStatusMessage({
            text: data.error || "O código expirou. Por favor, inicie novamente.",
            type: "error",
          });
          setMode("initial");
        } else if (data.status === "denied") {
          stopPolling();
          setStatusMessage({
            text: data.error || "Autorização cancelada.",
            type: "error",
          });
          setMode("initial");
        } else if (data.status === "success") {
          stopPolling();
          await refreshAuth();

          const orgs = Array.isArray(data.orgs) ? data.orgs : [];
          if (orgs.length > 0) {
            // Usuário já pertence a uma organização da empresa -> vai direto para projetos!
            setStatusMessage({ text: t("auth:statusSuccess"), type: "success" });
            onLoginSuccess();
          } else {
            // Primeiro acesso da empresa / sem organizações -> Onboarding de Organização!
            setCreatedUser(data.user || null);
            setMode("org_onboarding");
          }
        }
      } catch (err) {
        console.error("[DeviceFlow] Erro no polling:", err);
      }
    };

    // Primeiro disparo após o intervalo inicial
    pollTimerRef.current = setInterval(poll, currentInterval);
  };

  /**
   * Copia o código e abre o navegador
   */
  const handleCopyAndOpenBrowser = async () => {
    if (!deviceData) return;
    try {
      await navigator.clipboard.writeText(deviceData.user_code);
      setCopiedCode(true);
    } catch {}
    window.open(deviceData.verification_uri, "_blank", "noopener,noreferrer");
  };

  /**
   * Criação simplificada da Organização no onboarding
   */
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = orgName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!cleanName) return;

    setIsCreatingOrg(true);
    setStatusMessage(null);
    setOrgWebFlowUrl(null);

    try {
      const res = await API.createOrg({
        username: cleanName,
        full_name: orgName.trim(),
      });

      if (res.ok) {
        if (res.data?.requires_web_flow && res.data.web_url) {
          setOrgWebFlowUrl(res.data.web_url);
        } else if (res.data?.success) {
          await refreshAuth();
          onLoginSuccess();
        } else {
          setStatusMessage({
            text: res.data?.error || res.data?.message || "Erro ao registrar organização",
            type: "error",
          });
        }
      } else {
        setStatusMessage({
          text: res.data?.error || "Erro ao registrar organização",
          type: "error",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: err.message || "Erro de conexão",
        type: "error",
      });
    } finally {
      setIsCreatingOrg(false);
    }
  };

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

  const handleManualTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await loginWithToken(manualToken.trim());
      if (result.success) {
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
      {/* Botão de Idioma Superior Direito */}
      <div style={{ position: "absolute", top: "16px", right: "20px", zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Cabeçalho de Identidade */}
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
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
              border: "1px solid rgba(var(--color-primary-rgb, 59, 130, 246), 0.2)",
            }}
          >
            <Sparkles size={13} />
            <span>Context OS • Workspace Corporativo</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 800,
              color: "var(--color-on-surface)",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
            }}
          >
            {mode === "org_onboarding"
              ? t("auth:onboardingOrgTitle", "Configurar Espaço da Empresa")
              : "Bem-vindo ao Context OS"}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "13.5px",
              color: "var(--color-on-surface-variant)",
              lineHeight: 1.45,
            }}
          >
            {mode === "org_onboarding"
              ? t(
                  "auth:onboardingOrgSubtitle",
                  "Vamos criar o espaço da sua organização para centralizar projetos e especificações com o time."
                )
              : t(
                  "auth:connectCompanySubtitle",
                  "Acesso corporativo integrado, sem necessidade de tokens técnicos."
                )}
          </p>
        </div>

        {/* Card Principal */}
        <Card style={{ width: "100%", display: "flex", flexDirection: "column" }}>
          <CardContent
            style={{
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {statusMessage && (
              <AlertBanner
                variant={statusMessage.type}
                title={statusMessage.text}
                onClose={() => setStatusMessage(null)}
              />
            )}

            {/* MODO 1: TELA INICIAL COM BOTÃO ÚNICO "CONECTAR COM A EMPRESA" */}
            {mode === "initial" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Botão Principal Hero */}
                <Button
                  id="btn-connect-company"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  onClick={handleStartDeviceFlow}
                  style={{
                    padding: "16px 20px",
                    fontSize: "15.5px",
                    fontWeight: 700,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    boxShadow: "0 4px 14px 0 rgba(var(--color-primary-rgb, 59, 130, 246), 0.39)",
                  }}
                >
                  <Building2 size={20} />
                  <span>{t("auth:connectCompany", "Conectar com a Empresa")}</span>
                  <ArrowRight size={18} style={{ marginLeft: "auto" }} />
                </Button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-outline-variant)",
                    fontSize: "12px",
                    color: "var(--color-on-surface-variant)",
                  }}
                >
                  <ShieldCheck size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <span>Autenticação silenciosa e segura com credenciais protegidas no cofre do sistema.</span>
                </div>

                {/* Contas Salvas no Cofre (se houver) */}
                {accounts.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        margin: "4px 0",
                      }}
                    >
                      <div style={{ flex: 1, height: "1px", background: "var(--color-outline-variant)" }} />
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: "var(--color-outline)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t("auth:savedAccountsTitle", "Ou entrar com perfil salvo")}
                      </span>
                      <div style={{ flex: 1, height: "1px", background: "var(--color-outline-variant)" }} />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {accounts.map((acc) => (
                        <div
                          key={acc.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            backgroundColor: "var(--color-surface-container-low)",
                            border: "1px solid var(--color-outline-variant)",
                            borderRadius: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            {acc.user?.avatar_url ? (
                              <img
                                src={acc.user.avatar_url}
                                alt={acc.user.login}
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  backgroundColor: "var(--color-primary-container)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--color-primary)",
                                }}
                              >
                                <UserIcon size={16} />
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "var(--color-on-surface)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {acc.user?.name || acc.user?.login}
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                                @{acc.user?.login}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isLoading}
                              onClick={() => handleSelectAccount(acc.id)}
                              leftIcon={<LogIn size={13} />}
                            >
                              Entrar
                            </Button>
                            <IconButton
                              size="sm"
                              tooltip="Remover"
                              onClick={() => removeAccount(acc.id)}
                            >
                              <Trash2 size={14} style={{ color: "var(--color-error)" }} />
                            </IconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rodapé Alternativo Discreto */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--color-outline-variant)",
                    marginTop: "6px",
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode("manual_token")}
                    style={{ fontSize: "11.5px", color: "var(--color-outline)" }}
                  >
                    <KeyRound size={13} />
                    <span>{t("auth:advancedTokenTitle", "Token Manual (Avançado)")}</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLocalModeLogin}
                    style={{ fontSize: "11.5px", color: "var(--color-outline)" }}
                  >
                    <Monitor size={13} />
                    <span>Modo Local</span>
                  </Button>
                </div>
              </div>
            )}

            {/* MODO 2: PAREAMENTO SILENCIOSO (DEVICE FLOW RFC 8628) */}
            {mode === "device_pairing" && deviceData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-primary)", textTransform: "uppercase" }}>
                    Código de Conexão
                  </span>
                  <div
                    style={{
                      margin: "8px auto",
                      padding: "12px 24px",
                      background: "var(--color-surface-container-high)",
                      border: "2px dashed var(--color-primary)",
                      borderRadius: "12px",
                      fontSize: "28px",
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      fontFamily: "monospace",
                      color: "var(--color-primary)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span>{deviceData.user_code}</span>
                    <IconButton
                      size="sm"
                      tooltip={copiedCode ? "Copiado!" : "Copiar Código"}
                      onClick={async () => {
                        await navigator.clipboard.writeText(deviceData.user_code);
                        setCopiedCode(true);
                      }}
                    >
                      {copiedCode ? <Check size={18} style={{ color: "var(--color-primary)" }} /> : <Copy size={18} />}
                    </IconButton>
                  </div>
                  {copiedCode && (
                    <span style={{ fontSize: "11.5px", color: "var(--color-primary)", fontWeight: 600 }}>
                      ✓ Código copiado para a área de transferência!
                    </span>
                  )}
                </div>

                {/* Botão de Ação Primária: Copiar e Abrir Navegador */}
                <Button
                  id="btn-open-device-auth"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleCopyAndOpenBrowser}
                  style={{
                    padding: "14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    borderRadius: "10px",
                  }}
                >
                  <ExternalLink size={18} />
                  <span>{t("auth:copyAndOpenBrowser", "Copiar Código e Abrir Navegador")}</span>
                </Button>

                {/* Passo a Passo Intuitivo Sem Jargões */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "14px",
                    borderRadius: "10px",
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-outline-variant)",
                    fontSize: "12.5px",
                    lineHeight: 1.5,
                    color: "var(--color-on-surface-variant)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "var(--color-primary-container)",
                        color: "var(--color-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "11px",
                        flexShrink: 0,
                      }}
                    >
                      1
                    </div>
                    <span>Cole o código <strong>{deviceData.user_code}</strong> na página que se abriu.</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "var(--color-primary-container)",
                        color: "var(--color-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "11px",
                        flexShrink: 0,
                      }}
                    >
                      2
                    </div>
                    <span>
                      Se ainda não tiver cadastro, basta clicar em <strong>"Criar conta"</strong> na mesma página.
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "var(--color-primary-container)",
                        color: "var(--color-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "11px",
                        flexShrink: 0,
                      }}
                    >
                      3
                    </div>
                    <span>Após autorizar, o aplicativo entrará <strong>automaticamente</strong>!</span>
                  </div>
                </div>

                {/* Status do Polling */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(var(--color-primary-rgb, 59, 130, 246), 0.08)",
                    color: "var(--color-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  <span>{pollingStatus || "Aguardando confirmação no navegador..."}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      stopPolling();
                      setMode("initial");
                    }}
                    style={{ fontSize: "12px", color: "var(--color-outline)" }}
                  >
                    Cancelar e voltar
                  </Button>
                </div>
              </div>
            )}

            {/* MODO 3: ONBOARDING DA ORGANIZAÇÃO (PRIMEIRO ACESSO DA EMPRESA) */}
            {mode === "org_onboarding" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-outline-variant)",
                  }}
                >
                  {createdUser?.avatar_url && (
                    <img
                      src={createdUser.avatar_url}
                      alt={createdUser.login}
                      style={{ width: "38px", height: "38px", borderRadius: "50%" }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-on-surface)" }}>
                      Olá, {createdUser?.name || createdUser?.login}!
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-on-surface-variant)" }}>
                      Autenticado com sucesso. Vamos configurar seu time.
                    </div>
                  </div>
                </div>

                {orgWebFlowUrl ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      padding: "14px",
                      borderRadius: "10px",
                      background: "var(--color-surface-container-high)",
                      border: "1px solid var(--color-primary)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--color-on-surface)", lineHeight: 1.4 }}>
                      Para criar uma nova organização corporativa oficial, conclua o passo simples na página do provedor:
                    </p>
                    <a
                      href={orgWebFlowUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "10px",
                        borderRadius: "8px",
                        background: "var(--color-primary)",
                        color: "var(--color-on-primary, #ffffff)",
                        fontWeight: 700,
                        fontSize: "13px",
                        textDecoration: "none",
                      }}
                    >
                      <span>Abrir Criação de Organização</span>
                      <ExternalLink size={14} />
                    </a>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={async () => {
                        await refreshAuth();
                        onLoginSuccess();
                      }}
                    >
                      Já criei a organização, continuar!
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateOrg} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <FormField
                      label={t("auth:orgNameLabel", "Nome da Empresa ou Time")}
                      helperText="Este nome identificará o repositório central de especificações e governança."
                    >
                      <Input
                        id="org-name-input"
                        placeholder={t("auth:orgNamePlaceholder", "ex: minha-empresa")}
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        autoFocus
                      />
                    </FormField>

                    <Button
                      id="btn-create-org"
                      variant="primary"
                      size="md"
                      fullWidth
                      type="submit"
                      loading={isCreatingOrg}
                      disabled={!orgName.trim()}
                    >
                      <Building2 size={16} />
                      <span>{t("auth:createOrgButton", "Criar Espaço da Empresa")}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => onLoginSuccess()}
                      style={{ color: "var(--color-outline)", fontSize: "12px" }}
                    >
                      {t("auth:skipOrgButton", "Continuar no espaço individual por enquanto")}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {/* MODO 4: TOKEN MANUAL (OPÇÃO AVANÇADA / FALLBACK) */}
            {mode === "manual_token" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-on-surface)" }}>
                    Conectar com Token Manual
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode("initial")}
                    style={{ fontSize: "12px" }}
                  >
                    Voltar
                  </Button>
                </div>

                <form onSubmit={handleManualTokenLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <FormField
                    label="Personal Access Token (PAT)"
                    helperText="Escopos necessários: repo, read:org, user"
                  >
                    <Input
                      type="password"
                      id="pat-token-input"
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      autoComplete="off"
                    />
                  </FormField>

                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    type="submit"
                    loading={isLoading}
                    disabled={!manualToken.trim()}
                  >
                    Autenticar com Token
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

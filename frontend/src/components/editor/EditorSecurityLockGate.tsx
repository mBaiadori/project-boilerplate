import React from "react";
import { Lock } from "lucide-react";

export interface EditorSecurityLockGateProps {
  activeDeptObj?: {
    name: string;
    color?: string;
    icon?: string;
    folder?: string;
  } | null;
  departmentName?: string;
}

export const EditorSecurityLockGate: React.FC<EditorSecurityLockGateProps> = ({
  activeDeptObj,
  departmentName,
}) => {
  const deptColor = activeDeptObj?.color || "#ef4444";
  const deptName = activeDeptObj?.name || departmentName || "Restrita";

  return (
    <div
      className="document-security-lock-gate"
      id="document-security-lock-gate"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "var(--color-surface, #ffffff)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          width: "100%",
          padding: "36px 32px",
          borderRadius: "16px",
          border: `1px solid ${deptColor}35`,
          background: "var(--color-surface-container-lowest, #ffffff)",
          boxShadow: "0 14px 36px rgba(0, 0, 0, 0.07)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "18px",
        }}
      >
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            backgroundColor: `${deptColor}15`,
            color: deptColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Lock size={30} />
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            {activeDeptObj && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "16px",
                  backgroundColor: `${deptColor}18`,
                  border: `1px solid ${deptColor}45`,
                  color: deptColor,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "15px" }}
                >
                  {activeDeptObj.icon || "folder"}
                </span>
                Departamento: {activeDeptObj.name}
              </div>
            )}
          </div>

          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "19px",
              fontWeight: 700,
              color: "var(--color-on-surface, #0f172a)",
            }}
          >
            Documento Restrito por Governança de Acesso
          </h3>
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "13px",
              color: "var(--color-outline, #64748b)",
              lineHeight: "1.6",
            }}
          >
            Este documento pertence à pasta restrita{" "}
            <strong style={{ color: deptColor }}>
              {deptName}
            </strong>{" "}
            e seu usuário não possui autorização de leitura para este
            departamento ou rota no projeto.
          </p>

          <div
            style={{
              background: "rgba(99, 102, 241, 0.05)",
              border: "1px solid rgba(99, 102, 241, 0.15)",
              borderRadius: "10px",
              padding: "12px 14px",
              fontSize: "12px",
              color: "var(--color-outline, #64748b)",
              textAlign: "left",
              marginBottom: "16px",
              lineHeight: "1.5",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                color: "#6366f1",
                marginBottom: "4px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "16px" }}
              >
                lock
              </span>
              Como obter acesso a este documento:
            </div>
            <div>
              1. Solicite permissão para o departamento{" "}
              <strong>
                {deptName}
              </strong>{" "}
              ao Administrador do repositório.
              <br />
              2. O Administrador pode liberar seu acesso no menu{" "}
              <strong>
                Governança & Equipe &rarr; Departamentos & Pastas
              </strong>
              .<br />
              3. As permissões são aplicadas automaticamente com base no
              seu perfil.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

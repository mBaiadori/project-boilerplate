import React from "react";
import { Button } from "../../../../components/ui";

interface AddMcpServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleSaveCustomMcp: (e: React.FormEvent) => Promise<void>;
  newMcpName: string;
  setNewMcpName: (val: string) => void;
  newMcpType: "stdio" | "sse";
  setNewMcpType: (val: "stdio" | "sse") => void;
  newMcpCommand: string;
  setNewMcpCommand: (val: string) => void;
  newMcpEndpoint: string;
  setNewMcpEndpoint: (val: string) => void;
  newMcpDesc: string;
  setNewMcpDesc: (val: string) => void;
}

export const AddMcpServerModal: React.FC<AddMcpServerModalProps> = ({
  isOpen,
  onClose,
  handleSaveCustomMcp,
  newMcpName,
  setNewMcpName,
  newMcpType,
  setNewMcpType,
  newMcpCommand,
  setNewMcpCommand,
  newMcpEndpoint,
  setNewMcpEndpoint,
  newMcpDesc,
  setNewMcpDesc,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <form
        onSubmit={handleSaveCustomMcp}
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--color-surface, #fff)",
          borderRadius: "12px",
          border: "1px solid var(--color-outline-variant, #e2e8f0)",
          padding: "20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
            Cadastrar Servidor MCP
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                display: "block",
                marginBottom: "2px",
              }}
            >
              Nome do Servidor
            </label>
            <input
              type="text"
              required
              placeholder="ex: Linear MCP"
              value={newMcpName}
              onChange={(e) => setNewMcpName(e.target.value)}
              style={{
                width: "100%",
                fontSize: "12px",
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                display: "block",
                marginBottom: "2px",
              }}
            >
              Tipo de Conexão
            </label>
            <select
              value={newMcpType}
              onChange={(e) => setNewMcpType(e.target.value as "stdio" | "sse")}
              style={{
                width: "100%",
                fontSize: "12px",
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
              }}
            >
              <option value="stdio">stdio (Comando CLI)</option>
              <option value="sse">sse (Endpoint HTTP/SSE)</option>
            </select>
          </div>
          {newMcpType === "stdio" ? (
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                Comando de Execução
              </label>
              <input
                type="text"
                placeholder="ex: npx -y @modelcontextprotocol/server-postgres"
                value={newMcpCommand}
                onChange={(e) => setNewMcpCommand(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: "12px",
                  padding: "6px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-outline-variant, #cbd5e1)",
                }}
              />
            </div>
          ) : (
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                URL do Endpoint SSE
              </label>
              <input
                type="url"
                placeholder="ex: http://localhost:8000/sse"
                value={newMcpEndpoint}
                onChange={(e) => setNewMcpEndpoint(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: "12px",
                  padding: "6px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-outline-variant, #cbd5e1)",
                }}
              />
            </div>
          )}
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                display: "block",
                marginBottom: "2px",
              }}
            >
              Descrição (opcional)
            </label>
            <input
              type="text"
              placeholder="Propósito deste servidor MCP"
              value={newMcpDesc}
              onChange={(e) => setNewMcpDesc(e.target.value)}
              style={{
                width: "100%",
                fontSize: "12px",
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Salvar no .mcp.json
          </Button>
        </div>
      </form>
    </div>
  );
};

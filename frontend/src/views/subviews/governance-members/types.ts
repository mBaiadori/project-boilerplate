export type GovernanceTab = "members" | "teams" | "protection";

export interface PermissionMeta {
  label: string;
  description: string;
  color: string;
  bg: string;
}

export const PERMISSION_CONFIG: Record<string, PermissionMeta> = {
  pull: {
    label: "Leitura (Pull)",
    description: "Apenas ler e clonar o repositório",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.12)",
  },
  triage: {
    label: "Triagem (Triage)",
    description: "Gerenciar issues e discussões",
    color: "#0d9488",
    bg: "rgba(13, 148, 136, 0.12)",
  },
  push: {
    label: "Escrita (Push)",
    description: "Criar branches, editar e propor Pull Requests",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
  },
  maintain: {
    label: "Mantenedor (Maintain)",
    description: "Gerenciar branches e merge de PRs",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
  },
  admin: {
    label: "Administrador (Admin)",
    description: "Acesso total, governança e configurações do repositório",
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.12)",
  },
};

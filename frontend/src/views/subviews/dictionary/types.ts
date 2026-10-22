export type SortOption = "name-asc" | "name-desc" | "code-asc" | "domain-asc";
export type ViewMode = "table" | "grid";

export interface DddCategory {
  id: string;
  label: string;
  desc: string;
  color: string;
}

export const DDD_CATEGORIES: DddCategory[] = [
  { id: "Entity", label: "Entity", desc: "Entidade com identidade única", color: "#2563eb" },
  { id: "Value Object", label: "Value Object", desc: "Objeto de valor imutável", color: "#0891b2" },
  { id: "Aggregate", label: "Aggregate", desc: "Raiz de agregação", color: "#7c3aed" },
  { id: "Domain Event", label: "Domain Event", desc: "Fato relevante ocorrido", color: "#ea580c" },
  { id: "Service", label: "Service", desc: "Serviço de domínio puro", color: "#059669" },
  { id: "Process", label: "Process", desc: "Fluxo ou processo de negócio", color: "#d97706" },
  { id: "Rule / Policy", label: "Rule / Policy", desc: "Regra / política de negócio", color: "#dc2626" },
  { id: "Metric", label: "Metric", desc: "Métrica / KPI de monitoramento", color: "#4f46e5" },
];

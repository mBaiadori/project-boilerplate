import { Brain, FileCode2, Layers, ShieldCheck, Sparkles, Terminal } from "lucide-react";

export const getCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case "governance":
      return (
        <ShieldCheck size={16} style={{ color: "var(--color-success)" }} />
      );
    case "architecture":
      return (
        <FileCode2 size={16} style={{ color: "var(--color-primary)" }} />
      );
    case "quality":
      return <Sparkles size={16} style={{ color: "var(--color-warning)" }} />;
    case "engineering":
      return <Terminal size={16} style={{ color: "#a855f7" }} />;
    case "memory":
      return <Brain size={16} style={{ color: "#ec4899" }} />;
    default:
      return <Layers size={16} style={{ color: "var(--color-outline)" }} />;
  }
};

import { marked } from "marked";

export const formatPRDate = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

export const renderMarkdownDescription = (text: string) => {
  try {
    const html = marked.parse(text, { breaks: true, gfm: true }) as string;
    return (
      <div
        className="ui-markdown-rendered-desc"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return (
      <div
        className="ui-markdown-rendered-desc"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {text}
      </div>
    );
  }
};

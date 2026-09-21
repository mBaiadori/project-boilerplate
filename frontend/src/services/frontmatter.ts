import * as yaml from "js-yaml";

export interface DocumentMetadata {
  id?: string;
  title?: string;
  type?: string;
  version?: string;
  status?: string;
  layer?: string;
  path?: string;
  parent?: string;
  lifecycle?: {
    stage?: string;
    previous_stage?: string;
    next_stage?: string;
    feedback_loops?: Record<string, string>;
  };
  [key: string]: any;
}

export interface ParsedDocument {
  hasFrontmatter: boolean;
  metadata: DocumentMetadata;
  body: string;
}

export function createDefaultMetadata(): DocumentMetadata {
  return {
    id: "",
    title: "",
    type: "spec",
    version: "1.0.0",
    status: "",
    layer: "",
    path: "",
    parent: "",
    lifecycle: {
      stage: "docs",
      previous_stage: "",
      next_stage: "",
      feedback_loops: {},
    },
  };
}

export function parseFrontmatter(rawContent = ""): ParsedDocument {
  if (!rawContent || typeof rawContent !== "string") {
    return {
      hasFrontmatter: false,
      metadata: createDefaultMetadata(),
      body: "",
    };
  }

  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      hasFrontmatter: false,
      metadata: createDefaultMetadata(),
      body: rawContent,
    };
  }

  const yamlBlock = match[1];
  const body = match[2] || "";

  try {
    const parsed = yaml.load(yamlBlock) as DocumentMetadata;
    return {
      hasFrontmatter: true,
      metadata: {
        ...createDefaultMetadata(),
        ...(parsed && typeof parsed === "object" ? parsed : {}),
      },
      body,
    };
  } catch (e) {
    console.warn("[Frontmatter] Erro ao analisar YAML:", e);
    return {
      hasFrontmatter: false,
      metadata: createDefaultMetadata(),
      body: rawContent,
    };
  }
}

export function serializeFrontmatter(
  metadata: DocumentMetadata | null | undefined,
  body = "",
): string {
  if (!metadata) return body;

  try {
    const yamlString = yaml
      .dump(metadata, { lineWidth: -1, forceQuotes: false })
      .trim();
    return `---\n${yamlString}\n---\n\n${body.trimStart()}`;
  } catch (e) {
    console.error("[Frontmatter] Erro ao serializar YAML:", e);
    return body;
  }
}

export function stripFrontmatter(rawContent = ""): string {
  const parsed = parseFrontmatter(rawContent);
  return parsed.body;
}

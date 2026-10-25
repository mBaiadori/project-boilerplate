import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getSafeRepoPath, nativeTools } from "./native-tools.js";
import { PROJECTS_DIR, resolveRepoDir } from "../../../config/constants.js";

describe("Phase 02: Native AI Tools Safe Path Resolution & Canonical Repo Support", () => {
  let tmpOrgDir: string;
  let tmpRepoDir: string;

  beforeEach(() => {
    tmpOrgDir = path.join(PROJECTS_DIR, "test-org");
    tmpRepoDir = path.join(tmpOrgDir, "test-repo");
    fs.mkdirSync(tmpRepoDir, { recursive: true });
    fs.writeFileSync(path.join(tmpRepoDir, "sample.md"), "# Hello Org Repo");
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpOrgDir, { recursive: true, force: true });
    } catch {}
  });

  test("getSafeRepoPath deve resolver corretamente repositórios com owner/repo (BUG-02)", () => {
    const resolved = getSafeRepoPath("test-org/test-repo", "sample.md");
    assert.ok(resolved, "Caminho não deve ser nulo");
    assert.strictEqual(
      resolved,
      path.resolve(tmpRepoDir, "sample.md"),
      "Caminho canônico deve apontar para projects/test-org/test-repo/sample.md"
    );
  });

  test("getSafeRepoPath deve rejeitar path traversal com ..", () => {
    const resolved = getSafeRepoPath("test-org/test-repo", "../../secrets.txt");
    assert.strictEqual(resolved, null, "Path traversal deve retornar null");
  });

  test("docs_read_file deve ler com sucesso arquivos de repositório organizacional test-org/test-repo", async () => {
    const readFileTool = nativeTools.find((t) => t.name === "docs_read_file");
    assert.ok(readFileTool, "Ferramenta docs_read_file deve existir");

    const result = await readFileTool.execute(
      { file_path: "sample.md" },
      { repoName: "test-org/test-repo" }
    );

    assert.strictEqual(result.success, true, `Leitura falhou: ${result.error}`);
    assert.ok(
      typeof result.data === "object" && result.data.content?.includes("Hello Org Repo"),
      "Conteúdo retornado deve corresponder ao arquivo do repositório organizacional"
    );
  });
});

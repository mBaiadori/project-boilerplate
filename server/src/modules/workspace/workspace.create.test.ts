import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { resolveRepoDir } from "../../config/constants.js";
import { workspaceService } from "./workspace.service.js";

test("WorkspaceService - Criação de arquivos e pastas", async (t) => {
  const repo = "test-create-file-repo";
  const repoDir = resolveRepoDir(repo);

  fs.mkdirSync(repoDir, { recursive: true });

  await t.test(
    "Deve adicionar extensão .md se o nome do arquivo for fornecido sem extensão",
    async () => {
      const result = await workspaceService.createFile(
        "domains/meu-novo-documento",
        "# Titulo",
        false,
        { title: "Meu Novo Documento" },
        repo,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.path, "domains/meu-novo-documento.md");
      assert.strictEqual(
        fs.existsSync(path.join(repoDir, "domains/meu-novo-documento.md")),
        true,
      );
    },
  );

  await t.test(
    "Deve preservar extensão fornecida explicitamente (.md, .txt, .json)",
    async () => {
      const resultTxt = await workspaceService.createFile(
        "notes/log.txt",
        "Hello",
        false,
        {},
        repo,
      );
      assert.strictEqual(resultTxt.path, "notes/log.txt");

      const resultMd = await workspaceService.createFile(
        "notes/readme.md",
        "Doc",
        false,
        {},
        repo,
      );
      assert.strictEqual(resultMd.path, "notes/readme.md");
    },
  );

  await t.test(
    "Deve criar pasta sem adicionar extensão .md",
    async () => {
      const resultFolder = await workspaceService.createFile(
        "minha-pasta",
        "",
        true,
        undefined,
        repo,
      );
      assert.strictEqual(resultFolder.is_folder, true);
      assert.strictEqual(resultFolder.path, "minha-pasta");
      assert.strictEqual(
        fs.existsSync(path.join(repoDir, "minha-pasta")),
        true,
      );
    },
  );

  // Cleanup
  try {
    fs.rmSync(repoDir, { recursive: true, force: true });
  } catch {}
});

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  isGitRepo,
  commitChanges,
  createAndCheckoutBranch,
  getGitLog,
  getGitDiff,
  executeGit,
} from "./git.js";
import {
  assertBranchName,
  assertCommitish,
  assertGitPath,
  assertRemoteName,
} from "./git-validate.js";

describe("Fase 5: Git Fuzzing e Validação Robusta de Argumentos", () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctxos-fuzz-test-"));
    await executeGit(["init", "-b", "main"], tmpDir);
    await executeGit(["config", "user.name", "Fuzz Tester"], tmpDir);
    await executeGit(["config", "user.email", "fuzz@contextos.local"], tmpDir);

    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Initial Fuzz Repo\n");
    await commitChanges(tmpDir, "Initial commit");
  });

  after(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe("5.1: Fuzzing de assertBranchName e Nomes de Branch", () => {
    const validBranches = [
      "main",
      "develop",
      "feature/user-auth",
      "fix/issue_123",
      "gov/compliance-2026",
      "v1.0.0-rc.1",
      "user.name/patch-1",
    ];

    for (const b of validBranches) {
      test(`deve aceitar branch válida: ${b}`, () => {
        assert.equal(assertBranchName(b), b);
      });
    }

    const hostileBranches = [
      "--upload-pack=evil",
      "-f",
      "--exec=calc",
      "--end-of-options",
      "branch;rm -rf /",
      "branch|cat /etc/passwd",
      "branch`touch PWNED`",
      "branch$(whoami)",
      "branch with spaces",
      "branch\x00null",
      "branch\nnewline",
      "branch\rcarriage",
      "branch..double-dot",
      "branch@{1}",
      "branch/ends-with-slash/",
      "branch.ends-with-dot.",
      "branch?wildcard",
      "branch*wildcard",
      "branch[bracket]",
      "branch:colon",
      "branch^caret",
      "branch~tilde",
    ];

    for (const b of hostileBranches) {
      test(`deve rejeitar branch hostil/inválida: ${JSON.stringify(b)}`, () => {
        assert.throws(
          () => assertBranchName(b),
          /inválido|contém caracteres inválidos/,
          `Deveria ter rejeitado: ${b}`
        );
      });
    }
  });

  describe("5.2: Fuzzing de assertCommitish e Refs", () => {
    const validRefs = [
      "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
      "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
      "HEAD",
      "HEAD~1",
      "HEAD~12",
      "HEAD^",
      "HEAD^2",
      "refs/heads/main",
      "refs/tags/v1.0",
      "a1b2c3d",
    ];

    for (const r of validRefs) {
      test(`deve aceitar commitish válido: ${r}`, () => {
        assert.equal(assertCommitish(r), r);
      });
    }

    const hostileRefs = [
      "--help",
      "--version",
      "--upload-pack=/evil",
      "-a",
      "-m",
      "HEAD;touch PWNED",
      "HEAD`calc`",
      "HEAD$(id)",
      "4b825..HEAD",
      "ref with space",
      "ref\x00null",
    ];

    for (const r of hostileRefs) {
      test(`deve rejeitar commitish hostil/inválido: ${JSON.stringify(r)}`, () => {
        assert.throws(
          () => assertCommitish(r),
          /inválido|contém caracteres inválidos/,
          `Deveria ter rejeitado: ${r}`
        );
      });
    }
  });

  describe("5.3: Fuzzing de Mensagens de Commit com Caracteres Especiais", () => {
    test("deve aceitar mensagens com caracteres UTF-8, acentos e emojis", async () => {
      fs.writeFileSync(path.join(tmpDir, "utf8.txt"), "conteúdo teste utf8");
      const msg = "feat(core): adição de verificação de cabeçalhos áéíóú çãõ 🚀✨";
      const res = await commitChanges(tmpDir, msg);
      assert.equal(res.success, true);

      const log = await getGitLog(tmpDir, 1);
      assert.ok(log.length > 0);
      assert.ok(log[0].message.includes("adição de verificação"));
      assert.ok(log[0].message.includes("áéíóú"));
    });

    test("deve aceitar mensagens com aspas simples, aspas duplas e crases sem quebrar", async () => {
      fs.writeFileSync(path.join(tmpDir, "quotes.txt"), "conteúdo teste quotes");
      const msg = `fix: resolver 'aspas simples', "aspas duplas" e \`crases\` em $VAR e <tag>`;
      const res = await commitChanges(tmpDir, msg);
      assert.equal(res.success, true);

      const log = await getGitLog(tmpDir, 1);
      assert.ok(log.length > 0);
      assert.ok(log[0].message.includes("'aspas simples'"));
      assert.ok(log[0].message.includes('"aspas duplas"'));
      assert.ok(log[0].message.includes("`crases`"));
    });

    test("deve aceitar mensagens multi-linha estruturadas", async () => {
      fs.writeFileSync(path.join(tmpDir, "multiline.txt"), "conteúdo teste multiline");
      const msg = "chore: release 1.0\n\nDetalhes da versão:\n- item 1\n- item 2\n\nAssinado: QA";
      const res = await commitChanges(tmpDir, msg);
      assert.equal(res.success, true);

      const log = await getGitLog(tmpDir, 1);
      assert.ok(log.length > 0);
      assert.ok(log[0].message.includes("chore: release 1.0"));
    });
  });

  describe("5.4: Arquivos e Pastas com Nomes Especiais (Espaços e UTF-8)", () => {
    test("deve manipular commits e diffs de arquivos com espaços e acentos no nome", async () => {
      const fileName = "relatório mensal do projeto.md";
      const filePath = path.join(tmpDir, fileName);
      fs.writeFileSync(filePath, "# Relatório Mensal\n\nStatus: Concluído com sucesso.\n");

      const res = await commitChanges(tmpDir, "Adicionar relatório mensal", [fileName]);
      assert.equal(res.success, true);

      // Modifica o arquivo para verificar diff
      fs.appendFileSync(filePath, "Adição de observações adicionais.\n");
      const resDiff = await getGitDiff(tmpDir);
      assert.ok(resDiff.diff.includes("relatório mensal do projeto.md") || resDiff.diff.includes("Adição de observações"));
    });
  });

  describe("5.5: Desambiguação de Branch vs Nome de Arquivo", () => {
    test("deve criar e alternar branch mesmo que exista um arquivo com mesmo nome", async () => {
      const branchName = "release";
      // Cria arquivo chamado "release" no root do repo
      fs.writeFileSync(path.join(tmpDir, "release"), "Arquivo release físico no disco");
      await commitChanges(tmpDir, "Adicionar arquivo release");

      // Agora cria a branch chamada "release"
      const res = await createAndCheckoutBranch(tmpDir, branchName);
      assert.equal(res.success, true);

      // Volta para a main
      const backRes = await createAndCheckoutBranch(tmpDir, "main");
      assert.equal(backRes.success, true);
    });
  });
});

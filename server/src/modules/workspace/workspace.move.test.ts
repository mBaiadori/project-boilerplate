import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR } from "../../config/constants.js";
import { workspaceService } from "./workspace.service.js";
import { docsMetadataService } from "./docs-metadata.service.js";

test("Cross-Repository File Move Suite", async (t) => {
  const repoA = "test-move-repo-a";
  const repoB = "test-move-repo-b";

  const dirA = path.join(PROJECTS_DIR, repoA);
  const dirB = path.join(PROJECTS_DIR, repoB);

  // Setup test environment
  fs.mkdirSync(path.join(dirA, "domains"), { recursive: true });
  fs.mkdirSync(path.join(dirB, "domains"), { recursive: true });

  const testFileContent =
    "# Test Document for Move\n\nConteúdo de teste para movimentação.";
  fs.writeFileSync(
    path.join(dirA, "domains", "test-doc.md"),
    testFileContent,
    "utf-8",
  );

  // Set initial metadata
  docsMetadataService.saveDocsMetadata(repoA, [
    {
      id: "domains-test-doc",
      name: "test-doc",
      title: "Documento Teste",
      ext: "md",
      path: "domains/test-doc.md",
      status: "-",
      categories: "geral",
      tags: ["teste"],
      updated_at: new Date().toISOString(),
      approvers: [],
      links: [],
      templateId: "",
      prompt: "",
    },
  ]);

  docsMetadataService.saveDocsMetadata(repoB, []);

  await t.test(
    "Deve mover arquivo com sucesso de repoA para repoB preservando metadados",
    async () => {
      const result = await workspaceService.moveFile(
        "domains/test-doc.md",
        "domains/migrated-doc.md",
        repoA,
        repoB,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.sourceRepo, repoA);
      assert.strictEqual(result.targetRepo, repoB);

      // Verify disk files
      assert.strictEqual(
        fs.existsSync(path.join(dirA, "domains", "test-doc.md")),
        false,
      );
      assert.strictEqual(
        fs.existsSync(path.join(dirB, "domains", "migrated-doc.md")),
        true,
      );
      assert.strictEqual(
        fs.readFileSync(path.join(dirB, "domains", "migrated-doc.md"), "utf-8"),
        testFileContent,
      );

      // Verify metadata migration
      const metaA = docsMetadataService.loadDocsMetadata(repoA);
      const metaB = docsMetadataService.loadDocsMetadata(repoB);

      assert.strictEqual(
        metaA.some((d) => d.path === "domains/test-doc.md"),
        false,
      );
      const itemB = metaB.find((d) => d.path === "domains/migrated-doc.md");
      assert.ok(itemB);
      assert.strictEqual(itemB.title, "Documento Teste");
      assert.strictEqual(itemB.id, "domains-migrated-doc");
    },
  );

  // Cleanup test directories
  try {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
    workspaceService.invalidateTreeCache(repoA);
    workspaceService.invalidateTreeCache(repoB);
  } catch {}
});

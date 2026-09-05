import unittest
import os
import shutil
import server

class TestAuditEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_repo = "test_audit_repo"
        cls.repo_dir = os.path.join(server.PROJECTS_DIR, cls.test_repo)
        os.makedirs(cls.repo_dir, exist_ok=True)

        # 1. Clean feature
        server.scaffold_workspace_entity(cls.test_repo, "feature", {
            "domain": "financeiro",
            "area": "core",
            "name": "TRANSFERENCIA",
            "title": "Transferência Bancária"
        })

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.repo_dir):
            shutil.rmtree(cls.repo_dir)

    def test_clean_workspace_audit_score(self):
        audit = server.audit_workspace(self.test_repo)
        self.assertGreaterEqual(audit["score"], 90)
        self.assertIn(audit["grade"], ["A+", "A"])

    def test_broken_link_detection(self):
        # Insert a file with a broken cross-cutting target
        broken_file = os.path.join(self.repo_dir, "domains", "broken_feature.md")
        with open(broken_file, "w", encoding="utf-8") as f:
            f.write("""---
id: "broken-test"
title: "Broken Feature"
layer: "L4_FEATURE"
cross_cutting_relations:
  - target: "domains/inexistente/nao_existe.md"
---
# Teste
""")
        audit = server.audit_workspace(self.test_repo)
        issues = audit["issues"]
        has_broken_link = any("inexistente" in iss.get("message", "") for iss in issues)
        self.assertTrue(has_broken_link)

    def test_sast_secret_detection(self):
        # Insert a file with a fake GitHub PAT token
        secret_file = os.path.join(self.repo_dir, "domains", "secret_leak.md")
        with open(secret_file, "w", encoding="utf-8") as f:
            f.write("""---
id: "secret-test"
title: "Secret Test"
layer: "L4_FEATURE"
---
# Arquivo com segredo exposto
github_pat_11ABCDEFGHIJKLMN1234567890abcdefghijklmnopqrstuvwxyz
""")
        audit = server.audit_workspace(self.test_repo)
        issues = audit["issues"]
        has_secret_issue = any("chave de API" in iss.get("message", "") or "token" in iss.get("message", "") for iss in issues)
        self.assertTrue(has_secret_issue)

if __name__ == "__main__":
    unittest.main()

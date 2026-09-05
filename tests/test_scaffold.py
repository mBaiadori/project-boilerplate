import unittest
import os
import shutil
import server

class TestScaffoldEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_repo = "test_scaffold_repo"
        cls.repo_dir = os.path.join(server.PROJECTS_DIR, cls.test_repo)
        os.makedirs(cls.repo_dir, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.repo_dir):
            shutil.rmtree(cls.repo_dir)

    def test_domain_scaffolding(self):
        res = server.scaffold_workspace_entity(self.test_repo, "domain", { "name": "catalogo", "title": "Catálogo de Produtos" })
        self.assertTrue(res["success"])
        expected_file = os.path.join(self.repo_dir, "domains", "catalogo", "index.md")
        self.assertTrue(os.path.exists(expected_file))
        with open(expected_file, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("layer: \"L2_DOMAIN\"", content)
            self.assertIn("Domínio: Catálogo de Produtos", content)

    def test_subdomain_scaffolding(self):
        res = server.scaffold_workspace_entity(self.test_repo, "subdomain", { "domain": "catalogo", "name": "produtos", "title": "Gestão de SKUs" })
        self.assertTrue(res["success"])
        expected_file = os.path.join(self.repo_dir, "domains", "catalogo", "produtos", "index.md")
        self.assertTrue(os.path.exists(expected_file))
        with open(expected_file, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("layer: \"L3_SUBDOMAIN\"", content)

    def test_feature_full_pipeline_scaffolding(self):
        res = server.scaffold_workspace_entity(self.test_repo, "feature", {
            "domain": "catalogo",
            "area": "produtos",
            "name": "CADASTRAR-SKU",
            "title": "Cadastrar Novo SKU",
            "risk_tier": "tier_1",
            "cross_cutting": ["domains/iam/index.md"]
        })
        self.assertTrue(res["success"])
        self.assertEqual(len(res["created_files"]), 9)

        base = os.path.join(self.repo_dir, "domains", "catalogo", "produtos", "CADASTRAR-SKU")
        # Check presence of all 9 artifacts
        self.assertTrue(os.path.exists(os.path.join(base, "ideacao.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "kpis.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "research.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "feature-definition.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "docs", "flow.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "docs", "entity.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "specs", "behavior.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "quality", "review.md")))
        self.assertTrue(os.path.exists(os.path.join(base, "quality", "monitoring.md")))

if __name__ == "__main__":
    unittest.main()

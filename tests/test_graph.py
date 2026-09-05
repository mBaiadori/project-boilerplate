import unittest
import os
import shutil
import server

class TestWorkspaceGraph(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_repo = "test_graph_repo"
        cls.repo_dir = os.path.join(server.PROJECTS_DIR, cls.test_repo)
        os.makedirs(cls.repo_dir, exist_ok=True)

        # Create sample architecture
        server.scaffold_workspace_entity(cls.test_repo, "domain", { "name": "iam", "title": "Identificação e Acesso" })
        server.scaffold_workspace_entity(cls.test_repo, "feature", {
            "domain": "billing",
            "area": "pix",
            "name": "PROCESSAR-PIX",
            "title": "Processar Pagamento PIX",
            "risk_tier": "tier_1",
            "cross_cutting": ["domains/iam/index.md"]
        })

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.repo_dir):
            shutil.rmtree(cls.repo_dir)

    def test_graph_nodes_and_layers(self):
        graph = server.build_workspace_graph(self.test_repo)
        nodes = graph["nodes"]
        self.assertIn("domains/iam/index.md", nodes)
        self.assertEqual(nodes["domains/iam/index.md"]["layer"], "L2_DOMAIN")
        
        pix_def_path = "domains/billing/pix/PROCESSAR-PIX/feature-definition.md"
        self.assertIn(pix_def_path, nodes)
        self.assertEqual(nodes[pix_def_path]["layer"], "L4_FEATURE")

    def test_bidirectional_connectivity_and_consumers(self):
        graph = server.build_workspace_graph(self.test_repo)
        nodes = graph["nodes"]

        pix_def = nodes["domains/billing/pix/PROCESSAR-PIX/feature-definition.md"]
        iam_node = nodes["domains/iam/index.md"]

        # Forward dependency
        self.assertTrue(any(d["target_path"] == "domains/iam/index.md" for d in pix_def["dependencies"]))

        # Reverse Backlink in Target (Consumer Index)
        self.assertTrue(any(c["source_path"] == "domains/billing/pix/PROCESSAR-PIX/feature-definition.md" for c in iam_node["consumers"]))

    def test_blast_radius_calculation(self):
        graph = server.build_workspace_graph(self.test_repo)
        nodes = graph["nodes"]
        iam_node = nodes["domains/iam/index.md"]

        # Modifying IAM should impact PROCESSAR-PIX
        affected_paths = [b["path"] for b in iam_node["blast_radius"]]
        self.assertIn("domains/billing/pix/PROCESSAR-PIX/feature-definition.md", affected_paths)

if __name__ == "__main__":
    unittest.main()

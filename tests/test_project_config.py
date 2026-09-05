import unittest
import os
import shutil
import json
import server

class TestProjectConfigEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_repo = "test_project_config_repo"
        cls.repo_dir = os.path.join(server.PROJECTS_DIR, cls.test_repo)
        os.makedirs(cls.repo_dir, exist_ok=True)
        server.ensure_default_repo_files(cls.test_repo)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.repo_dir):
            shutil.rmtree(cls.repo_dir)
        cfg = server.load_config()
        if "workspace_changes" in cfg and cls.test_repo in cfg["workspace_changes"]:
            del cfg["workspace_changes"][cls.test_repo]
            server.save_config(cfg)

    def test_default_project_config_retrieval(self):
        res = server.get_project_config(self.test_repo)
        self.assertIn("config", res)
        cfg = res["config"]
        self.assertEqual(cfg["project"]["name"], "Test Project Config Repo")
        self.assertEqual(len(cfg["layers"]), 6)
        self.assertIn("canvas_5w2h", cfg)
        self.assertIn("tags", cfg)

    def test_save_custom_project_config(self):
        custom_cfg = server.get_project_config(self.test_repo)["config"]
        custom_cfg["project"]["name"] = "Fintech Alpha"
        custom_cfg["tags"].append("custom-tag-123")
        custom_cfg["canvas_5w2h"]["what"] = "Motor de Crédito Especializado"

        save_res = server.save_project_config(self.test_repo, custom_cfg)
        self.assertTrue(save_res["success"])

        # Reload and check
        reloaded = server.get_project_config(self.test_repo)
        self.assertEqual(reloaded["config"]["project"]["name"], "Fintech Alpha")
        self.assertIn("custom-tag-123", reloaded["config"]["tags"])
        self.assertEqual(reloaded["config"]["canvas_5w2h"]["what"], "Motor de Crédito Especializado")

    def test_reset_project_config(self):
        reset_res = server.reset_project_config(self.test_repo)
        self.assertTrue(reset_res["success"])
        reloaded = server.get_project_config(self.test_repo)
        self.assertEqual(reloaded["config"]["project"]["name"], "Test Project Config Repo")

    def test_get_project_team_members(self):
        members = server.get_project_team_members(self.test_repo)
        self.assertIsInstance(members, list)
        self.assertGreater(len(members), 0)
        # Verify required member structure
        first = members[0]
        self.assertIn("handle", first)
        self.assertIn("name", first)
        self.assertIn("avatar_url", first)

    def test_sync_domain_responsibles_to_folders(self):
        custom_domains = [
            {
                "id": "billing",
                "name": "Billing & Payments",
                "description": "Domínio de pagamentos e faturamento.",
                "responsibles": ["@mBaiadori", "@tech-lead"]
            }
        ]
        server.sync_domains_to_repo_folders(self.test_repo, custom_domains)
        domain_file = os.path.join(self.repo_dir, "domains", "billing", "index.md")
        self.assertTrue(os.path.exists(domain_file))
        with open(domain_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("Billing & Payments", content)
    def test_project_ai_assistant_prompt_persistence(self):
        cfg_res = server.get_project_config(self.test_repo)
        cfg = cfg_res["config"]
        self.assertIn("ai_assistant_prompt", cfg)
        self.assertIn("Arquiteto de Fundação", cfg["ai_assistant_prompt"])

        # Test custom prompt save
        custom_prompt = "Você é o Arquiteto Customizado de Crédito e Pagamentos."
        cfg["ai_assistant_prompt"] = custom_prompt
        save_res = server.save_project_config(self.test_repo, cfg)
        self.assertTrue(save_res["success"])

        reloaded = server.get_project_config(self.test_repo)["config"]
        self.assertEqual(reloaded["ai_assistant_prompt"], custom_prompt)

    def test_single_file_workspace_discard(self):
        # 1. Record changes for two files
        server.record_change(self.test_repo, "file_a.md", "ADDED", "", "content a")
        server.record_change(self.test_repo, "file_b.md", "MODIFIED", "old b", "new b")

        cfg = server.load_config()
        changes = cfg.get("workspace_changes", {}).get(self.test_repo, [])
        paths = [c["path"] for c in changes]
        self.assertIn("file_a.md", paths)
        self.assertIn("file_b.md", paths)

        # 2. Simulate single-file discard for file_a.md
        target_path = "file_a.md"
        remaining = [c for c in changes if c["path"] != target_path]
        cfg["workspace_changes"][self.test_repo] = remaining
        server.save_config(cfg)

        # 3. Verify only file_b.md remains
        reloaded_cfg = server.load_config()
        reloaded_changes = reloaded_cfg.get("workspace_changes", {}).get(self.test_repo, [])
        reloaded_paths = [c["path"] for c in reloaded_changes]
        self.assertNotIn("file_a.md", reloaded_paths)
        self.assertIn("file_b.md", reloaded_paths)

    def test_revert_single_change_directory_and_files(self):
        # Test directory deletion revert (should not raise IsADirectoryError)
        dir_change = {
            "path": "domains/administrativo",
            "type": "DELETED",
            "old_content": "",
            "new_content": ""
        }
        # Should execute safely without exception
        server.revert_single_change(self.repo_dir, dir_change)

        # Test file modification revert
        test_file = os.path.join(self.repo_dir, "test_revert.txt")
        with open(test_file, "w") as f:
            f.write("modified")
        file_change = {
            "path": "test_revert.txt",
            "type": "MODIFIED",
            "old_content": "original",
            "new_content": "modified"
        }
        server.revert_single_change(self.repo_dir, file_change)
        with open(test_file, "r") as f:
            content = f.read()
        self.assertEqual(content, "original")

if __name__ == "__main__":
    unittest.main()

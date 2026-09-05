import unittest
import os
import json
import shutil
import tempfile
import server

class TestPRAutoMerge(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.orig_projects_dir = server.PROJECTS_DIR
        self.orig_config_path = server.CONFIG_PATH
        
        server.PROJECTS_DIR = os.path.join(self.test_dir, "projects")
        server.CONFIG_PATH = os.path.join(self.test_dir, "config.json")
        os.makedirs(server.PROJECTS_DIR, exist_ok=True)
        
        # Repositório de teste
        self.repo_dir = os.path.join(server.PROJECTS_DIR, "test-repo")
        os.makedirs(self.repo_dir, exist_ok=True)

    def tearDown(self):
        server.PROJECTS_DIR = self.orig_projects_dir
        server.CONFIG_PATH = self.orig_config_path
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_auto_merge_quorum_execution(self):
        cfg = {
            "active_repo": { "name": "test-repo", "full_name": "org/test-repo" },
            "governance": { "min_approvals": 2, "reviewers": [{"handle": "@lead1"}, {"handle": "@lead2"}] },
            "prs": [
                {
                    "id": 101,
                    "title": "Nova Spec de PIX",
                    "status": "OPEN",
                    "approvals": ["@lead1"],
                    "changes": [
                        {
                            "path": "domains/billing/pix/spec.md",
                            "new_content": "---\nid: l4-billing-pix\ntitle: PIX Spec\n---\n# PIX Spec Content",
                            "type": "ADDED"
                        }
                    ]
                }
            ]
        }
        server.save_config(cfg)

        target = cfg["prs"][0]
        # Simula a segunda aprovação atingindo o quórum (2 de 2)
        target["approvals"].append("@lead2")
        server.execute_pr_merge(target, cfg)

        # 1. Verifica status do PR
        self.assertEqual(target["status"], "MERGED")
        self.assertTrue(bool(target.get("merged_at")))

        # 2. Verifica se o arquivo foi mesclado no workspace
        merged_file = os.path.join(self.repo_dir, "domains/billing/pix/spec.md")
        self.assertTrue(os.path.exists(merged_file))
        with open(merged_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("PIX Spec Content", content)

    def test_auto_merge_governance_rule_update(self):
        cfg = {
            "active_repo": { "name": "test-repo", "full_name": "org/test-repo" },
            "governance": { "min_approvals": 1, "reviewers": [{"handle": "@lead1"}] },
            "prs": [
                {
                    "id": 102,
                    "title": "Atualização de Regra de Governança para 3 aprovações",
                    "status": "OPEN",
                    "approvals": ["@lead1"],
                    "changes": [
                        {
                            "path": "project/governance.json",
                            "new_content": json.dumps({
                                "min_approvals": 3,
                                "reviewers": [{"handle": "@lead1"}, {"handle": "@lead2"}, {"handle": "@lead3"}]
                            }),
                            "type": "MODIFIED"
                        }
                    ]
                }
            ]
        }
        server.save_config(cfg)

        target = cfg["prs"][0]
        server.execute_pr_merge(target, cfg)

        # 1. Verifica se a nova regra de governança foi ativada após o merge
        updated_cfg = server.load_config()
        self.assertEqual(updated_cfg["governance"]["min_approvals"], 3)
        self.assertEqual(len(updated_cfg["governance"]["reviewers"]), 3)

if __name__ == '__main__':
    unittest.main()

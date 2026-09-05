import unittest
import os
import shutil
import json
import copy
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
        self.assertIn("suggested_layers", res)
        self.assertEqual(len(res["suggested_layers"]), 6)
        self.assertEqual(res["suggested_layers"][0]["key"], "L0_FOUNDATION")
        self.assertEqual(res["suggested_layers"][0]["layer_number"], 0)
        self.assertIn("Visão Global", res["suggested_layers"][0]["name"])
        
        self.assertIn("suggested_importance_levels", res)
        self.assertIn("Crítica / Raiz", res["suggested_importance_levels"])
        self.assertIn("Operacional", res["suggested_importance_levels"])
        
        cfg = res["config"]
        self.assertEqual(cfg["project"]["name"], "Test Project Config Repo")
        self.assertEqual(len(cfg["layers"]), 0)
        self.assertIn("canvas_5w2h", cfg)

    def test_save_custom_project_config(self):
        res = server.get_project_config(self.test_repo)
        custom_cfg = res["config"]
        suggested = res["suggested_layers"]
        custom_cfg["project"]["name"] = "Fintech Alpha"
        custom_cfg["layers"] = [copy.deepcopy(suggested[0])]
        custom_cfg["layers"][0]["rules"] = "Regra de ouro: conformidade total com LGPD e auditoria contínua."
        custom_cfg["canvas_5w2h"]["what"] = "Motor de Crédito Especializado"

        save_res = server.save_project_config(self.test_repo, custom_cfg)
        self.assertTrue(save_res["success"])

        # Reload and check
        reloaded = server.get_project_config(self.test_repo)
        self.assertEqual(reloaded["config"]["project"]["name"], "Fintech Alpha")
        self.assertEqual(len(reloaded["config"]["layers"]), 1)
        self.assertEqual(reloaded["config"]["layers"][0]["rules"], "Regra de ouro: conformidade total com LGPD e auditoria contínua.")
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

    def test_dynamic_template_loading_from_disk(self):
        templates = server.load_canonical_templates()
        self.assertIsInstance(templates, list)
        self.assertGreaterEqual(len(templates), 12)
        tpl_ids = [t["id"] for t in templates]
        self.assertIn("project-root", tpl_ids)
        self.assertIn("domain-context", tpl_ids)
        self.assertIn("feature-ideacao", tpl_ids)
        self.assertIn("feature-behavior", tpl_ids)
        # Verify that each template has required fields
        for t in templates:
            self.assertIn("id", t)
            self.assertIn("title", t)
            self.assertIn("content", t)
            self.assertIn("default_filename", t)

    def test_mandatory_structure_directory_creation(self):
        fresh_repo = "fresh_empty_project"
        fresh_dir = os.path.join(server.PROJECTS_DIR, fresh_repo)
        try:
            if os.path.exists(fresh_dir):
                shutil.rmtree(fresh_dir)
            server.ensure_default_repo_files(fresh_repo)
            
            # Check mandatory folders exist
            for d in ["project", "domains", "engenharia", "templates", ".spec-memory"]:
                self.assertTrue(os.path.exists(os.path.join(fresh_dir, d)), f"Folder {d} should exist")
            
            # Check essential files
            self.assertTrue(os.path.exists(os.path.join(fresh_dir, ".spec-memory", "_meta.yaml")))
        finally:
            if os.path.exists(fresh_dir):
                shutil.rmtree(fresh_dir)

    def test_workflows_catalog_and_application(self):
        cfg = server.load_config()
        workflows = cfg.get("workflows", [])
        self.assertIsInstance(workflows, list)
        self.assertGreater(len(workflows), 0)
        
        full_sdlc = next((w for w in workflows if w.get("id") == "full-sdlc"), None)
        self.assertIsNotNone(full_sdlc)
        self.assertGreaterEqual(len(full_sdlc.get("templates", [])), 10)

    def test_save_project_config_syncs_domain_folders(self):
        custom_domains = [
            {
                "id": "billing-custom",
                "name": "Billing & Pagamentos",
                "description": "Gestão financeira e faturamento.",
                "responsibles": ["@marcos", "@andre"]
            },
            {
                "id": "logistica-custom",
                "name": "Logística e Frotas",
                "description": "Gestão de entregas e rotas.",
                "responsibles": ["@operacoes"]
            }
        ]
        payload = {
            "project": {"name": "Test Project", "tagline": "Sync Test"},
            "organization_domains": custom_domains,
            "layers": server.DEFAULT_PROJECT_CONFIG["layers"]
        }
        res = server.save_project_config(self.test_repo, payload)
        self.assertTrue(res.get("success"))

        # Verify physical directories and index.md files created in domains/
        billing_idx = os.path.join(self.repo_dir, "domains", "billing-custom", "index.md")
        logistica_idx = os.path.join(self.repo_dir, "domains", "logistica-custom", "index.md")

        self.assertTrue(os.path.exists(billing_idx))
        self.assertTrue(os.path.exists(logistica_idx))

        with open(billing_idx, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("Billing & Pagamentos", content)
            self.assertIn("@marcos", content)
            self.assertIn("L2_DOMAIN", content)

    def test_sync_domain_and_subdomain_folders(self):
        domain_with_subs = [
            {
                "id": "financeiro",
                "name": "Financeiro",
                "description": "Domínio Financeiro Central",
                "responsibles": ["@cfo"],
                "subdomains": [
                    {
                        "id": "faturamento",
                        "name": "Faturamento & NFe",
                        "description": "Emissão de notas fiscais e impostos.",
                        "responsibles": ["@fiscal"]
                    },
                    {
                        "id": "contas-a-pagar",
                        "name": "Contas a Pagar",
                        "description": "Gestão de obrigações e pagamentos.",
                        "responsibles": ["@tesouraria"]
                    }
                ]
            }
        ]
        server.sync_domains_to_repo_folders(self.test_repo, domain_with_subs)

        dom_index = os.path.join(self.repo_dir, "domains", "financeiro", "index.md")
        sub1_index = os.path.join(self.repo_dir, "domains", "financeiro", "faturamento", "index.md")
        sub2_index = os.path.join(self.repo_dir, "domains", "financeiro", "contas-a-pagar", "index.md")

        self.assertTrue(os.path.exists(dom_index))
        self.assertTrue(os.path.exists(sub1_index))
        self.assertTrue(os.path.exists(sub2_index))

        with open(sub1_index, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("Faturamento & NFe", content)
            self.assertIn("L2_SUBDOMAIN", content)
            self.assertIn("domains/financeiro/index.md", content)
            self.assertIn("@fiscal", content)

        with open(sub2_index, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("Contas a Pagar", content)
            self.assertIn("L2_SUBDOMAIN", content)
            self.assertIn("@tesouraria", content)

    def test_subdomain_collision_prevention(self):
        # Two subdomains with the same ID / name inside the same domain
        domain_with_duplicate_subs = [
            {
                "id": "marketing",
                "name": "Marketing",
                "description": "Domínio de Marketing",
                "subdomains": [
                    { "id": "growth", "name": "Growth", "description": "Growth team 1" },
                    { "id": "growth", "name": "Growth Secundário", "description": "Growth team 2" }
                ]
            }
        ]
        server.sync_domains_to_repo_folders(self.test_repo, domain_with_duplicate_subs)
        sub1 = os.path.join(self.repo_dir, "domains", "marketing", "growth", "index.md")
        sub2 = os.path.join(self.repo_dir, "domains", "marketing", "growth-2", "index.md")
        self.assertTrue(os.path.exists(sub1))
        self.assertTrue(os.path.exists(sub2))

if __name__ == "__main__":
    unittest.main()



import os
import sys
import json
import copy
import time
import datetime
import queue
import threading
import difflib
import subprocess
import mimetypes
import shutil
import urllib.request
import urllib.parse
import urllib.error
import base64
import yaml
import re
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECTS_DIR = os.path.join(BASE_DIR, "projects")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
PROJECTS_CONFIG_PATH = os.path.join(PROJECTS_DIR, "project.config.json")
UI_DIR = os.path.join(BASE_DIR, "ui")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
SERVER_FILE = os.path.abspath(__file__)

# Threading HTTP Server for Non-Blocking SSE & Multi-Requests
class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

# Global SSE Event Queues
SSE_CLIENT_QUEUES = []
SSE_LOCK = threading.Lock()

def broadcast_sse_event(event_type="reload", data="{}"):
    with SSE_LOCK:
        dead_queues = []
        for q in SSE_CLIENT_QUEUES:
            try:
                q.put_nowait((event_type, data))
            except Exception:
                dead_queues.append(q)
        for dq in dead_queues:
            if dq in SSE_CLIENT_QUEUES:
                SSE_CLIENT_QUEUES.remove(dq)

# Background File Watcher for Fast Refresh (UI files + Server Auto-Reload)
def start_file_watcher():
    def watcher_loop():
        file_mtimes = {}
        server_mtime = os.stat(SERVER_FILE).st_mtime if os.path.exists(SERVER_FILE) else 0

        def scan_ui_dir():
            current_mtimes = {}
            if os.path.exists(UI_DIR):
                for root, _, files in os.walk(UI_DIR):
                    for f in files:
                        if f.endswith((".html", ".css", ".js", ".svg", ".png")):
                            fp = os.path.join(root, f)
                            try:
                                current_mtimes[fp] = os.stat(fp).st_mtime
                            except Exception:
                                pass
            return current_mtimes

        file_mtimes = scan_ui_dir()

        while True:
            time.sleep(0.5)

            # 1. Watch server.py (Backend Hot-Reload)
            try:
                if os.path.exists(SERVER_FILE):
                    current_server_mtime = os.stat(SERVER_FILE).st_mtime
                    if server_mtime and current_server_mtime > server_mtime:
                        print("🔄 [Fast Refresh] server.py modificado! Reiniciando processo...")
                        server_mtime = current_server_mtime
                        time.sleep(0.3)
                        os.execv(sys.executable, [sys.executable, SERVER_FILE] + sys.argv[1:])
            except Exception as e:
                print("Erro ao verificar server.py:", e)

            # 2. Watch ui/ static assets ONLY (Frontend Fast Refresh via SSE)
            try:
                scanned = scan_ui_dir()
                changed = False
                for fp, mt in scanned.items():
                    if fp not in file_mtimes or mt > file_mtimes.get(fp, 0):
                        changed = True
                        break
                if changed or len(scanned) != len(file_mtimes):
                    file_mtimes = scanned
                    print("⚡ [Fast Refresh] Alteração detectada em ui/. Disparando Live Reload...")
                    broadcast_sse_event("reload", json.dumps({"timestamp": time.time()}))
            except Exception as e:
                print("Erro no watcher de frontend:", e)

    t = threading.Thread(target=watcher_loop, daemon=True)
    t.start()

def extract_frontmatter(content):
    """
    Extrai metadados YAML (frontmatter) e corpo de arquivos Markdown.
    Retorna tupla: (dicionario_metadados, corpo_markdown).
    """
    if not content or not isinstance(content, str):
        return {}, ""
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            raw_yaml = parts[1]
            body = parts[2]
            try:
                data = yaml.safe_load(raw_yaml)
                if isinstance(data, dict):
                    return data, body
            except Exception:
                pass
    return {}, content

DEFAULT_TEMPLATE_CREATOR_PROMPT = ""
DEFAULT_GLOBAL_SYSTEM_PROMPT = ""
DEFAULT_PROJECT_ABOUT_PROMPT = """Você é o Arquiteto de Fundação & Setup do Framework Context OS / Agentic SDLC.
Sua missão é ajudar o arquiteto e o líder técnico a preencher, refinar, estruturar e evoluir a constituição e identidade do projeto (Sobre o Projeto / Definições Estratégicas).

DIRETRIZES FUNDAMENTAIS:
1. Auxilie na redação precisa do Nome do Projeto, 'Por que fazemos?' (dores e justificativa de negócio), 'O que é o produto?' (escopo funcional e proposta de valor), 'Onde se aplica?' (canais e ecossistema), 'Quando?' (marcos e releases) e 'Como construímos?' (padrões arquiteturais e metodologia).
2. Seja proativo em sugerir melhorias de clareza, alinhamento aos princípios de Domain-Driven Design (DDD) e consistência técnica.
3. Forneça respostas estruturadas e textos prontos para serem aplicados nos campos correspondentes da tela."""

def load_canonical_templates():
    """
    Carrega dinamicamente todos os templates Markdown da pasta templates/ do framework.
    """
    templates = []
    if os.path.exists(TEMPLATES_DIR):
        files = sorted(os.listdir(TEMPLATES_DIR))
        for f in files:
            if f.endswith(".md"):
                fpath = os.path.join(TEMPLATES_DIR, f)
                try:
                    with open(fpath, "r", encoding="utf-8") as file:
                        content = file.read()
                    fm, _ = extract_frontmatter(content)
                    clean_id = re.sub(r"^\d+-", "", f).replace(".md", "")
                    id_aliases = {
                        "domain": "domain-context",
                        "ideacao": "feature-ideacao",
                        "behavior-specs": "feature-behavior",
                    }
                    clean_id = id_aliases.get(clean_id, clean_id)
                    raw_id = fm.get("id") or ""
                    tpl_id = raw_id if (raw_id and "{{" not in str(raw_id)) else clean_id
                    
                    title = fm.get("title")
                    if not title or "{{" in str(title):
                        title = clean_id.replace("-", " ").title()
                    
                    category = fm.get("category") or ("Domain-Driven Design" if "domain" in clean_id else "Esteira SDLC")
                    badge = fm.get("badge") or fm.get("layer") or "Template"
                    description = fm.get("description") or f"Template oficial {f}"
                    default_filename = fm.get("default_filename") or f"{clean_id}.md"
                    suggested_folder = fm.get("suggested_folder") or "domains"
                    assistant_prompt = fm.get("assistant_prompt") or ""

                    templates.append({
                        "id": tpl_id,
                        "title": title,
                        "category": category,
                        "badge": badge,
                        "description": description,
                        "default_filename": default_filename,
                        "suggested_folder": suggested_folder,
                        "assistant_prompt": assistant_prompt,
                        "content": content,
                        "source_file": f
                    })
                except Exception as e:
                    print(f"Erro ao carregar template {f}: {e}")
    return templates

# Singleton / alias para compatibilidade com partes existentes
CANONICAL_TEMPLATES = load_canonical_templates()

def load_canonical_tutorials():
    """
    Carrega dinamicamente os guias e tutoriais da base de documentação oficial.
    """
    tutorials = []
    doc_files = [
        {
            "id": "spec-driven-governance",
            "file": "spec-driven-governance-vision.md",
            "title": "Governança Orientada a Especificação (Spec-Driven SDLC)",
            "category": "Fundamentos SDLC",
            "badge": "Arquitetura",
            "read_time": "5 min"
        },
        {
            "id": "architectural-patterns",
            "file": "architectural-patterns.md",
            "title": "Padrões Arquiteturais & Domain-Driven Design (DDD)",
            "category": "Domain-Driven Design",
            "badge": "DDD",
            "read_time": "4 min"
        },
        {
            "id": "memory-ai",
            "file": "memory-ai.md",
            "title": "Memória Viva, Continuidade de Contexto & IA",
            "category": "Inteligência Artificial",
            "badge": "AI Memory",
            "read_time": "5 min"
        },
        {
            "id": "agents-instruction",
            "file": "agents-instruction.md",
            "title": "Protocolos de Operação e Instruções para Agentes",
            "category": "Agentes & Automação",
            "badge": "Agentes",
            "read_time": "3 min"
        }
    ]

    for item in doc_files:
        fpath = os.path.join(BASE_DIR, item["file"])
        if os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
                tutorials.append({
                    "id": item["id"],
                    "title": item["title"],
                    "category": item["category"],
                    "badge": item["badge"],
                    "read_time": item["read_time"],
                    "content": content
                })
            except Exception as e:
                print(f"Erro ao carregar tutorial {item['file']}: {e}")
    return tutorials

CANONICAL_TUTORIALS = load_canonical_tutorials()

def load_projects_master_config():
    """
    Carrega as diretrizes, recomendações e estrutura padrão dos projetos (projects/project.config.json).
    """
    if os.path.exists(PROJECTS_CONFIG_PATH):
        try:
            with open(PROJECTS_CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Erro ao carregar {PROJECTS_CONFIG_PATH}: {e}")
    
    # Fallback de compatibilidade se ainda existir projects/config.json
    legacy_path = os.path.join(PROJECTS_DIR, "config.json")
    if os.path.exists(legacy_path):
        try:
            with open(legacy_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    return {
        "mandatory_structure": {
            "directories": [
                "project", "domains", "engenharia", "templates",
                ".spec-memory/_rules", ".spec-memory/concepts", ".spec-memory/decisions",
                ".spec-memory/gotchas", ".spec-memory/handoffs", ".spec-memory/sessions"
            ],
            "essential_files": [
                {
                    "path": ".spec-memory/_meta.yaml",
                    "content": "version: 1.0\ninitialized: true\n"
                }
            ]
        },
        "project_defaults": {
            "version": "1.0.0",
            "layers": [],
            "tags": [],
            "statuses": [],
            "governance_rules": { "min_approvals_default": 1 },
            "default_reviewers": []
        },
        "suggested_domains": [],
        "workflows": [],
        "default_project_about_prompt": DEFAULT_PROJECT_ABOUT_PROMPT
    }

def save_projects_master_config(cfg):
    """
    Salva as diretrizes e padrões de projeto em projects/project.config.json.
    """
    os.makedirs(PROJECTS_DIR, exist_ok=True)
    with open(PROJECTS_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

def load_config():
    """
    Carrega a configuração global da ferramenta (config.json na raiz).
    """
    canonical = load_canonical_templates()
    cfg = {}
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception as e:
            print(f"Erro ao carregar {CONFIG_PATH}: {e}")
    
    if not cfg:
        cfg = {
            "authenticated": False,
            "token": "",
            "ai_settings": {
                "provider": "gemini",
                "model": "gemini-3.5-flash",
                "api_key": os.environ.get("GEMINI_API_KEY", ""),
                "custom_endpoint": "http://localhost:11434/v1"
            },
            "settings": {
                "auto_pr_on_save": False,
                "template_creator_prompt": DEFAULT_TEMPLATE_CREATOR_PROMPT,
                "global_system_prompt": DEFAULT_GLOBAL_SYSTEM_PROMPT
            },
            "workspace_changes": {},
            "user": None,
            "orgs": [],
            "active_repo": None,
            "prs": []
        }
    
    # Injeta templates e workflows para compatibilidade com a UI
    cfg["templates"] = canonical
    master = load_projects_master_config()
    if "workflows" not in cfg or not cfg["workflows"]:
        cfg["workflows"] = master.get("workflows", [])
    return cfg

def get_default_project_config(repo_name=""):
    master_cfg = load_projects_master_config()
    defaults = master_cfg.get("project_defaults", {})
    name = repo_name.replace("-", " ").replace("_", " ").title() if (repo_name and repo_name != "local") else ""
    return {
        "project": {
            "name": name,
            "description": "",
            "version": defaults.get("version", "1.0.0"),
            "architecture_pattern": "",
            "repository_url": "",
            "lead": ""
        },
        "canvas_5w2h": {
            "what": "", "why": "", "who": "", "where": "", "when": "", "how": "", "how_much": ""
        },
        "organization_domains": [],
        "layers": defaults.get("layers", []),
        "tags": defaults.get("tags", []),
        "statuses": defaults.get("statuses", []),
        "governance_rules": defaults.get("governance_rules", { "min_approvals_default": 1 }),
        "reviewers": defaults.get("default_reviewers", []),
        "ai_assistant_prompt": master_cfg.get("default_project_about_prompt") or DEFAULT_PROJECT_ABOUT_PROMPT
    }

# Dynamic fallbacks derived from config
DEFAULT_PROJECT_CONFIG = get_default_project_config()
FRAMEWORK_SUGGESTED_DOMAINS = []

def save_config(cfg):
    """
    Salva a configuração da ferramenta no config.json raiz (sem poluir com templates embutidos).
    """
    clean_cfg = copy.deepcopy(cfg)
    clean_cfg.pop("templates", None)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(clean_cfg, f, indent=2, ensure_ascii=False)

def record_change(repo_name, file_path, change_type, old_content="", new_content=""):
    cfg = load_config()
    if "workspace_changes" not in cfg:
        cfg["workspace_changes"] = {}
    if repo_name not in cfg["workspace_changes"]:
        cfg["workspace_changes"][repo_name] = []

    changes = cfg["workspace_changes"][repo_name]
    existing = next((c for c in changes if c["path"] == file_path), None)

    if existing:
        if existing["type"] == "ADDED" and change_type == "DELETED":
            changes.remove(existing)
        else:
            existing["type"] = change_type if existing["type"] != "ADDED" else "ADDED"
            existing["new_content"] = new_content
            existing["timestamp"] = time.strftime("%H:%M:%S")
    else:
        changes.append({
            "path": file_path,
            "type": change_type,
            "old_content": old_content,
            "new_content": new_content,
            "timestamp": time.strftime("%H:%M:%S")
        })

    cfg["workspace_changes"][repo_name] = changes
    save_config(cfg)

def compute_diff(old_text, new_text, filename="arquivo"):
    old_lines = old_text.splitlines(keepends=True)
    new_lines = new_text.splitlines(keepends=True)
    diff = list(difflib.unified_diff(old_lines, new_lines, fromfile=f"a/{filename}", tofile=f"b/{filename}"))
    
    additions = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    deletions = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))
    
    return {
        "diff_text": "".join(diff),
        "additions": additions,
        "deletions": deletions
    }

def call_github_api(endpoint, token, method="GET", data=None):
    url = f"https://api.github.com{endpoint}" if endpoint.startswith("/") else endpoint
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Agentic-SDLC-Governance-Boilerplate"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    req_body = None
    if data is not None:
        req_body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"message": err_body}
        return e.code, err_json
    except Exception as e:
        return 500, {"message": str(e)}

def ensure_default_repo_files(repo_name):
    """
    Garante a existência das pastas e arquivos estruturais do projeto
    definidos na seção 'mandatory_structure' de projects/project.config.json.
    """
    if not repo_name:
        return
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    master_cfg = load_projects_master_config()
    mandatory = master_cfg.get("mandatory_structure", {})
    directories = mandatory.get("directories", ["project", "domains", "engenharia", "templates", ".spec-memory"])
    essential_files = mandatory.get("essential_files", [])

    for folder in directories:
        os.makedirs(os.path.join(repo_dir, folder), exist_ok=True)

    for ef in essential_files:
        ef_path = ef.get("path")
        if ef_path:
            target = os.path.join(repo_dir, ef_path)
            if not os.path.exists(target):
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, "w", encoding="utf-8") as f:
                    f.write(ef.get("content", ""))

def sync_5w2h_to_index_md(repo_name, canvas_5w2h, project_info=None):
    """
    Sincroniza a tabela de definições estratégicas oficial com o arquivo index.md do projeto apenas se index.md já existir.
    """
    if not canvas_5w2h:
        return
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    index_path = os.path.join(repo_dir, "index.md")
    if not os.path.exists(index_path):
        index_path = os.path.join(repo_dir, "project", "index.md")
    if not os.path.exists(index_path):
        return

    what = canvas_5w2h.get("what", "")
    why = canvas_5w2h.get("why", "")
    who = canvas_5w2h.get("who", "")
    where = canvas_5w2h.get("where", "")
    when = canvas_5w2h.get("when", "")
    how = canvas_5w2h.get("how", "")
    how_much = canvas_5w2h.get("how_much", "")

    new_table = f"""| Dimensão Estratégica | Pergunta Chave | Definição do Projeto |
| :--- | :--- | :--- |
| **What** (O que é) | Qual é o produto, escopo e proposta de valor? | *{what}* |
| **Why** (Por que fazer) | Qual a justificativa de negócio e problema resolvido? | *{why}* |
| **Who** (Quem são) | Quem são os stakeholders, personas e times responsáveis? | *{who}* |
| **Where** (Onde se aplica) | Quais Bounded Contexts, canais e ecossistemas abrangidos? | *{where}* |
| **When** (Quando) | Quais são os marcos (milestones) e prazos de entrega? | *{when}* |
| **How** (Como será feito) | Qual a arquitetura, padrões e tecnologias chave? | *{how}* |
| **How Much** (Quanto) | Qual é a volumetria, SLAs, orçamentos e capacidade? | *{how_much}* |"""

    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        old_content = content

        pattern = r"(\| Dimensão (?:Estratégica|\(5W2H\)).*?)(?=\n\n---|\n##|\Z)"
        if re.search(pattern, content, flags=re.DOTALL):
            updated_content = re.sub(pattern, new_table, content, count=1, flags=re.DOTALL)
        else:
            updated_content = content + f"\n\n## 🎯 1. Estrutura Estratégica\n\n{new_table}\n"

        if updated_content != old_content:
            with open(index_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
            rel_p = os.path.relpath(index_path, repo_dir).replace("\\", "/")
            record_change(repo_name, rel_p, "MODIFIED", old_content, updated_content)

def get_project_config(repo_name):
    """
    Retorna a configuração oficial do projeto ativo ou preset padrão.
    """
    master_cfg = load_projects_master_config()
    suggested_domains = master_cfg.get("suggested_domains", [])
    suggested_layers = master_cfg.get("suggested_layers", [])
    suggested_importance_levels = master_cfg.get("suggested_importance_levels", [])
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    config_file = os.path.join(repo_dir, "project", "project.config.json")
    if not os.path.exists(config_file):
        root_config = os.path.join(repo_dir, "project.config.json")
        if os.path.exists(root_config):
            config_file = root_config

    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "config": data,
                    "is_customized": True,
                    "repo_name": repo_name,
                    "suggested_domains": suggested_domains,
                    "suggested_layers": suggested_layers,
                    "suggested_importance_levels": suggested_importance_levels,
                    "config_path": os.path.relpath(config_file, repo_dir).replace("\\", "/")
                }
        except Exception as e:
            print(f"Erro ao ler {config_file}: {e}")

    default_cfg = copy.deepcopy(DEFAULT_PROJECT_CONFIG)
    if repo_name and repo_name != "local":
        default_cfg["project"]["name"] = repo_name.replace("-", " ").replace("_", " ").title()
    return {
        "config": default_cfg,
        "is_customized": False,
        "repo_name": repo_name,
        "suggested_domains": suggested_domains,
        "suggested_layers": suggested_layers,
        "suggested_importance_levels": suggested_importance_levels,
        "config_path": "project/project.config.json"
    }

def generate_policies_markdown(policies_data, project_name=""):
    """
    Gera o documento compilado project/policies.md com frontmatter e seções de regulação/conformidade.
    """
    if not isinstance(policies_data, dict):
        return ""
    if policies_data.get("markdown_content") and policies_data.get("markdown_content").strip():
        return policies_data.get("markdown_content").strip()
    
    regulators = policies_data.get("regulators", [])
    regulators_str = ", ".join(regulators) if isinstance(regulators, list) and regulators else "Conformidade Geral"
    
    md = f"""---
type: "policies"
version: "1.0.0"
status: "approved"
layer: "L0_FOUNDATION"
path: "project/policies.md"
dpo_contact: "{policies_data.get('dpo_contact', '')}"
regulators: {json.dumps(regulators, ensure_ascii=False) if isinstance(regulators, list) else '[]'}
---

# 📜 Políticas de Negócio, Regulação & Leis Mandatórias

> Este documento define os órgãos reguladores, marcos legais e restrições inegociáveis que o projeto **{project_name or 'do Sistema'}** deve obedecer.

---

## 🏛️ 1. Órgãos Reguladores & Marco Legal
- **Órgãos Fiscalizadores:** {regulators_str}
- **Leis & Normas Mandatórias:**
{policies_data.get('laws', 'Não especificado.')}

---

## ⚖️ 2. Regras Mandatórias de Negócio (Hard Rules)
- **Direito de Arrependimento & Cancelamento:** {policies_data.get('cancellation_policy', 'Conforme legislação aplicável.')}
- **Política de Estorno & Devolução Financeira:** {policies_data.get('refund_policy', 'Conforme termos de serviço.')}
- **Retenção Legal de Dados & Documentos:** {policies_data.get('retention_policy', 'Conforme prazos legais.')}
- **SLA & Atendimento ao Consumidor:** {policies_data.get('sla_support', 'Conforme padrão de atendimento.')}

---

## 🔒 3. Privacidade, Dados Pessoais & LGPD / GDPR
- **Encarregado de Dados (DPO):** {policies_data.get('dpo_contact', 'dpo@empresa.com')}
- **Consentimento & Opt-in:** {policies_data.get('consent_policy', 'Consentimento explícito e granular.')}
- **Tratamento de Dados Sensíveis & Logs:**
{policies_data.get('sensitive_data_policy', 'Proibição de dados sensíveis em logs e telemetria aberta.')}
"""
    return md.strip()

def save_project_config(repo_name, post_data):
    """
    Grava project/project.config.json e project/policies.md e registra MODIFIED no workspace staging para PR.
    """
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    project_dir = os.path.join(repo_dir, "project")
    os.makedirs(project_dir, exist_ok=True)
    config_file = os.path.join(project_dir, "project.config.json")

    config_data = post_data.get("config", post_data) if isinstance(post_data, dict) else DEFAULT_PROJECT_CONFIG

    old_content = ""
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                old_content = f.read()
        except Exception:
            pass

    new_content = json.dumps(config_data, indent=2, ensure_ascii=False)
    with open(config_file, "w", encoding="utf-8") as f:
        f.write(new_content)

    rel_path = "project/project.config.json"
    change_type = "MODIFIED" if old_content else "ADDED"
    record_change(repo_name, rel_path, change_type, old_content, new_content)

    # Sincroniza o documento project/policies.md se houver políticas preenchidas
    policies_data = config_data.get("policies")
    if isinstance(policies_data, dict):
        proj_name = (config_data.get("project") or {}).get("name", "")
        policies_md_content = generate_policies_markdown(policies_data, proj_name)
        policies_file = os.path.join(project_dir, "policies.md")
        old_pol_content = ""
        if os.path.exists(policies_file):
            try:
                with open(policies_file, "r", encoding="utf-8") as pf:
                    old_pol_content = pf.read()
            except Exception:
                pass
        with open(policies_file, "w", encoding="utf-8") as pf:
            pf.write(policies_md_content)
        pol_change_type = "MODIFIED" if old_pol_content else "ADDED"
        record_change(repo_name, "project/policies.md", pol_change_type, old_pol_content, policies_md_content)

    # Sincroniza e cria as pastas oficiais em domains/ para os domínios definidos no projeto
    org_domains = config_data.get("organization_domains", [])
    if isinstance(org_domains, list) and len(org_domains) > 0:
        sync_domains_to_repo_folders(repo_name, org_domains)

    return {
        "success": True,
        "config": config_data,
        "repo_name": repo_name,
        "message": "Configurações oficiais do projeto salvas e políticas sincronizadas com sucesso!"
    }

def revert_single_change(repo_dir, change):
    """
    Restaura um arquivo ou diretório alterado com segurança para o estado anterior (old_content).
    Trata erros de I/O, diretórios versus arquivos e caminhos ausentes.
    """
    if not isinstance(change, dict):
        return
    rel_path = (change.get("path") or "").strip().lstrip("/")
    if not rel_path:
        return
    
    full_path = os.path.join(repo_dir, rel_path)
    change_type = change.get("type", "MODIFIED")
    old_content = change.get("old_content")

    try:
        if change_type == "ADDED":
            if os.path.isdir(full_path):
                shutil.rmtree(full_path, ignore_errors=True)
            elif os.path.exists(full_path):
                os.remove(full_path)
        elif change_type in ("MODIFIED", "DELETED"):
            if old_content is not None and old_content != "":
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                if os.path.isdir(full_path):
                    shutil.rmtree(full_path, ignore_errors=True)
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(old_content)
            elif change_type == "DELETED" and not old_content:
                if not os.path.splitext(rel_path)[1]:
                    os.makedirs(full_path, exist_ok=True)
    except Exception as e:
        print(f"[Discard Warning] Não foi possível reverter '{rel_path}': {e}")

def sync_domains_to_repo_folders(repo_name, organization_domains):
    """
    Cria as pastas físicas e arquivos oficiais em domains/ correspondentes a cada domínio corporativo,
    registrando metadados de escopo e responsáveis identificados.
    """
    if not repo_name or not isinstance(organization_domains, list):
        return
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    domains_dir = os.path.join(repo_dir, "domains")
    os.makedirs(domains_dir, exist_ok=True)

    for d in organization_domains:
        if not isinstance(d, dict):
            continue
        dom_id = (d.get("id") or d.get("name", "").lower()).strip().replace(" ", "-").replace("_", "-")
        dom_id = re.sub(r'[^a-zA-Z0-9\-]', '', dom_id).lower()
        if not dom_id:
            continue
        dom_name = d.get("name") or dom_id.capitalize()
        dom_desc = d.get("description") or f"Área de domínio de {dom_name}."
        responsibles = d.get("responsibles") or []
        if isinstance(responsibles, str):
            responsibles = [r.strip() for r in responsibles.split(",") if r.strip()]
        
        resp_str = ", ".join(responsibles) if responsibles else "Equipe do Projeto"

        dom_path = os.path.join(domains_dir, dom_id)
        os.makedirs(dom_path, exist_ok=True)

        index_file = os.path.join(dom_path, "index.md")
        if not os.path.exists(index_file):
            resp_yaml = json.dumps(responsibles, ensure_ascii=False)
            content = f"""---
type: "domain"
version: "1.0.0"
status: "draft"
layer: "L2_DOMAIN"
domain: "{dom_id}"
responsibles: {resp_yaml}
path: "domains/{dom_id}/index.md"
---

# 🏛️ Domínio: {dom_name}

> {dom_desc}

**Responsáveis pelo Domínio:** {resp_str}

---

## 🎯 Escopo & Responsabilidades

{dom_desc}

## 📁 Subdomínios & Features

Este diretório gerencia as especificações, fluxos e regras de negócio relativas a **{dom_name}**.
"""
            with open(index_file, "w", encoding="utf-8") as f:
                f.write(content)
            record_change(repo_name, f"domains/{dom_id}/index.md", "ADDED", "", content)

        # Sincroniza Subdomínios físicos dentro de domains/{dom_id}/{sub_id}/
        subdomains = d.get("subdomains") or []
        if isinstance(subdomains, list):
            seen_subs = set()
            for sub in subdomains:
                if not isinstance(sub, dict):
                    continue
                raw_sub_id = (sub.get("id") or sub.get("name", "").lower()).strip().replace(" ", "-").replace("_", "-")
                sub_id = re.sub(r'[^a-zA-Z0-9\-]', '', raw_sub_id).lower().strip("-")
                if not sub_id:
                    continue

                # Evita colisões de subpastas no mesmo domínio
                base_sub_id = sub_id
                counter = 2
                while sub_id in seen_subs:
                    sub_id = f"{base_sub_id}-{counter}"
                    counter += 1
                seen_subs.add(sub_id)

                sub_name = sub.get("name") or sub_id.capitalize()
                sub_desc = sub.get("description") or f"Subdomínio e capacidade funcional de {sub_name} em {dom_name}."
                sub_resps = sub.get("responsibles") or responsibles
                if isinstance(sub_resps, str):
                    sub_resps = [r.strip() for r in sub_resps.split(",") if r.strip()]
                sub_resp_str = ", ".join(sub_resps) if sub_resps else resp_str
                sub_resp_yaml = json.dumps(sub_resps, ensure_ascii=False)

                sub_path = os.path.join(dom_path, sub_id)
                os.makedirs(sub_path, exist_ok=True)

                sub_index_file = os.path.join(sub_path, "index.md")
                if not os.path.exists(sub_index_file):
                    sub_content = f"""---
type: "subdomain"
version: "1.0.0"
status: "draft"
layer: "L2_SUBDOMAIN"
domain: "{dom_id}"
subdomain: "{sub_id}"
responsibles: {sub_resp_yaml}
path: "domains/{dom_id}/{sub_id}/index.md"
parent: "domains/{dom_id}/index.md"
---

# 🧩 Subdomínio: {sub_name}

> {sub_desc}

**Domínio Pai:** [{dom_name}](../index.md)  
**Responsáveis pelo Subdomínio:** {sub_resp_str}

---

## 🎯 Capacidades & Escopo

{sub_desc}

## 🚀 Features & Especificações

Este subdomínio organiza os módulos funcionais, regras de negócio e especificações técnicas de **{sub_name}** sob o domínio **{dom_name}**.
"""
                    with open(sub_index_file, "w", encoding="utf-8") as f:
                        f.write(sub_content)
                    record_change(repo_name, f"domains/{dom_id}/{sub_id}/index.md", "ADDED", "", sub_content)


def get_project_team_members(repo_name):
    """
    Retorna a lista unificada de membros do time associados ao repositório:
    1. Contribuidores e colaboradores via GitHub API (se autenticado e conectado a um repo remoto).
    2. Usuário autenticado ativo (/user).
    3. Autores de commits extraídos do histórico Git local (git log).
    4. Reviewers e responsáveis já configurados na governança.
    """
    members = []
    seen_handles = set()

    cfg = load_config()
    token = cfg.get("token", "")
    user = cfg.get("user")
    active_repo = cfg.get("active_repo")

    # 1. Usuário atual logado
    if user and isinstance(user, dict):
        login = user.get("login", "")
        if login:
            handle = f"@{login.lstrip('@')}"
            seen_handles.add(handle.lower())
            seen_handles.add(login.lower())
            members.append({
                "login": login,
                "name": user.get("name") or login,
                "handle": handle,
                "avatar_url": user.get("avatar_url") or f"https://github.com/{login}.png",
                "email": user.get("email") or "",
                "role": "Tech Lead / Owner",
                "source": "github_auth"
            })

    # 2. Consultar GitHub API para contributors e collaborators se houver repo ativo
    if token and active_repo and isinstance(active_repo, dict):
        full_name = active_repo.get("full_name") or f"{active_repo.get('owner', {}).get('login', '')}/{active_repo.get('name', '')}"
        if "/" in full_name and not full_name.startswith("/"):
            # Obter contributors
            status, gh_contribs = call_github_api(f"/repos/{full_name}/contributors?per_page=100", token)
            if status == 200 and isinstance(gh_contribs, list):
                for c in gh_contribs:
                    login = c.get("login")
                    if login and login.lower() not in seen_handles:
                        handle = f"@{login}"
                        seen_handles.add(login.lower())
                        seen_handles.add(handle.lower())
                        members.append({
                            "login": login,
                            "name": login,
                            "handle": handle,
                            "avatar_url": c.get("avatar_url") or f"https://github.com/{login}.png",
                            "email": "",
                            "role": "Contribuidor",
                            "source": "github_contributors"
                        })

            # Obter collaborators
            status_collab, gh_collabs = call_github_api(f"/repos/{full_name}/collaborators?per_page=100", token)
            if status_collab == 200 and isinstance(gh_collabs, list):
                for c in gh_collabs:
                    login = c.get("login")
                    if login and login.lower() not in seen_handles:
                        handle = f"@{login}"
                        seen_handles.add(login.lower())
                        seen_handles.add(handle.lower())
                        members.append({
                            "login": login,
                            "name": login,
                            "handle": handle,
                            "avatar_url": c.get("avatar_url") or f"https://github.com/{login}.png",
                            "email": "",
                            "role": "Colaborador",
                            "source": "github_collaborators"
                        })

    # 3. Extrair autores locais do Git (git log)
    repo_dirs_to_check = []
    if repo_name and repo_name != "local":
        repo_dirs_to_check.append(os.path.join(PROJECTS_DIR, repo_name))
    repo_dirs_to_check.append(BASE_DIR)

    for r_dir in repo_dirs_to_check:
        if os.path.exists(os.path.join(r_dir, ".git")):
            try:
                res = subprocess.run(
                    ["git", "log", "-n", "100", "--format=%an|%ae"],
                    cwd=r_dir,
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if res.returncode == 0 and res.stdout:
                    for line in res.stdout.strip().split("\n"):
                        if not line or "|" not in line:
                            continue
                        name, email = line.split("|", 1)
                        name = name.strip()
                        email = email.strip()
                        norm_key = name.lower()
                        if norm_key and norm_key not in seen_handles and name != "root" and not name.startswith("github-actions"):
                            handle = f"@{re.sub(r'[^a-zA-Z0-9_]', '', name)}"
                            seen_handles.add(norm_key)
                            seen_handles.add(handle.lower())
                            members.append({
                                "login": name,
                                "name": name,
                                "handle": handle,
                                "avatar_url": f"https://ui-avatars.com/api/?name={urllib.parse.quote(name)}&background=6366f1&color=fff",
                                "email": email,
                                "role": "Engenheiro / Contribuidor",
                                "source": "git_local"
                            })
            except Exception as e:
                pass

    # 4. Reviewers já cadastrados na governança
    gov_reviewers = cfg.get("governance", {}).get("reviewers", [])
    for r in gov_reviewers:
        handle = (r.get("handle") or "").strip()
        name = (r.get("name") or "").strip()
        if handle and handle.lower() not in seen_handles:
            seen_handles.add(handle.lower())
            members.append({
                "login": handle.lstrip("@"),
                "name": name or handle,
                "handle": handle if handle.startswith("@") else f"@{handle}",
                "avatar_url": f"https://ui-avatars.com/api/?name={urllib.parse.quote(name or handle)}&background=3b82f6&color=fff",
                "email": "",
                "role": r.get("role") or "Reviewer",
                "source": "governance_config"
            })

    # Fallback se a lista estiver vazia
    if not members:
        members = [
            {
                "login": "tech-lead",
                "name": "Tech Lead do Projeto",
                "handle": "@tech-lead",
                "avatar_url": "https://ui-avatars.com/api/?name=Tech+Lead&background=6366f1&color=fff",
                "email": "lead@projeto.local",
                "role": "Tech Lead",
                "source": "default"
            },
            {
                "login": "arquiteto",
                "name": "Arquiteto de Software",
                "handle": "@arquiteto",
                "avatar_url": "https://ui-avatars.com/api/?name=Arquiteto&background=10b981&color=fff",
                "email": "arquiteto@projeto.local",
                "role": "Arquiteto",
                "source": "default"
            }
        ]

    return members

def reset_project_config(repo_name):
    """
    Restaura as configurações oficiais para o preset recomendado pelo framework.
    """
    default_cfg = copy.deepcopy(DEFAULT_PROJECT_CONFIG)
    if repo_name and repo_name != "local":
        default_cfg["project"]["name"] = repo_name.replace("-", " ").replace("_", " ").title()
    return save_project_config(repo_name, default_cfg)

def check_repo_governance_status(repo_name):
    """
    Verifica o status de configuração e governança do repositório ativo diretamente no sistema de arquivos / Git.
    """
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    ensure_default_repo_files(repo_name)

    config_exists = os.path.exists(os.path.join(repo_dir, "project", "project.config.json")) or os.path.exists(os.path.join(repo_dir, "project.config.json"))
    index_exists = os.path.exists(os.path.join(repo_dir, "project", "index.md")) or os.path.exists(os.path.join(repo_dir, "index.md"))

    doc_count = 0
    for root, _, files in os.walk(repo_dir):
        for f in files:
            if f.endswith(".md"):
                doc_count += 1

    # O projeto é considerado configurado se o arquivo de config ou index.md oficial já existirem
    is_configured = config_exists or index_exists or (doc_count > 0)

    return {
        "is_initialized": True,
        "is_configured": is_configured,
        "config_exists": config_exists,
        "index_exists": index_exists,
        "repo_name": repo_name,
        "total_docs": doc_count
    }

def bootstrap_repo_governance(repo_name, starter_pack="standard"):
    """
    Inicializa a estrutura oficial de governança de forma transparente.
    """
    ensure_default_repo_files(repo_name)

    return {
        "success": True,
        "repo_name": repo_name,
        "starter_pack": starter_pack,
        "installed_templates_count": 0,
        "message": f"Estrutura padrão de pastas pronta para {repo_name}!"
    }

def get_installed_repo_templates(repo_name):
    """
    Lista todos os templates existentes na pasta templates/ do repositório ativo.
    """
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    templates_dir = os.path.join(repo_dir, "templates")
    if not os.path.exists(templates_dir):
        return []

    installed = []
    for f in os.listdir(templates_dir):
        if f.endswith(".md"):
            fpath = os.path.join(templates_dir, f)
            with open(fpath, "r", encoding="utf-8") as file:
                content = file.read()
            meta, body = extract_frontmatter(content)
            title = meta.get("title") or f.replace(".md", "").replace("-", " ").title()
            installed.append({
                "id": meta.get("id") or f.replace(".md", ""),
                "title": title,
                "default_filename": f,
                "category": meta.get("layer") or "Projeto Local",
                "badge": "Instalado",
                "description": f"Template local instalado em templates/{f}",
                "content": content,
                "assistant_prompt": f"Você é o assistente especialista no template {title}.",
                "is_installed": True
            })
    return installed

def get_engineering_files(repo_name):
    """
    Lista todos os documentos técnicos e padrões arquiteturais dentro de engenharia/ do repositório.
    """
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    eng_dir = os.path.join(repo_dir, "engenharia")
    if not os.path.exists(eng_dir):
        return []

    files_list = []
    for root, _, files in os.walk(eng_dir):
        for f in files:
            if f.endswith(".md"):
                fpath = os.path.join(root, f)
                rel_path = os.path.relpath(fpath, repo_dir).replace("\\", "/")
                try:
                    with open(fpath, "r", encoding="utf-8") as file:
                        content = file.read()
                    meta, body = extract_frontmatter(content)
                    title = meta.get("title") or f.replace(".md", "").replace("-", " ").title()
                    category = meta.get("category") or (
                        "ADR" if "adr" in rel_path.lower() else (
                            "Event-Driven & Mensageria" if "event" in rel_path.lower() or "kafka" in rel_path.lower() else (
                                "APIs & Contratos" if "api" in rel_path.lower() or "contract" in rel_path.lower() else (
                                    "Infra & Observabilidade" if "infra" in rel_path.lower() or "obs" in rel_path.lower() else "Padrão de Engenharia"
                                )
                            )
                        )
                    )
                    files_list.append({
                        "id": meta.get("id") or rel_path.replace("/", "-").replace(".md", ""),
                        "path": rel_path,
                        "filename": f,
                        "title": title,
                        "category": category,
                        "status": meta.get("status", "active").upper(),
                        "layer": meta.get("layer", "L4_ARTIFACT"),
                        "description": meta.get("description") or f"Padrão arquitetural em {rel_path}",
                        "content": content,
                        "assistant_prompt": f"Você é o Arquiteto de Software e Engenharia especialista no padrão: {title}."
                    })
                except Exception:
                    pass
    return files_list

def get_project_dictionary(repo_name):
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    dict_path = os.path.join(repo_dir, "project", "dictionary.json")
    if not os.path.exists(dict_path):
        dict_path = os.path.join(repo_dir, "dictionary.json")
    
    if os.path.exists(dict_path):
        try:
            with open(dict_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    cfg = load_config()
    return cfg.get("default_dictionary_terms", [])

def save_project_dictionary(repo_name, terms):
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    os.makedirs(os.path.join(repo_dir, "project"), exist_ok=True)
    dict_path = os.path.join(repo_dir, "project", "dictionary.json")
    old_content = ""
    change_type = "ADDED"
    if os.path.exists(dict_path):
        try:
            with open(dict_path, "r", encoding="utf-8") as f:
                old_content = f.read()
            change_type = "MODIFIED"
        except Exception:
            pass
    formatted_json = json.dumps(terms, indent=2, ensure_ascii=False)
    with open(dict_path, "w", encoding="utf-8") as f:
        f.write(formatted_json)
    record_change(repo_name, "project/dictionary.json", change_type, old_content, formatted_json)
    return True

def get_project_domains_and_docs(repo_name):
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    domains = set()
    documents = []
    
    # 1. Obter domínios da pasta domains/
    domains_dir = os.path.join(repo_dir, "domains")
    if os.path.exists(domains_dir):
        for item in os.listdir(domains_dir):
            full = os.path.join(domains_dir, item)
            if os.path.isdir(full) and not item.startswith("."):
                domains.add(item.lower())
    
    # 2. Obter documentos
    if os.path.exists(repo_dir):
        for root, _, files in os.walk(repo_dir):
            if any(part.startswith(".") or part in ["node_modules", ".git", "venv"] for part in root.split(os.sep)):
                continue
            for f in sorted(files):
                if f.endswith(".md"):
                    fpath = os.path.join(root, f)
                    rel_path = os.path.relpath(fpath, repo_dir).replace("\\", "/")
                    try:
                        with open(fpath, "r", encoding="utf-8") as file:
                            content = file.read()
                        meta, _ = extract_frontmatter(content)
                        doc_id = meta.get("id") or rel_path.replace("/", "-").replace(".md", "")
                        doc_title = meta.get("title") or f.replace(".md", "").replace("-", " ").title()
                        doc_layer = meta.get("layer") or "L4_ARTIFACT"
                        doc_domain = meta.get("domain") or (rel_path.split("/")[1] if rel_path.startswith("domains/") and len(rel_path.split("/")) > 1 else "core")
                        if doc_domain:
                            domains.add(doc_domain.lower())
                        documents.append({
                            "id": doc_id,
                            "title": doc_title,
                            "path": rel_path,
                            "layer": doc_layer,
                            "domain": doc_domain
                        })
                    except Exception:
                        pass
                        
    if not domains:
        domains = {"core", "billing", "identidade", "arquitetura"}
        
    return {
        "domains": sorted(list(domains)),
        "documents": documents
    }

def check_project_sync_status(repo_name):
    cfg = load_config()
    token = cfg.get("token", "")
    active_repo = cfg.get("active_repo", {})
    raw_changes = cfg.get("workspace_changes", {}).get(repo_name, [])
    local_modified_paths = set(c.get("path") for c in raw_changes)
    
    owner = active_repo.get("owner", {}).get("login") if isinstance(active_repo.get("owner"), dict) else active_repo.get("owner_name")
    name = active_repo.get("name", repo_name)
    
    if not token or not owner:
        return {
            "is_connected_to_github": False,
            "is_synced": True,
            "remote_ahead_by": 0,
            "remote_commits": [],
            "conflict_risk": False,
            "conflicting_files": [],
            "remote_modified_files": []
        }
        
    status_code, branch_data = call_github_api(f"/repos/{owner}/{name}/branches/main", token)
    if status_code != 200:
        return {
            "is_connected_to_github": True,
            "is_synced": True,
            "remote_ahead_by": 0,
            "remote_commits": [],
            "conflict_risk": False,
            "conflicting_files": [],
            "remote_modified_files": []
        }
        
    remote_commit_sha = branch_data.get("commit", {}).get("sha", "")
    last_known_sha = cfg.get("last_synced_sha", {}).get(repo_name)
    
    if not last_known_sha or last_known_sha == remote_commit_sha:
        return {
            "is_connected_to_github": True,
            "is_synced": True,
            "remote_ahead_by": 0,
            "remote_commits": [],
            "conflict_risk": False,
            "conflicting_files": [],
            "remote_modified_files": []
        }
        
    status_code, compare_data = call_github_api(f"/repos/{owner}/{name}/compare/{last_known_sha}...main", token)
    if status_code == 200:
        ahead_by = compare_data.get("ahead_by", 0)
        files = compare_data.get("files", [])
        remote_files = [f.get("filename") for f in files]
        conflicts = [f for f in remote_files if f in local_modified_paths]
        
        return {
            "is_connected_to_github": True,
            "is_synced": ahead_by == 0,
            "remote_ahead_by": ahead_by,
            "remote_commits": [c.get("commit", {}).get("message") for c in compare_data.get("commits", [])],
            "conflict_risk": len(conflicts) > 0,
            "conflicting_files": conflicts,
            "remote_modified_files": remote_files
        }
        
    return {
        "is_connected_to_github": True,
        "is_synced": True,
        "remote_ahead_by": 0,
        "remote_commits": [],
        "conflict_risk": False,
        "conflicting_files": [],
        "remote_modified_files": []
    }

def get_file_blame_info(repo_name, file_path):
    cfg = load_config()
    prs = cfg.get("prs", [])
    norm_path = file_path.strip().lstrip("/")
    
    matching_prs = []
    for p in prs:
        p_files = p.get("files") or ([p.get("file_path")] if p.get("file_path") else [])
        if any(norm_path in (f or "") for f in p_files):
            matching_prs.append(p)
            
    author = "Arquiteto de Domínio"
    approver = "Tech Lead / Reviewer"
    date_str = "recente"
    pr_id = None
    
    if matching_prs:
        latest = matching_prs[0]
        author = latest.get("author", author)
        approvals = latest.get("approvals", [])
        if approvals:
            approver = ", ".join(approvals)
        date_str = latest.get("merged_at") or latest.get("created_at") or date_str
        pr_id = latest.get("id")
    else:
        user = cfg.get("user", {})
        if user and user.get("login"):
            author = user.get("login")
            
    return {
        "file": norm_path,
        "author": author,
        "approver": approver,
        "date": date_str,
        "pr_id": pr_id,
        "history": matching_prs
    }

def build_workspace_graph(repo_name):
    """
    Indexa todos os documentos do workspace do repositório,
    construindo a Árvore L1-L4, o Grafo Cross-Cutting (Dependências e Consumidores reversos),
    as trilhas de Lifecycle e o cálculo de Blast Radius (Raio de Impacto).
    """
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    if not os.path.exists(repo_dir):
        return { "nodes": {}, "stats": {}, "repo": repo_name }

    raw_nodes = {}

    # 1. Escanear e extrair metadados de todos os arquivos Markdown
    for root, _, files in os.walk(repo_dir):
        for f in files:
            if not f.endswith((".md", ".markdown", ".mermaid")) or f.startswith("."):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, repo_dir).replace("\\", "/")

            try:
                with open(full_path, "r", encoding="utf-8") as file_obj:
                    content = file_obj.read()
            except Exception:
                content = ""

            fm, body = extract_frontmatter(content)

            # Inferir Título se não informado explicitamente
            title = fm.get("title")
            if not title:
                for line in body.splitlines():
                    line_s = line.strip()
                    if line_s.startswith("# "):
                        title = line_s[2:].strip()
                        break
            if not title:
                title = os.path.splitext(f)[0]

            # Inferir Camada Oficial (L1, L2, L3, L4)
            layer = fm.get("layer")
            if not layer:
                if rel_path in ["index.md", "project/index.md"]:
                    layer = "L1_PROJECT"
                elif rel_path.startswith("domains/") and rel_path.count("/") == 1:
                    layer = "L2_DOMAIN"
                elif rel_path.startswith("domains/") and rel_path.count("/") == 2:
                    layer = "L3_SUBDOMAIN"
                elif rel_path.startswith("domains/"):
                    layer = "L4_FEATURE"
                elif rel_path.startswith("specs/"):
                    layer = "L4_ARTIFACT"
                else:
                    layer = "L4_ARTIFACT"

            raw_nodes[rel_path] = {
                "id": fm.get("id", rel_path.replace("/", "-").replace(".md", "")),
                "title": title,
                "path": rel_path,
                "layer": layer,
                "type": fm.get("type", "document"),
                "status": fm.get("status", "active"),
                "risk_tier": fm.get("risk_tier", "tier_2"),
                "parent": fm.get("parent"),
                "breadcrumb": fm.get("breadcrumb", []),
                "cross_cutting_relations": fm.get("cross_cutting_relations", []),
                "lifecycle": fm.get("lifecycle", {}),
                "critical_invariants": fm.get("critical_invariants", []),
                "tags": fm.get("tags", []),
                "children": [],
                "dependencies": [],
                "consumers": [],
                "blast_radius": []
            }

    # 2. Conectar Paternidade & Filhos (Eixo Vertical)
    for path, node in raw_nodes.items():
        parent_path = node.get("parent")
        if parent_path:
            norm_parent = parent_path.strip().lstrip("/")
            # Tentar match direto ou resolvendo caminho relativo
            target_parent_key = None
            if norm_parent in raw_nodes:
                target_parent_key = norm_parent
            else:
                for k in raw_nodes:
                    if k.endswith(norm_parent) or norm_parent.endswith(k):
                        target_parent_key = k
                        break

            if target_parent_key:
                raw_nodes[target_parent_key]["children"].append({
                    "path": path,
                    "title": node["title"],
                    "layer": node["layer"],
                    "type": node["type"],
                    "status": node["status"]
                })

    # 3. Construir Grafo Cross-Cutting (Eixo Horizontal & Backlinks Reversos)
    for path, node in raw_nodes.items():
        for rel in node.get("cross_cutting_relations", []):
            if not isinstance(rel, dict): continue
            target = rel.get("target", "").strip().lstrip("/")
            rel_type = rel.get("relation_type", "depends_on")
            contract = rel.get("contract_mode", "sync_rpc")
            return_ref = rel.get("return_ref", path)

            target_key = None
            if target in raw_nodes:
                target_key = target
            else:
                for k in raw_nodes:
                    if k.endswith(target) or target.endswith(k):
                        target_key = k
                        break

            if target_key:
                target_node = raw_nodes[target_key]
                node["dependencies"].append({
                    "target_path": target_key,
                    "target_title": target_node["title"],
                    "relation_type": rel_type,
                    "contract_mode": contract,
                    "return_ref": return_ref
                })
                target_node["consumers"].append({
                    "source_path": path,
                    "source_title": node["title"],
                    "relation_type": rel_type,
                    "contract_mode": contract,
                    "return_ref": return_ref
                })

    # 4. Calcular Blast Radius (Raio de Impacto)
    for path, node in raw_nodes.items():
        affected = set()
        to_visit = [c["source_path"] for c in node["consumers"]]
        visited = set()
        while to_visit:
            curr = to_visit.pop(0)
            if curr in visited or curr not in raw_nodes: continue
            visited.add(curr)
            affected.add(curr)
            for sub_c in raw_nodes[curr]["consumers"]:
                to_visit.append(sub_c["source_path"])
        node["blast_radius"] = [
            { "path": p, "title": raw_nodes[p]["title"], "layer": raw_nodes[p]["layer"] }
            for p in affected if p in raw_nodes
        ]

    # Estatísticas Globais
    stats = {
        "total_nodes": len(raw_nodes),
        "by_layer": {
            "L1_PROJECT": len([n for n in raw_nodes.values() if n["layer"] == "L1_PROJECT"]),
            "L2_DOMAIN": len([n for n in raw_nodes.values() if n["layer"] == "L2_DOMAIN"]),
            "L3_SUBDOMAIN": len([n for n in raw_nodes.values() if n["layer"] == "L3_SUBDOMAIN"]),
            "L4_FEATURE": len([n for n in raw_nodes.values() if n["layer"] in ["L4_FEATURE", "L4_ARTIFACT"]]),
        },
        "total_cross_cutting": sum(len(n["dependencies"]) for n in raw_nodes.values())
    }

    return {
        "repo": repo_name,
        "nodes": raw_nodes,
        "stats": stats
    }

def audit_workspace(repo_name):
    """
    Realiza a auditoria de conformidade arquitetural, qualidade, segurança (SAST),
    BDD e detecção de Feedback Loops ativos no repositório.
    """
    graph = build_workspace_graph(repo_name)
    nodes = graph.get("nodes", {})
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)

    issues = []
    feedback_loops = []

    total_docs = len(nodes)
    if total_docs == 0:
        return {
            "score": 100,
            "grade": "A+",
            "total_docs": 0,
            "issues": [],
            "feedback_loops": [],
            "checks": {
                "frontmatter": 100,
                "broken_links": 100,
                "bdd_compliance": 100,
                "security": 100
            }
        }

    frontmatter_ok = 0
    links_ok = 0
    bdd_ok = 0
    security_ok = 0
    features_count = 0

    # Padrões de detecção de segredos e chaves expostas
    secret_patterns = [
        re.compile(r'(?i)(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{40,})'),
        re.compile(r'(?i)(aws_access_key_id|aws_secret_access_key)\s*=\s*["\'][^"\']+["\']'),
        re.compile(r'(?i)(api[_-]?key|auth[_-]?token|secret)\s*[:=]\s*["\'][a-zA-Z0-9_\-\.]{20,}["\']'),
    ]

    for path, node in nodes.items():
        full_path = os.path.join(repo_dir, path)
        content = ""
        if os.path.exists(full_path):
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except Exception:
                content = ""

        # 1. Validação de Frontmatter
        has_fm = bool(node.get("id") and node.get("layer"))
        if has_fm:
            frontmatter_ok += 1
        else:
            issues.append({
                "severity": "warning",
                "category": "Metadados s",
                "path": path,
                "message": "Documento sem YAML Frontmatter padronizado ou campo 'layer' ausente."
            })

        # 2. Integridade de Links & Contratos Cross-Cutting
        doc_links_valid = True
        for rel in node.get("cross_cutting_relations", []):
            if not isinstance(rel, dict): continue
            target = rel.get("target", "").strip().lstrip("/")
            if target and target not in nodes and not any(k.endswith(target) or target.endswith(k) for k in nodes):
                doc_links_valid = False
                issues.append({
                    "severity": "danger",
                    "category": "Contratos Cross-Cutting",
                    "path": path,
                    "message": f"Contrato aponta para documento inexistente: '{target}'."
                })

        parent = node.get("parent")
        if parent:
            p_norm = parent.strip().lstrip("/")
            if p_norm not in nodes and not any(k.endswith(p_norm) or p_norm.endswith(k) for k in nodes):
                doc_links_valid = False
                issues.append({
                    "severity": "warning",
                    "category": "Hierarquia L1-L4",
                    "path": path,
                    "message": f"Documento pai não encontrado: '{parent}'."
                })

        if doc_links_valid:
            links_ok += 1

        # 3. Auditoria de Segurança SAST
        has_secret = False
        for pat in secret_patterns:
            if pat.search(content):
                has_secret = True
                issues.append({
                    "severity": "danger",
                    "category": "Segurança & SAST",
                    "path": path,
                    "message": "Possível chave de API, segredo ou token hardcoded detectado no documento."
                })
                break
        if not has_secret:
            security_ok += 1

        # 4. Auditoria de BDD
        if "specs" in path or node.get("type") == "specs":
            features_count += 1
            has_given = "Given" in content or "Dado" in content
            has_when = "When" in content or "Quando" in content
            has_then = "Then" in content or "Então" in content
            if has_given and has_when and has_then:
                bdd_ok += 1
            else:
                issues.append({
                    "severity": "info",
                    "category": "Especificações BDD",
                    "path": path,
                    "message": "Cenário BDD incompleto. Recomenda-se sintaxe Given / When / Then oficial."
                })

        # 5. Monitor de Feedback Loops Ativos
        lifecycle = node.get("lifecycle", {})
        loops = lifecycle.get("feedback_loops", {})
        if loops and isinstance(loops, dict):
            for trigger, target in loops.items():
                feedback_loops.append({
                    "source_path": path,
                    "source_title": node.get("title", path),
                    "trigger": trigger,
                    "target_path": target
                })

    fm_score = int((frontmatter_ok / total_docs) * 100)
    links_score = int((links_ok / total_docs) * 100)
    sec_score = int((security_ok / total_docs) * 100)
    bdd_score = int((bdd_ok / features_count) * 100) if features_count > 0 else 100

    overall_score = int((fm_score * 0.25) + (links_score * 0.35) + (sec_score * 0.25) + (bdd_score * 0.15))
    grade = "A+" if overall_score >= 95 else ("A" if overall_score >= 85 else ("B" if overall_score >= 70 else "C"))

    return {
        "repo": repo_name,
        "score": overall_score,
        "grade": grade,
        "total_docs": total_docs,
        "checks": {
            "frontmatter": fm_score,
            "broken_links": links_score,
            "security": sec_score,
            "bdd_compliance": bdd_score
        },
        "issues": issues,
        "feedback_loops": feedback_loops
    }

def scaffold_workspace_entity(repo_name, entity_type, payload):
    """
    Gera a estrutura física e lógica de novos Domínios (L2), Áreas (L3)
    ou Esteiras completas de Features L4 com templates s e metadados pré-vinculados.
    """
    repo_dir = os.path.join(PROJECTS_DIR, repo_name)
    os.makedirs(repo_dir, exist_ok=True)
    created_files = []

    domain = (payload.get("domain") or (payload.get("name") if entity_type == "domain" else "") or "").strip().lower().replace(" ", "-")
    area = (payload.get("area") or (payload.get("name") if entity_type == "subdomain" else "") or "").strip().lower().replace(" ", "-")
    name = payload.get("name", "").strip().replace(" ", "-")
    title = payload.get("title", "").strip() or name or domain or area

    if entity_type == "domain":
        domain_dir = os.path.join(repo_dir, "domains", domain)
        os.makedirs(domain_dir, exist_ok=True)
        idx_path = os.path.join(domain_dir, "index.md")
        content = f"""---
id: "domain-{domain}"
title: "Domínio: {title}"
type: "domain"
version: "1.0.0"
status: "active"
layer: "L2_DOMAIN"
path: "domains/{domain}/index.md"
parent: "project/index.md"
breadcrumb:
  - {{ title: "Projeto", path: "project/index.md" }}
  - {{ title: "{title}", path: "domains/{domain}/index.md" }}
---

Navegação: [Projeto](file://../../project/index.md) / **{title}**  
Status: `ACTIVE` | Camada: `L2_DOMAIN`

---

# Domínio: {title}

## 1. Escopo e Limites de Responsabilidade
Definição dos limites arquiteturais e fronteiras de dados deste contexto delimitado.

---

## 2. Invariantes Globais do Domínio
1. Todas as operações devem conter log de auditoria e rastreabilidade.
2. Comunicação externa deve respeitar contratos padronizados.

---

## 3. Subdomínios e Áreas Funcionais
| Área / Subdomínio | Escopo de Atuação | Documento |
| :--- | :--- | :--- |
"""
        with open(idx_path, "w", encoding="utf-8") as f:
            f.write(content)
        created_files.append(f"domains/{domain}/index.md")

    elif entity_type == "subdomain":
        area_dir = os.path.join(repo_dir, "domains", domain, area)
        os.makedirs(area_dir, exist_ok=True)
        idx_path = os.path.join(area_dir, "index.md")
        content = f"""---
id: "subdomain-{domain}-{area}"
title: "Área Funcional: {title}"
type: "subdomain"
version: "1.0.0"
status: "active"
layer: "L3_SUBDOMAIN"
path: "domains/{domain}/{area}/index.md"
parent: "domains/{domain}/index.md"
breadcrumb:
  - {{ title: "Projeto", path: "project/index.md" }}
  - {{ title: "{domain.capitalize()}", path: "domains/{domain}/index.md" }}
  - {{ title: "{title}", path: "domains/{domain}/{area}/index.md" }}
critical_invariants:
  - "max_response_time_ms: 2000"
---

Navegação: [Projeto](file://../../../project/index.md) / [{domain.capitalize()}](file://../../index.md) / **{title}**  
Status: `ACTIVE` | Camada: `L3_SUBDOMAIN`

---

# Área Funcional: {title}

## 1. Objetivo da Área
Gerenciamento específico das funcionalidades e processos de negócio desta área.

---

## 2. Invariantes Críticas da Área
* **SLA de Resposta:** Tempo limite máximo esperado para operações críticas.

---

## 3. Catálogo de Features
| Feature | Descrição | Risco | Status | Documento |
| :--- | :--- | :--- | :--- | :--- |
"""
        with open(idx_path, "w", encoding="utf-8") as f:
            f.write(content)
        created_files.append(f"domains/{domain}/{area}/index.md")

    elif entity_type == "feature":
        feature_code = name.upper()
        feature_dir = os.path.join(repo_dir, "domains", domain, area, feature_code)
        docs_dir = os.path.join(feature_dir, "docs")
        specs_dir = os.path.join(feature_dir, "specs")
        quality_dir = os.path.join(feature_dir, "quality")

        os.makedirs(feature_dir, exist_ok=True)
        os.makedirs(docs_dir, exist_ok=True)
        os.makedirs(specs_dir, exist_ok=True)
        os.makedirs(quality_dir, exist_ok=True)

        risk_tier = payload.get("risk_tier", "tier_2")
        cross_targets = payload.get("cross_cutting", [])

        cross_yaml = ""
        if cross_targets:
            cross_yaml = "cross_cutting_relations:\n"
            for ct in cross_targets:
                cross_yaml += f"  - target: \"{ct}\"\n    relation_type: \"consumes_contract\"\n    contract_mode: \"sync_rpc\"\n"

        base_rel = f"domains/{domain}/{area}/{feature_code}"

        # 1. Ideacao
        with open(os.path.join(feature_dir, "ideacao.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-ideacao"
title: "Ideação: {title}"
type: "ideacao"
version: "1.0.0"
status: "draft"
risk_tier: "{risk_tier}"
layer: "L4_ARTIFACT"
path: "{base_rel}/ideacao.md"
parent: "domains/{domain}/{area}/index.md"
breadcrumb:
  - {{ title: "Projeto", path: "project/index.md" }}
  - {{ title: "{domain.capitalize()}", path: "domains/{domain}/index.md" }}
  - {{ title: "{area.capitalize()}", path: "domains/{domain}/{area}/index.md" }}
  - {{ title: "{title}", path: "{base_rel}/ideacao.md" }}
lifecycle:
  stage: "ideacao"
  previous_stage: null
  next_stage: "{base_rel}/kpis.md"
---

Navegação: [Projeto](file://../../../../project/index.md) / [{domain.capitalize()}](file://../../../index.md) / [{area.capitalize()}](file://../../index.md) / **{title} (Ideação)**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# Ideação & Necessidade: {title}

## 1. Contexto de Negócio & Origem da Demanda
Descrição clara da dor ou oportunidade de negócio para {title}.

---

## 2. Atores e Papéis Envolvidos
* **Ator Principal:** Usuário ou sistema consumidor.

---

## 3. Critérios de Aceite Iniciais
- [ ] Operação conclui com sucesso para dados válidos.
- [ ] Erros de validação retornam mensagem clara.

---

### Navegação da Esteira
* **Próxima Etapa:** [02 - KPIs & Invariantes](file://./kpis.md)
""")
        created_files.append(f"{base_rel}/ideacao.md")

        # 2. KPIs
        with open(os.path.join(feature_dir, "kpis.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-kpis"
title: "KPIs & Invariantes: {title}"
type: "kpis"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "{base_rel}/kpis.md"
parent: "{base_rel}/ideacao.md"
lifecycle:
  stage: "kpis"
  previous_stage: "{base_rel}/ideacao.md"
  next_stage: "{base_rel}/research.md"
---

Navegação: [Projeto](file://../../../../project/index.md) / [{domain.capitalize()}](file://../../../index.md) / [{area.capitalize()}](file://../../index.md) / **{title} (KPIs)**  
Status: `DRAFT` | Camada: `L4_ARTIFACT`

---

# KPIs e Invariantes: {title}

## 1. Métricas de Sucesso
* **Latência:** SLA p95 < 800ms.
* **Acurácia:** Zero inconsistência de saldo.

---

## 2. Invariantes de Negócio
1. Estado só transita sob condições válidas.
2. Idempotência estrita na execução.

---

### Navegação da Esteira
* **Etapa Anterior:** [01 - Ideação](file://./ideacao.md)
* **Próxima Etapa:** [03 - Pesquisa e RAG](file://./research.md)
""")
        created_files.append(f"{base_rel}/kpis.md")

        # 3. Research
        with open(os.path.join(feature_dir, "research.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-research"
title: "Research: {title}"
type: "research"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "{base_rel}/research.md"
parent: "{base_rel}/kpis.md"
lifecycle:
  stage: "research"
  previous_stage: "{base_rel}/kpis.md"
  next_stage: "{base_rel}/feature-definition.md"
  feedback_loops:
    on_conflict: "{base_rel}/ideacao.md"
---

# Pesquisa & Análise de Viabilidade: {title}

## 1. Alinhamento com Dicionário Ubíquo
Termos validados e em conformidade com o glossário central.

---

### Navegação da Esteira
* **Etapa Anterior:** [02 - KPIs](file://./kpis.md)
* **Próxima Etapa:** [04 - Definição Técnica](file://./feature-definition.md)
""")
        created_files.append(f"{base_rel}/research.md")

        # 4. Feature Definition
        with open(os.path.join(feature_dir, "feature-definition.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-definition"
title: "Definição Técnica: {title}"
type: "feature-definition"
version: "1.0.0"
status: "draft"
layer: "L4_FEATURE"
risk_tier: "{risk_tier}"
path: "{base_rel}/feature-definition.md"
parent: "{base_rel}/research.md"
{cross_yaml}lifecycle:
  stage: "feature-definition"
  previous_stage: "{base_rel}/research.md"
  next_stage: "{base_rel}/docs/flow.md"
---

# Definição Técnica: {title}

## 1. Escopo Técnico & Arquitetura
Implementação dos casos de uso, agregados e adaptadores.

---

### Navegação da Esteira
* **Etapa Anterior:** [03 - Research](file://./research.md)
* **Próxima Etapa:** [05 - Fluxo Gráfico](file://./docs/flow.md)
""")
        created_files.append(f"{base_rel}/feature-definition.md")

        # 5. Flow
        with open(os.path.join(docs_dir, "flow.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-flow"
title: "Fluxo Gráfico: {title}"
type: "flow"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "{base_rel}/docs/flow.md"
parent: "{base_rel}/feature-definition.md"
lifecycle:
  stage: "flow"
  previous_stage: "{base_rel}/feature-definition.md"
  next_stage: "{base_rel}/docs/entity.md"
---

# Fluxo Gráfico & Sequência: {title}

```mermaid
sequenceDiagram
    actor User as Ator
    participant API as Controller
    participant App as Use Case
    participant Domain as Entidade
    User->>API: Solicitação
    API->>App: Executa Use Case
    App->>Domain: Valida Invariantes
    Domain-->>App: OK
    App-->>API: 200 OK
```

---

### Navegação da Esteira
* **Etapa Anterior:** [04 - Definição Técnica](file://../feature-definition.md)
* **Próxima Etapa:** [05 - Modelagem de Entidades](file://./entity.md)
""")
        created_files.append(f"{base_rel}/docs/flow.md")

        # 6. Entity
        with open(os.path.join(docs_dir, "entity.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-entity"
title: "Entidades: {title}"
type: "entity"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "{base_rel}/docs/entity.md"
parent: "{base_rel}/docs/flow.md"
lifecycle:
  stage: "docs"
  previous_stage: "{base_rel}/docs/flow.md"
  next_stage: "{base_rel}/specs/behavior.md"
---

# Modelagem DDD: {title}

## 1. Aggregate Root & Value Objects
Estruturação das entidades e Value Objects puros.

---

### Navegação da Esteira
* **Etapa Anterior:** [05 - Fluxo Gráfico](file://./flow.md)
* **Próxima Etapa:** [06 - Specs BDD](file://../specs/behavior.md)
""")
        created_files.append(f"{base_rel}/docs/entity.md")

        # 7. Specs (BDD)
        with open(os.path.join(specs_dir, "behavior.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-specs"
title: "Specs BDD: {title}"
type: "specs"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "{base_rel}/specs/behavior.md"
parent: "{base_rel}/docs/entity.md"
lifecycle:
  stage: "specs"
  previous_stage: "{base_rel}/docs/entity.md"
  next_stage: "{base_rel}/quality/review.md"
---

# Especificações BDD (Gherkin): {title}

```gherkin
Feature: {title}
  Scenario: Processamento com sucesso
    Given que os parâmetros de negócio estão válidos
    When o comando principal é submetido
    Then o estado deve ser concluído com sucesso
```

---

### Navegação da Esteira
* **Etapa Anterior:** [05 - Modelagem](file://../docs/entity.md)
* **Próxima Etapa:** [07 - Qualidade & Review](file://../quality/review.md)
""")
        created_files.append(f"{base_rel}/specs/behavior.md")

        # 8. Review
        with open(os.path.join(quality_dir, "review.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-quality"
title: "Qualidade & Review: {title}"
type: "quality"
version: "1.0.0"
status: "draft"
layer: "L4_ARTIFACT"
path: "{base_rel}/quality/review.md"
parent: "{base_rel}/specs/behavior.md"
lifecycle:
  stage: "quality"
  previous_stage: "{base_rel}/specs/behavior.md"
  next_stage: "{base_rel}/quality/monitoring.md"
---

# Relatório de Qualidade & Revisão: {title}

- [ ] Cobertura de Testes Unitários 100%
- [ ] Auditoria SAST Aprovada
- [ ] Clean Architecture Conforme

---

### Navegação da Esteira
* **Etapa Anterior:** [06 - Specs BDD](file://../specs/behavior.md)
* **Próxima Etapa:** [08 - Monitoramento](file://./monitoring.md)
""")
        created_files.append(f"{base_rel}/quality/review.md")

        # 9. Monitoring
        with open(os.path.join(quality_dir, "monitoring.md"), "w", encoding="utf-8") as f:
            f.write(f"""---
id: "feature-{domain}-{area}-{feature_code.lower()}-monitoring"
title: "Monitoramento: {title}"
type: "monitoring"
version: "1.0.0"
status: "active"
layer: "L4_ARTIFACT"
path: "{base_rel}/quality/monitoring.md"
parent: "{base_rel}/quality/review.md"
lifecycle:
  stage: "monitoring"
  previous_stage: "{base_rel}/quality/review.md"
  next_stage: "{base_rel}/ideacao.md"
---

# Monitoramento & Telemetria: {title}

| Métrica | Meta | Produção |
| :--- | :--- | :--- |
| Latência p95 | < 500ms | 180ms |

---

### Ciclo Contínuo de Produto
* **Loop de Iteração:** [Iniciar Nova Ideação](file://../ideacao.md)
""")
        created_files.append(f"{base_rel}/quality/monitoring.md")

    return {
        "success": True,
        "entity_type": entity_type,
        "created_files": created_files,
        "primary_file": created_files[0] if created_files else "index.md"
    }

def build_tree(current_dir, base_dir):
    items = []
    try:
        entries = sorted(os.listdir(current_dir))
    except Exception:
        return []

    dirs = [e for e in entries if os.path.isdir(os.path.join(current_dir, e)) and not e.startswith(".git") and e != "__pycache__"]
    files = [e for e in entries if os.path.isfile(os.path.join(current_dir, e)) and not e.startswith(".DS_Store")]

    for d in dirs:
        full_d = os.path.join(current_dir, d)
        rel_d = os.path.relpath(full_d, base_dir).replace("\\", "/")
        children = build_tree(full_d, base_dir)
        items.append({
            "name": d,
            "path": rel_d,
            "type": "dir",
            "badge": "",
            "children": children
        })

    for f in files:
        full_f = os.path.join(current_dir, f)
        rel_f = os.path.relpath(full_f, base_dir).replace("\\", "/")
        
        # Badge inteligente baseado em L0-L4
        badge = "L0" if (rel_f.startswith("project/") or rel_f in ["index.md", "project/index.md"]) else (
            "L1" if rel_f.startswith("domains/") and rel_f.count("/") == 1 else (
                "L2" if rel_f.startswith("domains/") and rel_f.count("/") == 2 else (
                    "L3" if "domains" in rel_f or "specs" in rel_f else "DOC"
                )
            )
        )
        items.append({
            "name": f,
            "path": rel_f,
            "type": "file",
            "badge": badge,
            "desc": ""
        })

    return items

def extract_tokens_defensively(raw_response, provider, prompt_text="", reply_text=""):
    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    cached_tokens = 0
    estimated = False

    if isinstance(raw_response, dict):
        # 1. Procura em usageMetadata (Google Gemini)
        um = raw_response.get("usageMetadata")
        if isinstance(um, dict):
            prompt_tokens = um.get("promptTokenCount") or um.get("prompt_tokens") or 0
            completion_tokens = um.get("candidatesTokenCount") or um.get("completion_tokens") or 0
            total_tokens = um.get("totalTokenCount") or um.get("total_tokens") or 0
            cached_tokens = um.get("cachedContentTokenCount") or um.get("cached_tokens") or 0

        # 2. Procura em usage (OpenAI, DeepSeek, Groq, OpenRouter, Anthropic)
        if total_tokens == 0:
            us = raw_response.get("usage")
            if isinstance(us, dict):
                prompt_tokens = us.get("prompt_tokens") or us.get("input_tokens") or 0
                completion_tokens = us.get("completion_tokens") or us.get("output_tokens") or 0
                total_tokens = us.get("total_tokens") or (prompt_tokens + completion_tokens)
                cached_tokens = (
                    us.get("cache_read_input_tokens") or
                    (us.get("prompt_tokens_details") or {}).get("cached_tokens") or
                    us.get("cached_tokens") or 0
                )

        # 3. Procura em Ollama / Local
        if total_tokens == 0:
            p_eval = raw_response.get("prompt_eval_count") or 0
            c_eval = raw_response.get("eval_count") or 0
            if p_eval or c_eval:
                prompt_tokens = p_eval
                completion_tokens = c_eval
                total_tokens = prompt_tokens + completion_tokens

    # Fallback heurístico defensivo caso o provedor omita metadados ou altere schema
    if total_tokens == 0 and (prompt_text or reply_text):
        prompt_tokens = max(1, len(prompt_text) // 4)
        completion_tokens = max(1, len(reply_text) // 4)
        total_tokens = prompt_tokens + completion_tokens
        estimated = True

    return {
        "prompt_tokens": int(prompt_tokens),
        "completion_tokens": int(completion_tokens),
        "total_tokens": int(total_tokens),
        "cached_tokens": int(cached_tokens),
        "estimated": estimated
    }

# =============================================================================
# MULTI-MODEL LLM ENGINE (GEMINI, OPENAI, ANTHROPIC, OLLAMA/LOCAL)
# =============================================================================
def call_universal_llm(ai_settings, prompt, document_context="", file_path="index.md", history=None, custom_system_prompt=None):
    start_time = time.perf_counter()
    provider = ai_settings.get("provider", "gemini").lower()
    model = ai_settings.get("model", "gemini-3.5-flash")
    api_key = ai_settings.get("api_key", "").strip()
    custom_endpoint = ai_settings.get("custom_endpoint", "http://localhost:11434/v1").rstrip("/")

    # Auto-resolve from ai_providers if missing
    if not api_key or not custom_endpoint:
        try:
            cfg = load_config()
            saved_p = cfg.get("ai_providers", {}).get(provider, {})
            if not api_key and saved_p.get("api_key"):
                api_key = saved_p.get("api_key")
            if (not custom_endpoint or custom_endpoint == "http://localhost:11434/v1") and saved_p.get("custom_endpoint"):
                custom_endpoint = saved_p.get("custom_endpoint").rstrip("/")
            if not model and saved_p.get("model"):
                model = saved_p.get("model")
        except Exception:
            pass

    if provider == "gemini" and not api_key:
        api_key = os.environ.get("GEMINI_API_KEY", "")

    agent_rules = f"""Você é o Antigravity Agent, um assistente especialista autônomo de IA para Arquitetura de Software, Domain-Driven Design (DDD), Context OS e Governança Técnica.
Você está pareando com o desenvolvedor em tempo real e possui autorização para EDITAR DIRETAMENTE o documento ativo.
Arquivo ativo atual: `{file_path}`.

PROTOCOLO DE EDIÇÃO DIRETA NO DOCUMENTO (OBRIGATÓRIO):
Sempre que a mensagem do usuário pedir para adicionar, alterar, melhorar, corrigir, refatorar, estruturar, criar seções ou modificar o documento atual, você DEVE fornecer a alteração pronta para aplicação direta no documento.
Forneça uma explicação concisa e em seguida o bloco de Diff estruturado exatamente assim:

```diff
<<<< SEARCH
[trecho original exato presente no documento que será substituído]
====
[trecho novo/modificado que entrará no lugar]
>>>>
```

REGRAS DO DIFF:
1. O bloco SEARCH deve conter exatamente as linhas existentes no documento atual (ou estar vazio caso seja inserção de nova seção ao final do documento).
2. O bloco REPLACE deve conter a nova versão completa e pronta.
3. Se o usuário pedir para criar um documento novo do zero ou substituir o documento inteiro, use:
```diff
<<<< SEARCH
*
====
[novo conteúdo completo em markdown]
>>>>
```
4. Se for apenas uma dúvida conceitual sem alteração de arquivo, responda diretamente em markdown sem o bloco diff.
5. Mantenha conformidade rigorosa com os princípios de DDD (Bounded Contexts, Dicionário Ubíquo, Invariantes).
6. Se o usuário pedir diagramas, forneça o bloco Mermaid (`mermaid`).
"""

    if custom_system_prompt and custom_system_prompt.strip():
        system_prompt = f"{agent_rules}\n\nINSTRUÇÕES COMPLEMENTARES:\n{custom_system_prompt.strip()}"
    else:
        system_prompt = agent_rules

    grounding_message = f"CONTEÚDO ATUAL DO ARQUIVO `{file_path}`:\n```markdown\n{document_context}\n```\n\nPergunta / Instrução: {prompt}"

    if provider == "gemini":
        if not api_key:
            return 400, { "error": "Chave da API do Google Gemini não informada.", "needs_key": True }

        contents = []
        if document_context:
            contents.append({ "role": "user", "parts": [{ "text": f"Contexto do arquivo `{file_path}`:\n```markdown\n{document_context}\n```" }] })
            contents.append({ "role": "model", "parts": [{ "text": f"Contexto de `{file_path}` carregado com sucesso." }] })
        if history:
            for msg in history[-6:]:
                contents.append({
                    "role": "user" if msg.get("role") == "user" else "model",
                    "parts": [{ "text": msg.get("text", "") }]
                })
        contents.append({ "role": "user", "parts": [{ "text": prompt }] })

        payload = {
            "system_instruction": { "parts": [{ "text": system_prompt }] },
            "contents": contents,
            "generationConfig": { "temperature": 0.3, "maxOutputTokens": 2048 }
        }

        raw_model = model.replace("models/", "")
        candidate_models = [
            raw_model,
            "gemini-3.5-flash",
            "gemini-3-flash-preview",
            "gemini-flash-lite-latest",
            "gemma-4-26b-a4b-it",
            "gemma-4-31b-it"
        ]
        seen = set()
        models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

        last_error = ""
        for m in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={ "Content-Type": "application/json" }, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    candidates = data.get("candidates", [])
                    if candidates:
                        reply = "".join(p.get("text", "") for p in candidates[0].get("content", {}).get("parts", []))
                        latency_ms = int((time.perf_counter() - start_time) * 1000)
                        usage = extract_tokens_defensively(data, "gemini", prompt_text=prompt, reply_text=reply)
                        return 200, {
                            "reply": reply,
                            "provider": "Google Gemini",
                            "model": m,
                            "usage": usage,
                            "latency_ms": latency_ms
                        }
            except urllib.error.HTTPError as e:
                last_error = e.read().decode("utf-8")
            except Exception as e:
                last_error = str(e)

        return 500, { "error": f"Erro na chamada do Gemini: {last_error}" }

    elif provider in ["openai", "deepseek", "groq", "openrouter"]:
        if not api_key:
            return 400, { "error": f"Chave da API de {provider.upper()} não informada.", "needs_key": True }

        base_url = "https://api.openai.com/v1/chat/completions"
        if provider == "deepseek": base_url = "https://api.deepseek.com/v1/chat/completions"
        elif provider == "groq": base_url = "https://api.groq.com/openai/v1/chat/completions"
        elif provider == "openrouter": base_url = "https://openrouter.ai/api/v1/chat/completions"

        messages = [{ "role": "system", "content": system_prompt }]
        if history:
            for msg in history[-6:]:
                messages.append({ "role": msg.get("role", "user"), "content": msg.get("text", "") })
        messages.append({ "role": "user", "content": grounding_message if document_context else prompt })

        payload = { "model": model or "gpt-4o", "messages": messages, "temperature": 0.3 }
        req = urllib.request.Request(base_url, data=json.dumps(payload).encode("utf-8"), headers={
            "Content-Type": "application/json", "Authorization": f"Bearer {api_key}"
        }, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=35) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices:
                    reply = choices[0].get("message", {}).get("content", "")
                    latency_ms = int((time.perf_counter() - start_time) * 1000)
                    usage = extract_tokens_defensively(data, provider, prompt_text=prompt, reply_text=reply)
                    return 200, {
                        "reply": reply,
                        "provider": provider.upper(),
                        "model": model,
                        "usage": usage,
                        "latency_ms": latency_ms
                    }
        except Exception as e:
            return 500, { "error": f"Erro no provedor {provider}: {str(e)}" }

    elif provider == "anthropic":
        if not api_key:
            return 400, { "error": "Chave da API da Anthropic Claude não informada.", "needs_key": True }

        url = "https://api.anthropic.com/v1/messages"
        messages = []
        if history:
            for msg in history[-6:]:
                messages.append({ "role": "user" if msg.get("role") == "user" else "assistant", "content": msg.get("text", "") })
        messages.append({ "role": "user", "content": grounding_message if document_context else prompt })

        payload = { "model": model or "claude-3-5-sonnet-20241022", "system": system_prompt, "max_tokens": 2048, "messages": messages, "temperature": 0.3 }
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={
            "Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01"
        }, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=35) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data.get("content", [])
                if content:
                    reply = "".join(c.get("text", "") for c in content if c.get("type") == "text")
                    latency_ms = int((time.perf_counter() - start_time) * 1000)
                    usage = extract_tokens_defensively(data, "anthropic", prompt_text=prompt, reply_text=reply)
                    return 200, {
                        "reply": reply,
                        "provider": "Anthropic",
                        "model": model,
                        "usage": usage,
                        "latency_ms": latency_ms
                    }
        except Exception as e:
            return 500, { "error": f"Erro na Anthropic: {str(e)}" }

    elif provider == "local" or provider == "ollama":
        url = f"{custom_endpoint}/chat/completions"
        messages = [{ "role": "system", "content": system_prompt }]
        if history:
            for msg in history[-6:]:
                messages.append({ "role": msg.get("role", "user"), "content": msg.get("text", "") })
        messages.append({ "role": "user", "content": grounding_message if document_context else prompt })

        payload = { "model": model or "deepseek-r1:latest", "messages": messages, "temperature": 0.3 }
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={ "Content-Type": "application/json" }, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices:
                    reply = choices[0].get("message", {}).get("content", "")
                    latency_ms = int((time.perf_counter() - start_time) * 1000)
                    usage = extract_tokens_defensively(data, "ollama", prompt_text=prompt, reply_text=reply)
                    return 200, {
                        "reply": reply,
                        "provider": "Ollama Local",
                        "model": model,
                        "usage": usage,
                        "latency_ms": latency_ms
                    }
        except Exception as e:
            return 500, { "error": f"Não foi possível conectar ao Ollama local em {url}: {str(e)}" }

    return 400, { "error": f"Provedor '{provider}' não suportado." }

# =============================================================================
# MULTI-PROVIDER AI DISCOVERY & PERSISTENCE ENGINE
# =============================================================================
def fetch_provider_models(provider, api_key="", custom_endpoint=""):
    provider = (provider or "gemini").lower()
    
    if provider in ["local", "ollama"]:
        endpoint = custom_endpoint or "http://localhost:11434/v1"
        base_endpoint = endpoint.rstrip("/")
        if base_endpoint.endswith("/v1"):
            ollama_base = base_endpoint[:-3]
        else:
            ollama_base = base_endpoint
            
        # 1. Try Ollama Native /api/tags
        try:
            req = urllib.request.Request(f"{ollama_base}/api/tags", headers={"User-Agent": "ContextOS/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                if models:
                    return { "provider": "local", "models": models, "status": "online", "source": "live" }
        except Exception:
            pass
            
        # 2. Try OpenAI-compatible /models
        try:
            req = urllib.request.Request(f"{base_endpoint}/models", headers={"User-Agent": "ContextOS/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                if models:
                    return { "provider": "local", "models": models, "status": "online", "source": "live" }
        except Exception:
            pass
            
        return {
            "provider": "local",
            "models": ["deepseek-r1:latest", "deepseek-r1:14b", "deepseek-r1:8b", "llama3.3:latest", "llama3.2:latest", "qwen2.5-coder:latest", "mistral:latest", "phi4:latest"],
            "status": "offline",
            "source": "fallback"
        }

    elif provider == "gemini":
        key = api_key or os.environ.get("GEMINI_API_KEY", "")
        if key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                req = urllib.request.Request(url, headers={"User-Agent": "ContextOS/1.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = []
                    for m in data.get("models", []):
                        methods = m.get("supportedGenerationMethods", [])
                        if "generateContent" in methods:
                            name = m.get("name", "").replace("models/", "")
                            if name:
                                models.append(name)
                    if models:
                        top_order = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash", "gemma-4-26b-a4b-it", "gemma-4-31b-it"]
                        sorted_models = [m for m in top_order if m in models] + [m for m in models if m not in top_order]
                        return { "provider": "gemini", "models": sorted_models, "status": "online", "source": "live" }
            except Exception:
                pass

        return {
            "provider": "gemini",
            "models": ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash", "gemma-4-26b-a4b-it", "gemma-4-31b-it"],
            "status": "online" if key else "unconfigured",
            "source": "curated"
        }

    elif provider == "openai":
        if api_key:
            try:
                url = "https://api.openai.com/v1/models"
                req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}", "User-Agent": "ContextOS/1.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                    chat_models = [m for m in models if m.startswith("gpt-") or m.startswith("o1") or m.startswith("o3") or "chat" in m]
                    if chat_models:
                        top_order = ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1", "gpt-4-turbo", "gpt-3.5-turbo"]
                        sorted_models = [m for m in top_order if m in chat_models] + [m for m in chat_models if m not in top_order]
                        return { "provider": "openai", "models": sorted_models, "status": "online", "source": "live" }
            except Exception:
                pass

        return {
            "provider": "openai",
            "models": ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1", "gpt-4-turbo", "gpt-3.5-turbo"],
            "status": "online" if api_key else "unconfigured",
            "source": "curated"
        }

    elif provider == "deepseek":
        if api_key:
            try:
                url = "https://api.deepseek.com/models"
                req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}", "User-Agent": "ContextOS/1.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                    if models:
                        return { "provider": "deepseek", "models": models, "status": "online", "source": "live" }
            except Exception:
                pass

        return {
            "provider": "deepseek",
            "models": ["deepseek-chat", "deepseek-reasoner"],
            "status": "online" if api_key else "unconfigured",
            "source": "curated"
        }

    elif provider == "anthropic":
        return {
            "provider": "anthropic",
            "models": ["claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
            "status": "online" if api_key else "unconfigured",
            "source": "curated"
        }

    return {
        "provider": provider,
        "models": ["default"],
        "status": "unknown",
        "source": "fallback"
    }

def get_all_ai_providers_status(cfg):
    ai_settings = cfg.get("ai_settings", {})
    active_p = ai_settings.get("provider", "gemini")
    active_m = ai_settings.get("model", "gemini-3.5-flash")
    ai_providers = cfg.get("ai_providers", {})

    providers_meta = {
        "gemini": {
            "name": "Google Gemini",
            "default_model": "gemini-3.5-flash",
            "needs_key": True,
            "has_endpoint": False,
            "custom_endpoint": ""
        },
        "openai": {
            "name": "OpenAI",
            "default_model": "gpt-4o",
            "needs_key": True,
            "has_endpoint": False,
            "custom_endpoint": ""
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "default_model": "claude-3-5-sonnet-20241022",
            "needs_key": True,
            "has_endpoint": False,
            "custom_endpoint": ""
        },
        "deepseek": {
            "name": "DeepSeek API",
            "default_model": "deepseek-chat",
            "needs_key": True,
            "has_endpoint": False,
            "custom_endpoint": ""
        },
        "local": {
            "name": "Ollama Local",
            "default_model": "deepseek-r1:latest",
            "needs_key": False,
            "has_endpoint": True,
            "custom_endpoint": "http://localhost:11434/v1"
        }
    }

    result = {}
    for p_id, meta in providers_meta.items():
        saved = ai_providers.get(p_id, {})
        p_key = saved.get("api_key") or (ai_settings.get("api_key") if active_p == p_id else "")
        if p_id == "gemini" and not p_key:
            p_key = os.environ.get("GEMINI_API_KEY", "")

        p_endpoint = saved.get("custom_endpoint") or (ai_settings.get("custom_endpoint") if active_p == p_id else meta.get("custom_endpoint", ""))
        p_model = saved.get("model") or (ai_settings.get("model") if active_p == p_id else meta["default_model"])

        is_configured = bool(p_key) if meta["needs_key"] else True

        result[p_id] = {
            "id": p_id,
            "name": meta["name"],
            "model": p_model,
            "has_key": bool(p_key),
            "custom_endpoint": p_endpoint,
            "needs_key": meta["needs_key"],
            "has_endpoint": meta["has_endpoint"],
            "configured": is_configured,
            "is_active": (p_id == active_p)
        }

    return {
        "active_provider": active_p,
        "active_model": active_m,
        "providers": result
    }

def apply_branch_protection(repo_full_name, branch, token, required_approvals=1):
    endpoint = f"/repos/{repo_full_name}/branches/{branch}/protection"
    protection_payload = {
        "required_status_checks": None,
        "enforce_admins": False,
        "required_pull_request_reviews": {
            "dismiss_stale_reviews": True,
            "require_code_owner_reviews": False,
            "required_approving_review_count": required_approvals
        },
        "restrictions": None
    }
    return call_github_api(endpoint, token, method="PUT", data=protection_payload)

def execute_pr_merge(target, cfg):
    pr_id = target.get("id")
    target["status"] = "MERGED"
    target["merged_at"] = datetime.datetime.now().isoformat()
    active_repo = cfg.get("active_repo", {})
    repo_name = active_repo.get("name", "local")
    token = cfg.get("token", "")
    repo_full_name = active_repo.get("full_name")

    changes = target.get("changes") or [{ "path": target.get("file_path", "index.md"), "new_content": target.get("content", ""), "type": "MODIFIED" }]

    for c in changes:
        fpath = c["path"]
        full_p = os.path.join(PROJECTS_DIR, repo_name, fpath)
        if c["type"] == "DELETED":
            if os.path.exists(full_p): os.remove(full_p)
        else:
            os.makedirs(os.path.dirname(full_p), exist_ok=True)
            with open(full_p, "w", encoding="utf-8") as f:
                f.write(c.get("new_content", ""))

        # Se for alteração nas regras de governança, sincroniza com as configurações ativas
        if fpath in ["project/governance.json", "governance.json"]:
            try:
                gov_data = json.loads(c.get("new_content", "{}"))
                if isinstance(gov_data, dict):
                    if "governance" not in cfg: cfg["governance"] = {}
                    if "min_approvals" in gov_data:
                        cfg["governance"]["min_approvals"] = gov_data["min_approvals"]
                    if "reviewers" in gov_data:
                        cfg["governance"]["reviewers"] = gov_data["reviewers"]
            except Exception:
                pass

        # Sincroniza com GitHub se token existir
        if repo_full_name and token:
            try:
                gh_status, gh_file = call_github_api(f"/repos/{repo_full_name}/contents/{fpath}", token)
                if c["type"] == "DELETED" and gh_status == 200:
                    call_github_api(f"/repos/{repo_full_name}/contents/{fpath}", token, method="DELETE", data={
                        "message": f"Delete {fpath} via PR #{pr_id} (Auto-Merged)",
                        "sha": gh_file.get("sha"),
                        "branch": active_repo.get("default_branch", "main")
                    })
                else:
                    commit_payload = {
                        "message": f"Merge PR #{pr_id}: update {fpath} (Auto-Merged)",
                        "content": base64.b64encode(c.get("new_content", "").encode("utf-8")).decode("utf-8"),
                        "branch": active_repo.get("default_branch", "main")
                    }
                    if gh_status == 200 and "sha" in gh_file:
                        commit_payload["sha"] = gh_file["sha"]
                    call_github_api(f"/repos/{repo_full_name}/contents/{fpath}", token, method="PUT", data=commit_payload)
            except Exception:
                pass

    save_config(cfg)


# =============================================================================
# AI MEMORY & LLM-WIKI GOVERNANCE ENGINE (KARPATHY-STYLE GIT-BACKED MEMORY)
# =============================================================================

def get_current_actor(cfg=None):
    if cfg is None:
        cfg = load_config()
    user = cfg.get("user")
    if user and isinstance(user, dict) and user.get("login"):
        return {
            "name": user.get("name") or user.get("login") or "Developer",
            "handle": user.get("login") or "developer",
            "email": user.get("email") or f"{user.get('login', 'dev')}@users.noreply.github.com",
            "avatar_url": user.get("avatar_url") or f"https://github.com/{user.get('login', 'github')}.png",
            "source": "github"
        }
    try:
        git_name = subprocess.check_output(["git", "config", "user.name"], text=True, timeout=2).strip()
        git_email = subprocess.check_output(["git", "config", "user.email"], text=True, timeout=2).strip()
        if git_name:
            return {
                "name": git_name,
                "handle": git_name.lower().replace(" ", "-"),
                "email": git_email or "dev@local",
                "avatar_url": f"https://ui-avatars.com/api/?name={urllib.parse.quote(git_name)}&background=2563eb&color=fff",
                "source": "git_local"
            }
    except Exception:
        pass
    return {
        "name": "Developer",
        "handle": "dev",
        "email": "dev@local",
        "avatar_url": "https://ui-avatars.com/api/?name=Dev&background=2563eb&color=fff",
        "source": "local"
    }

def sanitize_memory_text(text):
    if not text or not isinstance(text, str):
        return ""
    patterns = [
        (r'(?i)(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{40,})', '[REDACTED_GITHUB_TOKEN]'),
        (r'(?i)(sk-[a-zA-Z0-9]{20,})', '[REDACTED_API_KEY]'),
        (r'(?i)bearer\s+[a-zA-Z0-9_\-\.]{25,}', 'Bearer [REDACTED_TOKEN]'),
        (r'(?i)(aws_access_key_id|aws_secret_access_key)\s*=\s*["\'][^"\']+["\']', r'\1="[REDACTED_AWS_KEY]"'),
        (r'(?i)(password|secret|api_key|token)\s*[:=]\s*["\'][a-zA-Z0-9_\-\.]{8,}["\']', r'\1="[REDACTED]"')
    ]
    sanitized = text
    for pat, repl in patterns:
        sanitized = re.sub(pat, repl, sanitized)
    return sanitized

def get_memory_dir(repo_name="default"):
    repo_name = (repo_name or "default").strip()
    mem_dir = os.path.join(PROJECTS_DIR, repo_name, ".spec-memory")
    subdirs = ["sessions", "handoffs", "decisions", "concepts", "gotchas", "_rules"]
    for s in subdirs:
        os.makedirs(os.path.join(mem_dir, s), exist_ok=True)
    meta_path = os.path.join(mem_dir, "_meta.yaml")
    if not os.path.exists(meta_path):
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                f.write(f"# AI Memory & Spec Governance Catalog\nrepo: {repo_name}\ncreated_at: {datetime.datetime.now().isoformat()}Z\nversion: 2.0\n")
        except Exception:
            pass
    return mem_dir

def doc_path_to_slug(doc_path):
    if not doc_path:
        return "root"
    clean = doc_path.replace("/", "_").replace("\\", "_").replace(".", "_")
    return re.sub(r'[^a-zA-Z0-9_-]', '', clean).strip("_") or "root"

def append_chat_event(repo_name, doc_path, session_id, role, text, model_info=None, author_info=None, telemetry_info=None):
    mem_dir = get_memory_dir(repo_name)
    sanitized_text = sanitize_memory_text(text)
    now_iso = datetime.datetime.now().isoformat()
    now_month = datetime.datetime.now().strftime("%Y-%m")
    actor = author_info or get_current_actor()
    actor_name = actor.get("name", "User")
    
    # 1. Log cronológico (append-only)
    log_file = os.path.join(mem_dir, f"log-{now_month}.md")
    log_entry = f"\n## [{now_iso}] {role.upper()} | {doc_path} | session:{session_id} | by {actor_name}\n{sanitized_text}\n"
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        print(f"Error appending to memory log: {e}")

    # 2. Session File & Acumulação de Métricas no Frontmatter
    session_file = os.path.join(mem_dir, "sessions", f"{session_id}.md")
    
    existing_fm = {}
    session_body = ""
    if os.path.exists(session_file):
        try:
            with open(session_file, "r", encoding="utf-8") as f:
                content = f.read()
            existing_fm, session_body = extract_frontmatter(content)
        except Exception:
            existing_fm, session_body = {}, ""

    metrics = existing_fm.get("metrics") or {
        "total_tokens": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "cached_tokens": 0,
        "total_latency_ms": 0,
        "rounds": 0
    }
    if telemetry_info and isinstance(telemetry_info, dict):
        usage = telemetry_info.get("usage") or {}
        metrics["total_tokens"] = int(metrics.get("total_tokens", 0)) + int(usage.get("total_tokens", 0))
        metrics["prompt_tokens"] = int(metrics.get("prompt_tokens", 0)) + int(usage.get("prompt_tokens", 0))
        metrics["completion_tokens"] = int(metrics.get("completion_tokens", 0)) + int(usage.get("completion_tokens", 0))
        metrics["cached_tokens"] = int(metrics.get("cached_tokens", 0)) + int(usage.get("cached_tokens", 0))
        metrics["total_latency_ms"] = int(metrics.get("total_latency_ms", 0)) + int(telemetry_info.get("latency_ms", 0))
        if role == "model":
            metrics["rounds"] = int(metrics.get("rounds", 0)) + 1

    created_at_val = existing_fm.get("created_at") or now_iso
    agent_model_val = model_info or existing_fm.get("agent_model", "ai-assistant")
    status_val = existing_fm.get("status", "active")

    metrics_yaml = f"""metrics:
  total_tokens: {metrics['total_tokens']}
  prompt_tokens: {metrics['prompt_tokens']}
  completion_tokens: {metrics['completion_tokens']}
  cached_tokens: {metrics['cached_tokens']}
  total_latency_ms: {metrics['total_latency_ms']}
  rounds: {metrics['rounds']}"""

    author_yaml = f"""author:
  name: "{actor.get('name', 'Developer')}"
  handle: "{actor.get('handle', 'dev')}"
  email: "{actor.get('email', '')}"
  avatar_url: "{actor.get('avatar_url', '')}" """

    frontmatter_text = f"""---
session_id: "{session_id}"
target_document: "{doc_path}"
created_at: "{created_at_val}"
updated_at: "{now_iso}"
agent_model: "{agent_model_val}"
status: "{status_val}"
{author_yaml}
{metrics_yaml}
---"""

    role_icon = "👤 **" + actor_name + "**" if role == "user" else "🤖 **Assistente IA**"
    msg_block = f"\n### {role_icon} ({datetime.datetime.now().strftime('%H:%M:%S')})\n\n{sanitized_text}\n"

    if not os.path.exists(session_file) or not session_body:
        header_text = f"""# Sessão de IA: {doc_path}
*Iniciada em {now_iso} por {actor_name} utilizando {model_info or 'AI'}*

## Diálogo da Sessão
"""
        full_session_text = frontmatter_text + "\n\n" + header_text + msg_block
    else:
        full_session_text = frontmatter_text + "\n\n" + session_body.strip() + "\n" + msg_block

    try:
        with open(session_file, "w", encoding="utf-8") as f:
            f.write(full_session_text)
    except Exception as e:
        print(f"Error saving session file: {e}")

def finalize_chat_session(repo_name, doc_path, session_id, custom_summary=None):
    mem_dir = get_memory_dir(repo_name)
    session_file = os.path.join(mem_dir, "sessions", f"{session_id}.md")
    doc_slug = doc_path_to_slug(doc_path)
    handoff_file = os.path.join(mem_dir, "handoffs", f"{doc_slug}.md")
    now_iso = datetime.datetime.now().isoformat()
    actor = get_current_actor()

    session_content = ""
    metrics = {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0, "cached_tokens": 0, "total_latency_ms": 0, "rounds": 0}
    if os.path.exists(session_file):
        try:
            with open(session_file, "r", encoding="utf-8") as f:
                session_content = f.read()
            fm, _ = extract_frontmatter(session_content)
            if fm.get("metrics"):
                metrics = fm.get("metrics")
            session_content = session_content.replace('status: "active"', 'status: "completed"')
            with open(session_file, "w", encoding="utf-8") as f:
                f.write(session_content)
        except Exception:
            pass

    summary_text = custom_summary
    if not summary_text:
        user_msgs = re.findall(r'### 👤 [^\n]+\n\n(.*?)(?=\n###|\Z)', session_content, re.DOTALL)
        if user_msgs:
            last_prompt = user_msgs[-1].strip()[:200]
            summary_text = f"Discussão sobre modelagem e regras de '{doc_path}'. Último tópico abordado: {last_prompt}..."
        else:
            summary_text = f"Sessão de modelagem focada no documento '{doc_path}'."

    handoff_md = f"""---
target_document: "{doc_path}"
last_session_id: "{session_id}"
last_author: "{actor.get('name', 'Developer')}"
last_author_handle: "{actor.get('handle', 'dev')}"
last_author_avatar: "{actor.get('avatar_url', '')}"
updated_at: "{now_iso}"
metrics:
  total_tokens: {metrics.get('total_tokens', 0)}
  prompt_tokens: {metrics.get('prompt_tokens', 0)}
  completion_tokens: {metrics.get('completion_tokens', 0)}
  cached_tokens: {metrics.get('cached_tokens', 0)}
  total_latency_ms: {metrics.get('total_latency_ms', 0)}
  rounds: {metrics.get('rounds', 0)}
---

# Handoff de Contexto: {doc_path}

> **Última Atualização:** {now_iso} por **{actor.get('name', 'Developer')}** (@{actor.get('handle', 'dev')})

## 📌 Resumo da Linha de Raciocínio
{summary_text}

## 🎯 Decisões Tomadas & Regras Estabelecidas
- Modelagem e refinamento das especificações do documento `{doc_path}`.
- Continuidade preservada para as próximas interações do time.

## 📊 Telemetria Consolidada da Sessão
- **Interações (Rounds):** {metrics.get('rounds', 0)}
- **Tokens Totais:** {metrics.get('total_tokens', 0):,} (Entrada: {metrics.get('prompt_tokens', 0):,} | Saída: {metrics.get('completion_tokens', 0):,} | Cache: {metrics.get('cached_tokens', 0):,})
- **Tempo Total de Processamento:** {(metrics.get('total_latency_ms', 0) / 1000.0):.2f}s
"""
    try:
        with open(handoff_file, "w", encoding="utf-8") as f:
            f.write(handoff_md)
    except Exception as e:
        print(f"Error writing handoff: {e}")

    return {
        "success": True,
        "session_id": session_id,
        "doc_path": doc_path,
        "handoff_file": handoff_file,
        "updated_at": now_iso,
        "metrics": metrics
    }

def get_context_briefing(repo_name, doc_path):
    mem_dir = get_memory_dir(repo_name)
    doc_slug = doc_path_to_slug(doc_path)
    handoff_file = os.path.join(mem_dir, "handoffs", f"{doc_slug}.md")
    
    briefing_parts = []
    
    # 1. Handoff específico do documento
    if os.path.exists(handoff_file):
        try:
            with open(handoff_file, "r", encoding="utf-8") as f:
                h_content = f.read()
                h_clean = re.sub(r'^---[\s\S]*?---\n*', '', h_content).strip()
                if h_clean:
                    briefing_parts.append(f"### [MEMÓRIA PREGRESSA & HANDOFF DO DOCUMENTO ATIVO]\n{h_clean}")
        except Exception:
            pass

    # 2. Decisões do Projeto (ADRs)
    decisions_dir = os.path.join(mem_dir, "decisions")
    if os.path.exists(decisions_dir):
        dec_files = sorted(os.listdir(decisions_dir))[:5]
        dec_texts = []
        for df in dec_files:
            if df.endswith(".md"):
                try:
                    with open(os.path.join(decisions_dir, df), "r", encoding="utf-8") as f:
                        d_raw = f.read()
                        d_clean = re.sub(r'^---[\s\S]*?---\n*', '', d_raw).strip()
                        dec_texts.append(f"• **{df}**: {d_clean[:250]}...")
                except Exception:
                    pass
        if dec_texts:
            briefing_parts.append("### [DECISÕES ARQUITETURAIS CONSOLIDADAS DO PROJETO (WIKI ADRs)]\n" + "\n".join(dec_texts))

    # 3. Regras Globais (_rules/)
    rules_dir = os.path.join(mem_dir, "_rules")
    if os.path.exists(rules_dir):
        rule_files = sorted(os.listdir(rules_dir))[:3]
        rule_texts = []
        for rf in rule_files:
            if rf.endswith(".md"):
                try:
                    with open(os.path.join(rules_dir, rf), "r", encoding="utf-8") as f:
                        r_raw = f.read()
                        r_clean = re.sub(r'^---[\s\S]*?---\n*', '', r_raw).strip()
                        rule_texts.append(f"• **{rf}**: {r_clean[:200]}...")
                except Exception:
                    pass
        if rule_texts:
            briefing_parts.append("### [REGRAS E INVARIANTES DO PROJETO (_rules)]\n" + "\n".join(rule_texts))

    return "\n\n".join(briefing_parts)

def list_chat_sessions(repo_name, doc_path=None):
    mem_dir = get_memory_dir(repo_name)
    sessions_dir = os.path.join(mem_dir, "sessions")
    if not os.path.exists(sessions_dir):
        return []
    
    sessions = []
    for fname in os.listdir(sessions_dir):
        if not fname.endswith(".md"):
            continue
        fpath = os.path.join(sessions_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            fm, _ = extract_frontmatter(content)
            target_doc = fm.get("target_document", "")
            if doc_path and target_doc and target_doc != doc_path:
                continue

            sessions.append({
                "session_id": fm.get("session_id", fname.replace(".md", "")),
                "target_document": target_doc,
                "created_at": fm.get("created_at", ""),
                "updated_at": fm.get("updated_at", ""),
                "agent_model": fm.get("agent_model", ""),
                "status": fm.get("status", "completed"),
                "author": fm.get("author", { "name": "Developer", "handle": "dev" }),
                "metrics": fm.get("metrics", {
                    "total_tokens": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "cached_tokens": 0,
                    "total_latency_ms": 0,
                    "rounds": 0
                }),
                "file_name": fname
            })
        except Exception:
            pass
    
    sessions.sort(key=lambda s: s.get("created_at", ""), reverse=True)
    return sessions

def get_chat_session_details(repo_name, session_id):
    mem_dir = get_memory_dir(repo_name)
    sessions_dir = os.path.join(mem_dir, "sessions")
    if not os.path.exists(sessions_dir):
        return None
    
    clean_id = (session_id or "").replace(".md", "")
    session_file = os.path.join(sessions_dir, f"{clean_id}.md")
    if not os.path.exists(session_file):
        for fname in os.listdir(sessions_dir):
            if fname.endswith(".md"):
                fp = os.path.join(sessions_dir, fname)
                try:
                    with open(fp, "r", encoding="utf-8") as f:
                        c = f.read()
                    fm, _ = extract_frontmatter(c)
                    if fm.get("session_id") == session_id or fname.replace(".md", "") == clean_id:
                        session_file = fp
                        break
                except Exception:
                    pass

    if not os.path.exists(session_file):
        return None
    try:
        with open(session_file, "r", encoding="utf-8") as f:
            content = f.read()
        fm, body = extract_frontmatter(content)
        target_doc = fm.get("target_document", "")
        doc_slug = doc_path_to_slug(target_doc)
        handoff_file = os.path.join(mem_dir, "handoffs", f"{doc_slug}.md")
        handoff_content = ""
        if os.path.exists(handoff_file):
            with open(handoff_file, "r", encoding="utf-8") as hf:
                handoff_content = hf.read()

        return {
            "session_id": session_id,
            "target_document": target_doc,
            "frontmatter": fm,
            "body": body,
            "author": fm.get("author", {}),
            "metrics": fm.get("metrics", {
                "total_tokens": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "cached_tokens": 0,
                "total_latency_ms": 0,
                "rounds": 0
            }),
            "handoff": handoff_content
        }
    except Exception as e:
        print(f"Error getting session details: {e}")
        return None

def get_project_wiki(repo_name, query=None):
    mem_dir = get_memory_dir(repo_name)
    categories = ["decisions", "concepts", "gotchas", "_rules", "handoffs"]
    wiki_data = {}
    query_str = (query or "").strip().lower()

    for cat in categories:
        cat_dir = os.path.join(mem_dir, cat)
        items = []
        if os.path.exists(cat_dir):
            for fname in sorted(os.listdir(cat_dir)):
                if not fname.endswith(".md"):
                    continue
                fpath = os.path.join(cat_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        content = f.read()
                    fm, body = extract_frontmatter(content)
                    title = fm.get("title") or fname.replace(".md", "").replace("-", " ").title()
                    slug = fname.replace(".md", "")
                    body_clean = body.strip()

                    # Filtering by query if provided
                    if query_str:
                        searchable = f"{slug} {title} {body_clean} {cat}".lower()
                        if query_str not in searchable:
                            continue

                    items.append({
                        "file_name": fname,
                        "slug": slug,
                        "title": title,
                        "category": cat,
                        "frontmatter": fm,
                        "content": body_clean,
                        "updated_at": fm.get("updated_at") or fm.get("created_at") or ""
                    })
                except Exception:
                    pass
        wiki_data[cat] = items
    return wiki_data

def save_wiki_entry(repo_name, category, slug, title, content, author_info=None):
    mem_dir = get_memory_dir(repo_name)
    if category not in ["decisions", "concepts", "gotchas", "_rules", "handoffs"]:
        category = "decisions"
    cat_dir = os.path.join(mem_dir, category)
    os.makedirs(cat_dir, exist_ok=True)
    
    slug_clean = re.sub(r'[^a-zA-Z0-9_-]', '', slug.replace(" ", "-").lower()).strip("-") or "entry"
    file_path = os.path.join(cat_dir, f"{slug_clean}.md")
    now_iso = datetime.datetime.now().isoformat()
    actor = author_info or get_current_actor()

    fm = f"""---
title: "{title}"
category: "{category}"
slug: "{slug_clean}"
created_at: "{now_iso}"
updated_at: "{now_iso}"
author: "{actor.get('name', 'Developer')}"
author_handle: "{actor.get('handle', 'dev')}"
---

# {title}

{content.strip()}
"""
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(fm)
def delete_wiki_entry(repo_name, category, slug):
    mem_dir = get_memory_dir(repo_name)
    if category not in ["decisions", "concepts", "gotchas", "_rules", "handoffs"]:
        return { "success": False, "error": "Categoria inválida" }
    slug_clean = (slug or "").replace(".md", "").strip()
    file_path = os.path.join(mem_dir, category, f"{slug_clean}.md")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return { "success": True, "deleted": slug_clean, "category": category }
        except Exception as e:
            return { "success": False, "error": str(e) }
    return { "success": False, "error": "Arquivo não encontrado" }

def reset_memory_scope(repo_name, scope="all"):
    mem_dir = get_memory_dir(repo_name)
    deleted_count = 0
    now_iso = datetime.datetime.now().isoformat()
    
    if scope == "all":
        # Delete contents of all subdirectories
        subdirs = ["sessions", "handoffs", "decisions", "concepts", "gotchas", "_rules"]
        for s in subdirs:
            s_path = os.path.join(mem_dir, s)
            if os.path.exists(s_path):
                for fname in os.listdir(s_path):
                    fpath = os.path.join(s_path, fname)
                    if os.path.isfile(fpath):
                        try:
                            os.remove(fpath)
                            deleted_count += 1
                        except Exception:
                            pass
        # Delete log files
        for fname in os.listdir(mem_dir):
            if fname.startswith("log-") and fname.endswith(".md"):
                try:
                    os.remove(os.path.join(mem_dir, fname))
                    deleted_count += 1
                except Exception:
                    pass
        # Re-initialize _meta.yaml
        meta_path = os.path.join(mem_dir, "_meta.yaml")
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                f.write(f"# AI Memory & Spec Governance Catalog\nrepo: {repo_name}\ncreated_at: {now_iso}Z\nversion: 2.0\n")
        except Exception:
            pass
        return {"success": True, "scope": "all", "deleted_count": deleted_count}

    elif scope == "logs":
        for fname in os.listdir(mem_dir):
            if fname.startswith("log-") and fname.endswith(".md"):
                try:
                    os.remove(os.path.join(mem_dir, fname))
                    deleted_count += 1
                except Exception:
                    pass
        return {"success": True, "scope": "logs", "deleted_count": deleted_count}

    elif scope in ["sessions", "handoffs", "decisions", "concepts", "gotchas", "_rules"]:
        s_path = os.path.join(mem_dir, scope)
        if os.path.exists(s_path):
            for fname in os.listdir(s_path):
                fpath = os.path.join(s_path, fname)
                if os.path.isfile(fpath):
                    try:
                        os.remove(fpath)
                        deleted_count += 1
                    except Exception:
                        pass
        return {"success": True, "scope": scope, "deleted_count": deleted_count}

    return {"success": False, "error": f"Escopo de reset desconhecido: {scope}"}

class ModularGovernanceHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 0. Fast Refresh SSE Stream
        if path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            q = queue.Queue()
            with SSE_LOCK:
                SSE_CLIENT_QUEUES.append(q)

            try:
                self.wfile.write(b"event: connected\ndata: {}\n\n")
                self.wfile.flush()
                while True:
                    try:
                        event_type, data = q.get(timeout=25)
                        msg = f"event: {event_type}\ndata: {data}\n\n".encode("utf-8")
                        self.wfile.write(msg)
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
            except Exception:
                pass
            finally:
                with SSE_LOCK:
                    if q in SSE_CLIENT_QUEUES:
                        SSE_CLIENT_QUEUES.remove(q)
            return

        # 1. Status Geral
        if path == "/api/status":
            cfg = load_config()
            ai_settings = cfg.get("ai_settings", {})
            active_repo = cfg.get("active_repo")
            repo_name = active_repo.get("name", "local") if active_repo else "local"
            pending_changes = cfg.get("workspace_changes", {}).get(repo_name, [])

            return self.send_json({
                "authenticated": cfg.get("authenticated", False),
                "user": cfg.get("user"),
                "active_repo": active_repo,
                "pending_changes_count": len(pending_changes),
                "ai_settings": {
                    "provider": ai_settings.get("provider", "gemini"),
                    "model": ai_settings.get("model", "gemini-3.5-flash"),
                    "has_key": bool(ai_settings.get("api_key") or os.environ.get("GEMINI_API_KEY")),
                    "custom_endpoint": ai_settings.get("custom_endpoint", "http://localhost:11434/v1")
                }
            })

        # 2. Central de Alterações Pendentes & Diff Amigável
        if path == "/api/workspace/changes":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "changes": [], "total_additions": 0, "total_deletions": 0, "guardrail": "CLEAN" })

            repo_name = active_repo.get("name", "local")
            raw_changes = cfg.get("workspace_changes", {}).get(repo_name, [])
            
            detailed_changes = []
            total_additions = 0
            total_deletions = 0

            for c in raw_changes:
                diff_data = compute_diff(c.get("old_content", ""), c.get("new_content", ""), c.get("path"))
                total_additions += diff_data["additions"]
                total_deletions += diff_data["deletions"]
                detailed_changes.append({
                    "path": c.get("path"),
                    "type": c.get("type"),
                    "timestamp": c.get("timestamp"),
                    "additions": diff_data["additions"],
                    "deletions": diff_data["deletions"],
                    "diff_text": diff_data["diff_text"],
                    "old_content": c.get("old_content"),
                    "new_content": c.get("new_content")
                })

            total_lines = total_additions + total_deletions
            guardrail = "PEQUENO (Ideal)" if total_lines < 120 else ("MÉDIO" if total_lines < 350 else "GRANDE (Atenção)")

            return self.send_json({
                "repo": active_repo,
                "changes": detailed_changes,
                "total_additions": total_additions,
                "total_deletions": total_deletions,
                "total_files": len(detailed_changes),
                "guardrail": guardrail
            })

        # 3. Configurações Sistêmicas
        if path == "/api/settings":
            cfg = load_config()
            return self.send_json({
                "settings": cfg.get("settings", {
                    "template_creator_prompt": DEFAULT_TEMPLATE_CREATOR_PROMPT,
                    "global_system_prompt": DEFAULT_GLOBAL_SYSTEM_PROMPT,
                    "auto_pr_on_save": False
                }),
                "ai_settings": cfg.get("ai_settings", {})
            })

        # 4. Catálogo de Templates (Persistidos e Customizáveis)
        if path == "/api/templates" or path == "/api/templates/store":
            cfg = load_config()
            raw_tpls = cfg.get("templates", CANONICAL_TEMPLATES)
            canon_map = { t["id"]: t for t in CANONICAL_TEMPLATES }
            cleaned_tpls = []
            for t in raw_tpls:
                if t.get("id") in canon_map:
                    c = canon_map[t["id"]]
                    cleaned_tpls.append({
                        **t,
                        "title": c["title"],
                        "badge": c["badge"],
                        "category": c.get("category", t.get("category")),
                        "description": c.get("description", t.get("description")),
                        "assistant_prompt": c.get("assistant_prompt", t.get("assistant_prompt", "")),
                        "default_filename": c.get("default_filename", t.get("default_filename", "template.md")),
                        "suggested_folder": c.get("suggested_folder", t.get("suggested_folder", "domains"))
                    })
                else:
                    cleaned_tpls.append(t)
            return self.send_json({ "templates": cleaned_tpls })

        # 4.01 Templates Instalados no Repositório Ativo
        if path == "/api/templates/installed":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "installed_templates": [], "count": 0 })
            repo_name = active_repo.get("name", "local")
            installed = get_installed_repo_templates(repo_name)
            return self.send_json({ "installed_templates": installed, "count": len(installed) })

        # 4.012 Workflows Catalog
        if path == "/api/workflows":
            master_cfg = load_projects_master_config()
            workflows = master_cfg.get("workflows", [])
            return self.send_json({ "workflows": workflows, "count": len(workflows) })

        # 4.015 Configuração Oficial do Projeto (Camadas, Níveis, Definições Estratégicas, Taxonomia, Políticas)
        if path == "/api/project/config":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            repo_name = active_repo.get("name", "local") if active_repo else "local"
            proj_cfg = get_project_config(repo_name)
            return self.send_json(proj_cfg)

        # 4.016 Membros do Time e Contribuidores do Projeto (GitHub & Git Local)
        if path == "/api/project/members":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            repo_name = active_repo.get("name", "local") if active_repo else "local"
            members = get_project_team_members(repo_name)
            return self.send_json({ "members": members, "count": len(members) })

        # 4.02 Status de Governança do Projeto Ativo
        if path == "/api/project/status":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "is_initialized": False, "error": "Nenhum repositório ativo" }, 400)
            repo_name = active_repo.get("name", "local")
            status_data = check_repo_governance_status(repo_name)
            return self.send_json(status_data)

        # 4.03 Padrões e Documentos de Engenharia
        if path == "/api/engineering/files":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "files": [], "count": 0 })
            repo_name = active_repo.get("name", "local")
            eng_files = get_engineering_files(repo_name)
            return self.send_json({ "files": eng_files, "count": len(eng_files) })

        # 4.04 Dicionário Ubíquo Estruturado
        if path == "/api/dictionary":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                terms = cfg.get("default_dictionary_terms", [])
                return self.send_json({ "terms": terms, "count": len(terms) })
            repo_name = active_repo.get("name", "local")
            terms = get_project_dictionary(repo_name)
            return self.send_json({ "terms": terms, "count": len(terms) })

        # 4.05 Domínios e Documentos Dinâmicos para Seletores
        if path == "/api/project/domains-docs":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "domains": ["core", "billing", "identidade", "arquitetura"], "documents": [] })
            repo_name = active_repo.get("name", "local")
            data = get_project_domains_and_docs(repo_name)
            return self.send_json(data)

        # 4.06 Verificação Pré-PR de Conflitos e Sincronismo com a Main Remota
        if path == "/api/project/sync-status":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "is_synced": True, "conflict_risk": False, "conflicting_files": [] })
            repo_name = active_repo.get("name", "local")
            sync_data = check_project_sync_status(repo_name)
            return self.send_json(sync_data)

        # 4.07 GitLens / Blame & Auditoria por Documento
        if path == "/api/git/blame":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            file_path = query.get("path", ["index.md"])[0]
            repo_name = active_repo.get("name", "local") if active_repo else "local"
            blame_data = get_file_blame_info(repo_name, file_path)
            return self.send_json(blame_data)

        # 4.1 Catálogo de Tutoriais & Trilha de Conhecimento (DDD, SDD, BDD, TDD)
        if path == "/api/tutorials":
            return self.send_json({ "tutorials": CANONICAL_TUTORIALS })

        # 5. Lista de Repositórios Reais do GitHub
        if path == "/api/repos":
            cfg = load_config()
            token = cfg.get("token", "")
            if not token or not cfg.get("authenticated"):
                return self.send_json({"error": "Não autenticado"}, 401)

            status_code, gh_repos = call_github_api("/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member", token)
            if status_code != 200:
                return self.send_json({"error": f"Erro na API do GitHub: {gh_repos.get('message')}"}, status_code)

            repos_list = []
            if isinstance(gh_repos, list):
                for r in gh_repos:
                    repos_list.append({
                        "name": r.get("name"),
                        "full_name": r.get("full_name"),
                        "owner": r.get("owner", {}).get("login"),
                        "description": r.get("description") or "",
                        "html_url": r.get("html_url"),
                        "is_private": r.get("private", False),
                        "default_branch": r.get("default_branch", "main")
                    })

            return self.send_json({
                "repos": repos_list,
                "user": cfg.get("user"),
                "orgs": cfg.get("orgs", [])
            })

        # 6. Ler Arquivo
        if path == "/api/project/file":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            token = cfg.get("token", "")
            file_path = query.get("path", ["index.md"])[0]

            if not active_repo:
                return self.send_json({"error": "Nenhum repositório ativo selecionado"}, 400)

            repo_name = active_repo.get("name", "local")
            ensure_default_repo_files(repo_name)

            local_file = os.path.join(PROJECTS_DIR, repo_name, file_path)
            if os.path.exists(local_file):
                with open(local_file, "r", encoding="utf-8") as f:
                    return self.send_json({
                        "path": file_path,
                        "content": f.read(),
                        "source": "local"
                    })

            repo_full_name = active_repo.get("full_name")
            gh_status, gh_file = call_github_api(f"/repos/{repo_full_name}/contents/{file_path}", token)

            if gh_status == 200 and "content" in gh_file:
                decoded_content = base64.b64decode(gh_file["content"]).decode("utf-8", errors="replace")
                return self.send_json({
                    "path": file_path,
                    "content": decoded_content,
                    "sha": gh_file.get("sha"),
                    "source": "github"
                })

            return self.send_json({"error": "Arquivo não encontrado"}, 404)

        # 7. Árvore de Documentos Dinâmica & Expandível
        if path == "/api/project/tree":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({"tree": []})

            repo_name = active_repo.get("name", "local")
            ensure_default_repo_files(repo_name)

            repo_dir = os.path.join(PROJECTS_DIR, repo_name)
            tree_data = build_tree(repo_dir, repo_dir)
            return self.send_json({ "repo": active_repo, "tree": tree_data })

        # 7.1 Grafo  Bidirecional, Camadas L1-L4 & Blast Radius
        if path == "/api/project/graph":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "nodes": {}, "stats": {}, "repo": None })

            repo_name = active_repo.get("name", "local")
            ensure_default_repo_files(repo_name)
            graph_data = build_workspace_graph(repo_name)
            return self.send_json(graph_data)

        # 7.2 Contexto de Conectividade de um Documento (Backlinks & Rastreabilidade)
        if path == "/api/project/document-context":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            file_path = query.get("path", ["index.md"])[0].lstrip("/")

            if not active_repo:
                return self.send_json({ "error": "Nenhum repositório ativo" }, 400)

            repo_name = active_repo.get("name", "local")
            graph_data = build_workspace_graph(repo_name)
            nodes = graph_data.get("nodes", {})

            node = nodes.get(file_path)
            if not node:
                # Tentar encontrar por sufixo
                for k, v in nodes.items():
                    if k.endswith(file_path) or file_path.endswith(k):
                        node = v
                        file_path = k
                        break

            if not node:
                node = {
                    "id": file_path.replace("/", "-").replace(".md", ""),
                    "title": file_path,
                    "path": file_path,
                    "layer": "L4_ARTIFACT",
                    "status": "active",
                    "parent": None,
                    "children": [],
                    "dependencies": [],
                    "consumers": [],
                    "blast_radius": []
                }

            return self.send_json({
                "path": file_path,
                "node": node,
                "stats": graph_data.get("stats", {})
            })

        # 7.3 Relatório de Auditoria de Qualidade, SAST & Feedback Loops
        if path == "/api/project/audit":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "score": 100, "grade": "A+", "total_docs": 0, "issues": [], "feedback_loops": [], "checks": {} })

            repo_name = active_repo.get("name", "local")
            ensure_default_repo_files(repo_name)
            audit_report = audit_workspace(repo_name)
            return self.send_json(audit_report)

        # 8. Governança
        if path == "/api/governance":
            cfg = load_config()
            gov = cfg.get("governance", { "min_approvals": 1, "reviewers": [] })
            return self.send_json({ "active_repo": cfg.get("active_repo"), "governance": gov })

        # 9. Listar PRs (Abertos, Aprovados e Histórico Merged)
        if path == "/api/prs":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            prs = cfg.get("prs", [])
            filtered = [p for p in prs if not active_repo or p.get("repo_full_name") == active_repo.get("full_name")]
            
            # Se conectado ao GitHub, enriquece com histórico de PRs remotos
            token = cfg.get("token", "")
            if active_repo and token:
                owner = active_repo.get("owner", {}).get("login") if isinstance(active_repo.get("owner"), dict) else active_repo.get("owner_name")
                name = active_repo.get("name")
                if owner and name:
                    status_code, gh_prs = call_github_api(f"/repos/{owner}/{name}/pulls?state=all&sort=updated&direction=desc&per_page=30", token)
                    if status_code == 200 and isinstance(gh_prs, list):
                        gh_formatted = []
                        local_ids = set(p.get("id") for p in filtered)
                        for gpr in gh_prs:
                            pr_id = gpr.get("number")
                            if pr_id in local_ids:
                                continue
                            st = "MERGED" if gpr.get("merged_at") else ("CLOSED" if gpr.get("state") == "closed" else "OPEN")
                            gh_formatted.append({
                                "id": pr_id,
                                "title": gpr.get("title", ""),
                                "description": gpr.get("body", ""),
                                "status": st,
                                "author": gpr.get("user", {}).get("login", "github"),
                                "branch": gpr.get("head", {}).get("ref", "branch"),
                                "base_branch": gpr.get("base", {}).get("ref", "main"),
                                "html_url": gpr.get("html_url", ""),
                                "created_at": gpr.get("created_at", ""),
                                "merged_at": gpr.get("merged_at", ""),
                                "closed_at": gpr.get("closed_at", ""),
                                "approvals": [],
                                "is_remote": True
                            })
                        filtered = filtered + gh_formatted
            return self.send_json({ "prs": filtered })

        # AI Memory: Briefing e Contexto
        if path == "/api/chat/memory/brief":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            repo_name = query.get("repo", [active_repo.get("name", "default") if active_repo else "default"])[0]
            doc_path = query.get("path", ["index.md"])[0]
            briefing = get_context_briefing(repo_name, doc_path)
            actor = get_current_actor(cfg)
            return self.send_json({
                "repo": repo_name,
                "path": doc_path,
                "briefing": briefing,
                "actor": actor
            })

        # AI Memory: Histórico de Sessões de Chat
        if path == "/api/chat/memory/history":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            repo_name = query.get("repo", [active_repo.get("name", "default") if active_repo else "default"])[0]
            doc_path = query.get("path", [None])[0]
            sessions = list_chat_sessions(repo_name, doc_path)
            return self.send_json({
                "repo": repo_name,
                "path": doc_path,
                "sessions": sessions
            })

        # AI Memory: Detalhes de uma Sessão Específica
        if path == "/api/chat/memory/session":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            repo_name = query.get("repo", [active_repo.get("name", "default") if active_repo else "default"])[0]
            session_id = query.get("session_id", [None])[0]
            if not session_id:
                return self.send_json({ "error": "session_id é obrigatório" }, 400)
            session_data = get_chat_session_details(repo_name, session_id)
            if not session_data:
                return self.send_json({ "error": "Sessão não encontrada" }, 404)
            return self.send_json({
                "repo": repo_name,
                "session": session_data
            })

        # AI Memory: Wiki de Conhecimento e Decisões
        if path == "/api/chat/memory/wiki":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            repo_name = query.get("repo", [active_repo.get("name", "default") if active_repo else "default"])[0]
            search_query = query.get("q", query.get("query", query.get("search", [""])))[0]
            wiki_data = get_project_wiki(repo_name, query=search_query)
            return self.send_json({
                "repo": repo_name,
                "query": search_query,
                "wiki": wiki_data
            })

        # AI Memory: Ator Atual
        if path == "/api/chat/memory/actor":
            cfg = load_config()
            return self.send_json({
                "actor": get_current_actor(cfg)
            })

        # AI: Status de Todos os Provedores & Configuração Ativa
        if path == "/api/ai/settings":
            cfg = load_config()
            return self.send_json(get_all_ai_providers_status(cfg))

        # AI: Descoberta Dinâmica de Modelos por Servidor/Provedor
        if path == "/api/ai/models":
            cfg = load_config()
            provider = query.get("provider", ["gemini"])[0]
            saved = cfg.get("ai_providers", {}).get(provider, {})
            api_key = query.get("api_key", [saved.get("api_key", "")])[0]
            custom_endpoint = query.get("custom_endpoint", [saved.get("custom_endpoint", "")])[0]
            res = fetch_provider_models(provider, api_key, custom_endpoint)
            return self.send_json(res)

        # Servir Arquivos da UI
        if path == "/" or path == "/index.html": target = os.path.join(UI_DIR, "index.html")
        else: target = os.path.join(UI_DIR, path.lstrip("/"))

        if os.path.exists(target) and not os.path.isdir(target):
            mime_type, _ = mimetypes.guess_type(target)
            self.send_response(200)
            self.send_header("Content-Type", mime_type or "text/plain")
            with open(target, "rb") as f: content = f.read()
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try: payload = json.loads(body)
        except Exception: payload = {}

        # 1. Salvar no Workspace Local (Draft com Registro de Modificação)
        if path == "/api/workspace/save":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório ativo selecionado"}, 400)
            
            repo_name = active_repo.get("name", "local")
            file_path = payload.get("path", "index.md").strip().lstrip("/")
            new_content = payload.get("content", "")

            full_target = os.path.join(PROJECTS_DIR, repo_name, file_path)
            os.makedirs(os.path.dirname(full_target), exist_ok=True)

            old_content = ""
            if os.path.exists(full_target):
                with open(full_target, "r", encoding="utf-8") as f:
                    old_content = f.read()

            with open(full_target, "w", encoding="utf-8") as f:
                f.write(new_content)

            if old_content != new_content:
                record_change(repo_name, file_path, "MODIFIED", old_content, new_content)

            return self.send_json({
                "success": True,
                "message": f"Arquivo '{file_path}' salvo no rascunho local com sucesso!",
                "path": file_path
            })

        # 2. Gerar Resumo do PR Unificado com IA
        if path == "/api/workspace/generate-pr-summary":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório ativo"}, 400)
            
            repo_name = active_repo.get("name", "local")
            changes = cfg.get("workspace_changes", {}).get(repo_name, [])

            if not changes:
                return self.send_json({"title": "Atualizações no Workspace", "description": "Nenhuma alteração pendente registrada."})

            ai_settings = cfg.get("ai_settings", { "provider": "gemini", "model": "gemini-3.5-flash", "api_key": "" })
            if ai_settings.get("provider") == "gemini" and not ai_settings.get("api_key"):
                ai_settings["api_key"] = os.environ.get("GEMINI_API_KEY", "")

            diff_summary = []
            for c in changes:
                diff_summary.append(f"ARQUIVO: {c['path']} ({c['type']}):\n```\n{compute_diff(c.get('old_content',''), c.get('new_content',''))['diff_text'][:1000]}\n```")

            joined_diffs = "\n\n".join(diff_summary)
            summary_prompt = f"""Analise as seguintes alterações no projeto `{repo_name}` (DDD / Governança) e gere um Título de PR e uma Descrição Técnica Executiva em formato JSON puro:
{{
  "title": "Título conciso com emoji e verbo no infinitivo (ex: 🚀 Evoluir Bounded Context de Pagamentos e Adicionar Contrato de Webhooks)",
  "description": "Descrição detalhada em Markdown com: 🎯 Motivação das mudanças, 📦 Arquivos Impactados, 🛡️ Conformidade de Governança e Checklist de Validação."
}}

ALTERAÇÕES DO WORKSPACE:
{joined_diffs}

Retorne APENAS o JSON puro válido."""

            status_code, result = call_universal_llm(ai_settings, summary_prompt)
            if status_code == 200 and "reply" in result:
                raw_reply = result["reply"].strip()
                if raw_reply.startswith("```json"): raw_reply = raw_reply[7:]
                if raw_reply.startswith("```"): raw_reply = raw_reply[3:]
                if raw_reply.endswith("```"): raw_reply = raw_reply[:-3]
                try:
                    summary_json = json.loads(raw_reply.strip())
                    return self.send_json({ "success": True, "title": summary_json.get("title"), "description": summary_json.get("description") })
                except Exception:
                    pass

            return self.send_json({
                "success": True,
                "title": f"Atualização Oficial ({len(changes)} arquivo(s))",
                "description": f"Proposta consolidada de alterações em {', '.join(c['path'] for c in changes)}."
            })

        # 3. Criar Pull Request Unificado Consolidado
        if path == "/api/workspace/create-pr":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório ativo"}, 400)
            
            repo_name = active_repo.get("name", "local")
            changes = cfg.get("workspace_changes", {}).get(repo_name, [])

            title = payload.get("title", f"Proposta de Alterações Oficiais ({len(changes)} arquivos)").strip()
            description = payload.get("description", "").strip()

            prs = cfg.get("prs", [])
            new_pr_id = len(prs) + 1
            user = cfg.get("user") or {"name": "Usuário", "login": "dev"}

            new_pr = {
                "id": new_pr_id,
                "repo_full_name": active_repo["full_name"],
                "title": title,
                "description": description,
                "file_path": f"{len(changes)} arquivos no workspace",
                "changes": list(changes),
                "branch": f"governance/unified-pr-{new_pr_id}-{int(time.time())}",
                "author": f"{user.get('name')} (@{user.get('login')})",
                "status": "OPEN",
                "approvals": [],
                "created_at": time.strftime("%d/%m/%Y %H:%M")
            }
            prs.insert(0, new_pr)
            cfg["prs"] = prs
            cfg["workspace_changes"][repo_name] = [] # Limpa as pendências
            save_config(cfg)

            return self.send_json({
                "success": True,
                "pr": new_pr,
                "message": f"🎉 Pull Request #{new_pr_id} criado com sucesso com {len(changes)} alteração(ões) consolidadas!"
            })

        # 4. Descartar Alterações Pendentes do Workspace (Total ou por Arquivo Específico)
        if path == "/api/workspace/discard":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório selecionado"}, 400)
            
            repo_name = active_repo.get("name", "local")
            repo_dir = os.path.join(PROJECTS_DIR, repo_name)
            changes = cfg.get("workspace_changes", {}).get(repo_name, [])
            target_path = payload.get("path") if isinstance(payload, dict) else None

            if target_path:
                # Descartar apenas o arquivo específico
                target_change = None
                remaining_changes = []
                for c in changes:
                    if c.get("path") == target_path:
                        target_change = c
                    else:
                        remaining_changes.append(c)

                if not target_change:
                    return self.send_json({"error": f"Arquivo '{target_path}' não encontrado nas alterações pendentes."}, 404)

                revert_single_change(repo_dir, target_change)

                cfg.setdefault("workspace_changes", {})[repo_name] = remaining_changes
                save_config(cfg)

                new_tree = build_tree(repo_dir, repo_dir)
                return self.send_json({ 
                    "success": True, 
                    "message": f"Alteração no arquivo '{target_path}' descartada com sucesso.", 
                    "tree": new_tree,
                    "remaining_count": len(remaining_changes)
                })
            else:
                # Restaura todos os arquivos e pastas alterados
                for c in changes:
                    revert_single_change(repo_dir, c)

                cfg.setdefault("workspace_changes", {})[repo_name] = []
                save_config(cfg)

                new_tree = build_tree(repo_dir, repo_dir)
                return self.send_json({ "success": True, "message": "Todas as alterações foram descartadas com sucesso.", "tree": new_tree })

        # 4.99 Salvar Configuração Oficial do Projeto (project.config.json)
        if path == "/api/project/config":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório selecionado"}, 400)
            repo_name = active_repo.get("name", "local")
            res = save_project_config(repo_name, payload)
            return self.send_json(res)

        # 4.995 Restaurar Presets Recomendados do Framework para o Projeto
        if path == "/api/project/config/reset":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório selecionado"}, 400)
            repo_name = active_repo.get("name", "local")
            res = reset_project_config(repo_name)
            return self.send_json(res)

        # 5. Criar Arquivo / Domínio na Árvore
        if path == "/api/project/file/create":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório selecionado"}, 400)
            
            repo_name = active_repo.get("name", "local")
            file_path = payload.get("path", "").strip().lstrip("/")
            is_folder = payload.get("is_folder", False)
            content = payload.get("content", "")

            if not file_path:
                return self.send_json({"error": "Nome ou caminho do arquivo é obrigatório"}, 400)

            full_target = os.path.join(PROJECTS_DIR, repo_name, file_path)
            if is_folder:
                os.makedirs(full_target, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(full_target), exist_ok=True)
                if not content:
                    content = f"# 📄 {os.path.basename(file_path)}\n\nDocumentação e especificações oficiais de DDD.\n"
                with open(full_target, "w", encoding="utf-8") as f:
                    f.write(content)
                record_change(repo_name, file_path, "ADDED", "", content)

            repo_dir = os.path.join(PROJECTS_DIR, repo_name)
            new_tree = build_tree(repo_dir, repo_dir)
            return self.send_json({ "success": True, "path": file_path, "tree": new_tree })

        # 5.0 Scaffolding Visual de Domínio, Subdomínio ou Feature Completa (L4)
        if path == "/api/project/scaffold":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório selecionado"}, 400)

            repo_name = active_repo.get("name", "local")
            scaffold_type = payload.get("type", "feature") # 'domain' | 'subdomain' | 'feature'

            result = scaffold_workspace_entity(repo_name, scaffold_type, payload)
            repo_dir = os.path.join(PROJECTS_DIR, repo_name)
            result["tree"] = build_tree(repo_dir, repo_dir)
            result["graph"] = build_workspace_graph(repo_name)
            return self.send_json(result)

        # 5.1 Renomear Arquivo ou Pasta na Árvore
        if path == "/api/project/file/rename":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório selecionado"}, 400)
            
            repo_name = active_repo.get("name", "local")
            old_path = payload.get("old_path", "").strip().lstrip("/")
            new_path = payload.get("new_path", "").strip().lstrip("/")

            if not old_path or not new_path:
                return self.send_json({"error": "Caminho de origem e destino são obrigatórios"}, 400)

            if old_path == "index.md":
                return self.send_json({"error": "O arquivo raiz index.md não pode ser renomeado."}, 400)

            full_old = os.path.join(PROJECTS_DIR, repo_name, old_path)
            full_new = os.path.join(PROJECTS_DIR, repo_name, new_path)

            if not os.path.exists(full_old):
                return self.send_json({"error": f"Arquivo ou pasta de origem '{old_path}' não existe."}, 404)

            if os.path.exists(full_new):
                return self.send_json({"error": f"O destino '{new_path}' já existe."}, 400)

            os.makedirs(os.path.dirname(full_new), exist_ok=True)
            
            old_content = ""
            if os.path.isfile(full_old):
                with open(full_old, "r", encoding="utf-8") as f:
                    old_content = f.read()
                shutil.move(full_old, full_new)
                record_change(repo_name, old_path, "DELETED", old_content, "")
                record_change(repo_name, new_path, "ADDED", "", old_content)
            else:
                shutil.move(full_old, full_new)
                # Directory moved
                record_change(repo_name, old_path, "DELETED", "", "")
                record_change(repo_name, new_path, "ADDED", "", "")

            repo_dir = os.path.join(PROJECTS_DIR, repo_name)
            new_tree = build_tree(repo_dir, repo_dir)
            return self.send_json({ "success": True, "old_path": old_path, "new_path": new_path, "tree": new_tree })

        # 6. Salvar Template
        if path == "/api/templates/save":
            cfg = load_config()
            tpl_id = payload.get("id") or f"custom-{int(time.time()*1000)}"
            title = payload.get("title", "").strip()
            description = payload.get("description", "").strip()
            category = payload.get("category", "Geral").strip()
            badge = payload.get("badge", "📄 Custom").strip()
            content = payload.get("content", "")
            assistant_prompt = payload.get("assistant_prompt", "").strip()
            default_filename = payload.get("default_filename", "template.md").strip()
            suggested_folder = payload.get("suggested_folder", "domains").strip()

            if not title or not content:
                return self.send_json({"error": "Título e Conteúdo do Template são obrigatórios."}, 400)

            templates = cfg.get("templates", [])
            existing_idx = next((i for i, t in enumerate(templates) if t.get("id") == tpl_id), -1)

            template_obj = {
                "id": tpl_id, "title": title, "description": description, "category": category,
                "badge": badge, "content": content, "assistant_prompt": assistant_prompt,
                "default_filename": default_filename, "suggested_folder": suggested_folder, "is_custom": True
            }

            if existing_idx >= 0: templates[existing_idx] = template_obj
            else: templates.insert(0, template_obj)

            cfg["templates"] = templates

            active_repo = cfg.get("active_repo")
            if active_repo:
                repo_name = active_repo.get("name", "local")
                tpl_file_rel = f"templates/{default_filename}"
                tpl_file_abs = os.path.join(PROJECTS_DIR, repo_name, tpl_file_rel)
                os.makedirs(os.path.dirname(tpl_file_abs), exist_ok=True)
                old_c = ""
                if os.path.exists(tpl_file_abs):
                    with open(tpl_file_abs, "r", encoding="utf-8") as f: old_c = f.read()
                with open(tpl_file_abs, "w", encoding="utf-8") as f: f.write(content)
                record_change(repo_name, tpl_file_rel, "ADDED" if not old_c else "MODIFIED", old_c, content)

            save_config(cfg)
            return self.send_json({ "success": True, "template": template_obj, "message": f"Template '{title}' salvo no workspace!" })

        # 7. Assistente Criador de Templates com IA
        if path == "/api/templates/generate-ai":
            idea = payload.get("idea", "").strip()
            if not idea:
                return self.send_json({"error": "Por favor descreva a ideia ou finalidade do template."}, 400)

            cfg = load_config()
            ai_settings = cfg.get("ai_settings", { "provider": "gemini", "model": "gemini-3.5-flash", "api_key": "" })
            if ai_settings.get("provider") == "gemini" and not ai_settings.get("api_key"):
                ai_settings["api_key"] = os.environ.get("GEMINI_API_KEY", "")

            system_prompt = cfg.get("settings", {}).get("template_creator_prompt", DEFAULT_TEMPLATE_CREATOR_PROMPT)
            user_prompt = f"Crie um template completo e seu assistente de IA com base nesta ideia/necessidade:\n\n{idea}"

            status_code, result = call_universal_llm(ai_settings, user_prompt, custom_system_prompt=system_prompt)
            if status_code == 200 and "reply" in result:
                raw_reply = result["reply"].strip()
                if raw_reply.startswith("```json"): raw_reply = raw_reply[7:]
                if raw_reply.startswith("```"): raw_reply = raw_reply[3:]
                if raw_reply.endswith("```"): raw_reply = raw_reply[:-3]
                try:
                    generated_tpl = json.loads(raw_reply.strip())
                    return self.send_json({ "success": True, "generated": generated_tpl })
                except Exception:
                    return self.send_json({ "success": True, "raw": raw_reply })

            return self.send_json(result, status_code)

        # 7.1 Instalar Template no Projeto Ativo (templates/ local)
        # 4.04 Salvar Dicionário Ubíquo
        if path == "/api/dictionary/save":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "error": "Nenhum repositório ativo" }, 400)
            repo_name = active_repo.get("name", "local")
            terms = payload.get("terms", [])
            save_project_dictionary(repo_name, terms)
            return self.send_json({ "success": True, "count": len(terms) })

        if path == "/api/templates/install":
            template_id = payload.get("template_id")
            if not template_id:
                return self.send_json({"error": "template_id é obrigatório."}, 400)

            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({"error": "Nenhum repositório ativo selecionado"}, 400)

            repo_name = active_repo.get("name", "local")
            all_tpls = cfg.get("templates", CANONICAL_TEMPLATES)
            tpl = next((t for t in all_tpls if t.get("id") == template_id), None)
            if not tpl:
                tpl = next((t for t in CANONICAL_TEMPLATES if t.get("id") == template_id), None)

            if not tpl:
                return self.send_json({"error": "Template não encontrado na Store."}, 404)

            filename = tpl.get("default_filename") or f"{template_id}.md"
            tpl_dir = os.path.join(PROJECTS_DIR, repo_name, "templates")
            os.makedirs(tpl_dir, exist_ok=True)
            target_path = os.path.join(tpl_dir, filename)

            with open(target_path, "w", encoding="utf-8") as f:
                f.write(tpl.get("content", ""))

            record_change(repo_name, f"templates/{filename}", "ADDED", "", tpl.get("content", ""))
            return self.send_json({
                "success": True,
                "installed_path": f"templates/{filename}",
                "template": tpl,
                "message": f"Template '{tpl.get('title')}' instalado com sucesso em templates/{filename}!"
            })

        # 7.15 Aplicar Workflow de Templates no Projeto Ativo
        if path == "/api/workflows/apply":
            workflow_id = payload.get("id") or payload.get("workflow_id")
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "error": "Nenhum repositório ativo selecionado" }, 400)
            repo_name = active_repo.get("name", "local")
            workflows = cfg.get("workflows", [])
            target_wf = next((w for w in workflows if w.get("id") == workflow_id), None)
            if not target_wf:
                return self.send_json({ "error": f"Workflow '{workflow_id}' não encontrado" }, 404)

            tpl_dir = os.path.join(PROJECTS_DIR, repo_name, "templates")
            os.makedirs(tpl_dir, exist_ok=True)
            installed_files = []
            all_tpls = load_canonical_templates()

            for tpl_ref in target_wf.get("templates", []):
                src_path = os.path.join(TEMPLATES_DIR, tpl_ref)
                if not os.path.exists(src_path):
                    matched = next((t for t in all_tpls if t.get("id") == tpl_ref or t.get("source_file") == tpl_ref or t.get("default_filename") == tpl_ref), None)
                    if matched and matched.get("source_file"):
                        src_path = os.path.join(TEMPLATES_DIR, matched["source_file"])

                if os.path.exists(src_path):
                    dest_name = os.path.basename(src_path)
                    dest_path = os.path.join(tpl_dir, dest_name)
                    with open(src_path, "r", encoding="utf-8") as sf:
                        tpl_content = sf.read()
                    with open(dest_path, "w", encoding="utf-8") as df:
                        df.write(tpl_content)
                    record_change(repo_name, f"templates/{dest_name}", "ADDED", "", tpl_content)
                    installed_files.append(dest_name)

            return self.send_json({
                "success": True,
                "workflow": target_wf.get("name"),
                "installed_templates": installed_files,
                "message": f"Workflow '{target_wf.get('name')}' aplicado com sucesso! {len(installed_files)} templates instalados no projeto."
            })

        # 7.2 Bootstrap de Governança no Projeto Ativo (1-Click)
        if path == "/api/project/bootstrap":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({"error": "Nenhum repositório ativo selecionado"}, 400)

            repo_name = active_repo.get("name", "local")
            starter_pack = payload.get("starter_pack", "standard")
            res = bootstrap_repo_governance(repo_name, starter_pack)
            return self.send_json(res)

        # 8. Salvar Configurações Sistêmicas
        if path == "/api/settings/save":
            cfg = load_config()
            settings_payload = payload.get("settings", {})
            if "settings" not in cfg: cfg["settings"] = {}
            if "template_creator_prompt" in settings_payload: cfg["settings"]["template_creator_prompt"] = settings_payload["template_creator_prompt"]
            if "global_system_prompt" in settings_payload: cfg["settings"]["global_system_prompt"] = settings_payload["global_system_prompt"]
            if "auto_pr_on_save" in settings_payload: cfg["settings"]["auto_pr_on_save"] = bool(settings_payload["auto_pr_on_save"])

            save_config(cfg)
            return self.send_json({ "success": True, "settings": cfg["settings"], "message": "Configurações sistêmicas salvas com sucesso!" })

        # 8.8 Criar Padrão / Documento de Engenharia
        if path == "/api/engineering/create":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo:
                return self.send_json({ "error": "Nenhum repositório ativo" }, 400)
            repo_name = active_repo.get("name", "local")
            title = payload.get("title", "").strip()
            category = payload.get("category", "Padrão de Engenharia").strip()
            filename = payload.get("filename", "").strip()
            content = payload.get("content", "").strip()
            if not filename.endswith(".md"):
                filename += ".md"
            rel_path = f"engenharia/{filename}"
            if not content:
                content = f"""---
id: "pattern-{filename.replace('.md', '').lower()}"
title: "{title or filename.replace('.md', '').title()}"
type: "pattern"
version: "1.0.0"
status: "active"
layer: "L4_ARTIFACT"
path: "{rel_path}"
parent: "project/index.md"
---

# ⚙️ {title or filename.replace('.md', '').title()}

## 1. Contexto & Motivação
Descreva o contexto do problema técnico e a decisão de engenharia tomada.

## 2. Diretrizes Técnicas
Especificações, contratos, bibliotecas e regras mandatórias.
"""
            full_target = os.path.join(PROJECTS_DIR, repo_name, rel_path)
            os.makedirs(os.path.dirname(full_target), exist_ok=True)
            with open(full_target, "w", encoding="utf-8") as f:
                f.write(content)
            record_change(repo_name, rel_path, "ADDED", "", content)
            return self.send_json({ "success": True, "path": rel_path, "message": f"Padrão '{rel_path}' criado com sucesso!" })

        # 9. Login Token PAT
        if path == "/api/auth/token":
            token = payload.get("token", "").strip()
            if not token: return self.send_json({"error": "Por favor informe o token PAT."}, 400)
            status_code, user_data = call_github_api("/user", token)
            if status_code != 200: return self.send_json({"error": f"Token inválido: {user_data.get('message')}"}, 401)
            _, orgs_data = call_github_api("/user/orgs", token)
            orgs_list = [{"login": o["login"], "description": o.get("description", "")} for o in (orgs_data if isinstance(orgs_data, list) else [])]
            cfg = load_config()
            cfg["authenticated"] = True
            cfg["token"] = token
            cfg["user"] = { "login": user_data.get("login"), "name": user_data.get("name") or user_data.get("login"), "avatar_url": user_data.get("avatar_url"), "html_url": user_data.get("html_url") }
            cfg["orgs"] = orgs_list
            save_config(cfg)
            return self.send_json({"success": True, "user": cfg["user"]})

        # 10. Configurações da IA (Multi-Provider Persistence)
        if path == "/api/ai/settings":
            provider = payload.get("provider", "gemini").lower()
            model = payload.get("model", "gemini-3.5-flash")
            api_key = payload.get("api_key", "").strip()
            custom_endpoint = payload.get("custom_endpoint", "http://localhost:11434/v1")

            cfg = load_config()
            if "ai_providers" not in cfg:
                cfg["ai_providers"] = {}

            saved_p = cfg["ai_providers"].get(provider, {})
            final_key = api_key if api_key else saved_p.get("api_key", "")
            final_endpoint = custom_endpoint if custom_endpoint else saved_p.get("custom_endpoint", "http://localhost:11434/v1")
            final_model = model or saved_p.get("model", "gemini-3.5-flash")

            cfg["ai_providers"][provider] = {
                "model": final_model,
                "api_key": final_key,
                "custom_endpoint": final_endpoint
            }

            cfg["ai_settings"] = {
                "provider": provider,
                "model": final_model,
                "api_key": final_key,
                "custom_endpoint": final_endpoint
            }
            save_config(cfg)
            return self.send_json({
                "success": True,
                "ai_settings": cfg["ai_settings"],
                "all_providers": get_all_ai_providers_status(cfg)
            })

        # 11. Agentic Chat Multi-Model com Memória Contínua Automática
        if path == "/api/chat":
            prompt = payload.get("prompt", "").strip()
            doc_context = payload.get("content", "")
            file_path = payload.get("path", "index.md")
            history = payload.get("history", [])
            assistant_prompt = payload.get("assistant_prompt", "")
            session_id = payload.get("session_id") or f"{datetime.datetime.now().strftime('%Y-%m-%d-%H%M%S')}-{doc_path_to_slug(file_path)[:15]}"
            repo_name = payload.get("repo")

            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not repo_name:
                repo_name = active_repo.get("name", "default") if active_repo else "default"

            actor = get_current_actor(cfg)

            ai_settings = cfg.get("ai_settings", { "provider": "gemini", "model": "gemini-3.5-flash", "api_key": "" })
            active_p = ai_settings.get("provider", "gemini")
            saved_p = cfg.get("ai_providers", {}).get(active_p, {})
            if not ai_settings.get("api_key") and saved_p.get("api_key"):
                ai_settings["api_key"] = saved_p.get("api_key")
            if not ai_settings.get("custom_endpoint") and saved_p.get("custom_endpoint"):
                ai_settings["custom_endpoint"] = saved_p.get("custom_endpoint")
            if active_p == "gemini" and not ai_settings.get("api_key"):
                ai_settings["api_key"] = os.environ.get("GEMINI_API_KEY", "")

            # Injeta Handoff pregresso e regras da Wiki no System Prompt
            briefing = get_context_briefing(repo_name, file_path)
            base_sys_prompt = assistant_prompt or cfg.get("settings", {}).get("global_system_prompt", DEFAULT_GLOBAL_SYSTEM_PROMPT)
            if briefing:
                sys_prompt = f"{base_sys_prompt}\n\n{briefing}"
            else:
                sys_prompt = base_sys_prompt

            status_code, result = call_universal_llm(ai_settings, prompt, doc_context, file_path, history, custom_system_prompt=sys_prompt)

            if status_code == 200 and isinstance(result, dict) and ("reply" in result or "response" in result):
                reply_text = result.get("reply") or result.get("response", "")
                model_used = f"{result.get('provider', 'AI')} ({result.get('model', ai_settings.get('model', ''))})"
                append_chat_event(repo_name, file_path, session_id, "user", prompt, model_info=model_used, author_info=actor)
                append_chat_event(repo_name, file_path, session_id, "model", reply_text, model_info=model_used, author_info=actor, telemetry_info=result)
                result["session_id"] = session_id
                result["actor"] = actor
                result["repo"] = repo_name

            return self.send_json(result, status_code)

        # AI Memory: Gravação manual/assíncrona de evento
        if path == "/api/chat/memory/event":
            repo_name = payload.get("repo", "default")
            doc_path = payload.get("path", "index.md")
            session_id = payload.get("session_id")
            role = payload.get("role", "user")
            text = payload.get("text", "")
            model_info = payload.get("model")
            actor = get_current_actor()
            if not session_id:
                session_id = f"{datetime.datetime.now().strftime('%Y-%m-%d-%H%M%S')}-{doc_path_to_slug(doc_path)[:15]}"
            append_chat_event(repo_name, doc_path, session_id, role, text, model_info=model_info, author_info=actor)
            return self.send_json({ "success": True, "session_id": session_id })

        # AI Memory: Finalizar sessão e gerar Handoff
        if path == "/api/chat/memory/finalize":
            repo_name = payload.get("repo", "default")
            doc_path = payload.get("path", "index.md")
            session_id = payload.get("session_id")
            custom_summary = payload.get("summary")
            if not session_id:
                return self.send_json({ "error": "session_id é obrigatório" }, 400)
            res = finalize_chat_session(repo_name, doc_path, session_id, custom_summary)
            return self.send_json(res)

        # AI Memory: Salvar entrada na Wiki (ADR, Conceito, Regra)
        if path == "/api/chat/memory/wiki":
            repo_name = payload.get("repo", "default")
            category = payload.get("category", "decisions")
            slug = payload.get("slug", "entry")
            title = payload.get("title", slug)
            content = payload.get("content", "")
            actor = get_current_actor()
            res = save_wiki_entry(repo_name, category, slug, title, content, author_info=actor)
            return self.send_json(res)

        # AI Memory: Deletar entrada da Wiki
        if path == "/api/chat/memory/wiki/delete":
            repo_name = payload.get("repo", "default")
            category = payload.get("category", "decisions")
            slug = payload.get("slug", "")
            if not slug:
                return self.send_json({ "error": "slug é obrigatório" }, 400)
            res = delete_wiki_entry(repo_name, category, slug)
            return self.send_json(res)

        # AI Memory: Reset Granular de Memória (Dev Tools)
        if path == "/api/chat/memory/reset":
            repo_name = payload.get("repo", "default")
            scope = payload.get("scope", "all")
            res = reset_memory_scope(repo_name, scope=scope)
            return self.send_json(res)

        # 12. Logout
        if path == "/api/auth/logout":
            cfg = load_config()
            cfg["authenticated"] = False
            cfg["token"] = ""
            cfg["user"] = None
            cfg["orgs"] = []
            cfg["active_repo"] = None
            save_config(cfg)
            return self.send_json({"success": True})

        # 13. Selecionar Repositório
        if path == "/api/repos/select":
            cfg = load_config()
            cfg["active_repo"] = {
                "name": payload.get("name"), "full_name": payload.get("full_name"),
                "html_url": payload.get("html_url"), "description": payload.get("description"),
                "is_private": payload.get("is_private", False), "default_branch": payload.get("default_branch", "main")
            }
            ensure_default_repo_files(payload.get("name"))
            save_config(cfg)
            return self.send_json({"success": True, "active_repo": cfg["active_repo"]})

        # 14. Criar Repositório Real
        if path == "/api/repos/create":
            repo_name = payload.get("name", "").strip().lower().replace(" ", "-")
            owner = payload.get("owner", "").strip()
            description = payload.get("description", "Repositório  de Governança").strip()
            is_private = bool(payload.get("is_private", True))
            enable_protection = bool(payload.get("enable_protection", True))
            required_approvals = int(payload.get("required_approvals", 1))

            if not repo_name: return self.send_json({"error": "Nome do repositório é obrigatório"}, 400)
            cfg = load_config()
            token = cfg.get("token", "")
            if not token or not cfg.get("authenticated"): return self.send_json({"error": "Não autenticado no GitHub"}, 401)

            is_org = any(o["login"].lower() == owner.lower() for o in cfg.get("orgs", []))
            endpoint = f"/orgs/{owner}/repos" if is_org else "/user/repos"
            status_code, resp_data = call_github_api(endpoint, token, method="POST", data={
                "name": repo_name, "description": description, "private": is_private, "auto_init": True
            })

            if status_code not in [200, 201]:
                return self.send_json({ "error": f"Erro ao criar repositório no GitHub: {resp_data.get('message')}" }, status_code)

            owner_login = resp_data.get("owner", {}).get("login") or owner
            repo_full_name = resp_data.get("full_name") or f"{owner_login}/{repo_name}"
            default_branch = resp_data.get("default_branch", "main")

            protection_status = "Não solicitada"
            if enable_protection:
                time.sleep(1)
                p_code, p_res = apply_branch_protection(repo_full_name, default_branch, token, required_approvals)
                protection_status = "Ativada com sucesso" if p_code in [200, 201] else f"Aviso ({p_res.get('message', 'Pendente')})"

            ensure_default_repo_files(repo_name)

            cfg["active_repo"] = {
                "name": repo_name, "full_name": repo_full_name, "html_url": resp_data.get("html_url") or f"https://github.com/{repo_full_name}",
                "description": description, "is_private": is_private, "protection": protection_status
            }
            save_config(cfg)
            return self.send_json({ "success": True, "message": f"Repositório {repo_full_name} criado no GitHub!", "repo": cfg["active_repo"] })

        # 15. Adicionar Reviewer
        if path == "/api/governance/reviewers":
            name = payload.get("name", "").strip()
            handle = payload.get("handle", "").strip()
            role = payload.get("role", "Tech Lead").strip()
            tier = payload.get("tier", "Tier 0 (Global)").strip()

            if not handle or not name: return self.send_json({"error": "Nome e GitHub handle são obrigatórios"}, 400)
            if not handle.startswith("@"): handle = f"@{handle}"

            cfg = load_config()
            if "governance" not in cfg: cfg["governance"] = { "min_approvals": 1, "reviewers": [] }
            new_rev = { "id": str(int(time.time() * 1000)), "name": name, "handle": handle, "role": role, "tier": tier }
            cfg["governance"]["reviewers"].append(new_rev)
            save_config(cfg)
            return self.send_json({"success": True, "reviewer": new_rev, "reviewers": cfg["governance"]["reviewers"]})

        # 16. Atualizar Mínimo de Aprovações
        if path == "/api/governance/settings":
            min_approvals = int(payload.get("min_approvals", 1))
            cfg = load_config()
            if "governance" not in cfg: cfg["governance"] = { "min_approvals": 1, "reviewers": [] }
            cfg["governance"]["min_approvals"] = min_approvals
            save_config(cfg)
            active_repo = cfg.get("active_repo")
            token = cfg.get("token")
            if active_repo and token:
                apply_branch_protection(active_repo["full_name"], active_repo.get("default_branch", "main"), token, min_approvals)
            return self.send_json({ "success": True, "message": f"Regra atualizada: Requer {min_approvals} aprovação(ões).", "min_approvals": min_approvals })

        # 17. Aprovar PR (Com Auto-Merge por Quórum de Governança)
        if path == "/api/prs/approve":
            pr_id = payload.get("id")
            cfg = load_config()
            prs = cfg.get("prs", [])
            target = next((p for p in prs if p["id"] == pr_id), None)
            if not target: return self.send_json({"error": "PR não encontrado"}, 404)
            
            gov = cfg.get("governance", { "min_approvals": 1, "reviewers": [] })
            min_approvals = gov.get("min_approvals", 1)
            
            user_login = cfg.get("user", {}).get("login") if cfg.get("user") else None
            approver = payload.get("approver") or (f"@{user_login}" if user_login else "Tech Lead (@tech-leads)")
            
            if "approvals" not in target or not isinstance(target["approvals"], list):
                target["approvals"] = []
                
            if approver not in target["approvals"]:
                target["approvals"].append(approver)
                
            if len(target["approvals"]) >= min_approvals:
                execute_pr_merge(target, cfg)
                return self.send_json({
                    "success": True,
                    "auto_merged": True,
                    "pr": target,
                    "message": f"🎉 Quórum de aprovação atingido ({len(target['approvals'])}/{min_approvals})! O PR #{pr_id} foi aprovado e o merge foi executado automaticamente na branch main."
                })
            else:
                target["status"] = "OPEN"
                save_config(cfg)
                return self.send_json({
                    "success": True,
                    "auto_merged": False,
                    "pr": target,
                    "message": f"✓ Aprovação registrada por {approver} ({len(target['approvals'])}/{min_approvals}). Aguardando quórum para auto-merge."
                })

        # 18. Merge PR Manual (Fallback)
        if path == "/api/prs/merge":
            pr_id = payload.get("id")
            cfg = load_config()
            prs = cfg.get("prs", [])
            target = next((p for p in prs if p["id"] == pr_id), None)
            if not target: return self.send_json({"error": "PR não encontrado"}, 404)
            
            execute_pr_merge(target, cfg)
            return self.send_json({
                "success": True,
                "pr": target,
                "message": f"PR #{pr_id} mesclado com sucesso na branch main!"
            })

        self.send_json({"error": "Endpoint não encontrado"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. Remover Template Customizado
        if path == "/api/templates":
            tpl_id = query.get("id", [""])[0]
            if not tpl_id: return self.send_json({"error": "ID do template obrigatório"}, 400)
            cfg = load_config()
            templates = cfg.get("templates", [])
            cfg["templates"] = [t for t in templates if t.get("id") != tpl_id]
            save_config(cfg)
            return self.send_json({ "success": True, "templates": cfg["templates"], "message": "Template removido com sucesso." })

        # 2. Remover Arquivo / Pasta da Árvore (Registra DELETED no Workspace)
        if path == "/api/project/file":
            cfg = load_config()
            active_repo = cfg.get("active_repo")
            if not active_repo: return self.send_json({"error": "Nenhum repositório ativo"}, 400)
            
            repo_name = active_repo.get("name", "local")
            file_path = query.get("path", [""])[0].strip().lstrip("/")
            
            if not file_path or file_path == "index.md":
                return self.send_json({"error": "O arquivo raiz index.md não pode ser removido."}, 400)

            full_target = os.path.join(PROJECTS_DIR, repo_name, file_path)
            old_content = ""
            if os.path.exists(full_target):
                if os.path.isfile(full_target):
                    with open(full_target, "r", encoding="utf-8") as f: old_content = f.read()
                    os.remove(full_target)
                elif os.path.isdir(full_target):
                    shutil.rmtree(full_target)
            
            record_change(repo_name, file_path, "DELETED", old_content, "")

            repo_dir = os.path.join(PROJECTS_DIR, repo_name)
            new_tree = build_tree(repo_dir, repo_dir)
            return self.send_json({ "success": True, "path": file_path, "tree": new_tree })

        # 3. Remover Reviewer de Governança
        if path == "/api/governance/reviewers":
            rev_id = query.get("id", [""])[0]
            cfg = load_config()
            reviewers = cfg.get("governance", {}).get("reviewers", [])
            cfg["governance"]["reviewers"] = [r for r in reviewers if r["id"] != rev_id]
            save_config(cfg)
            return self.send_json({"success": True, "reviewers": cfg["governance"]["reviewers"]})

        self.send_json({"error": "Endpoint não encontrado"}, 404)

def run(port=4100):
    start_file_watcher()
    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, ModularGovernanceHandler)
    print(f"🚀 Governance Boilerplate rodando com ⚡ Fast Refresh em http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()

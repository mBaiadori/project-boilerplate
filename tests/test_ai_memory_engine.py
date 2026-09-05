import os
import shutil
import pytest
import datetime
from server import (
    get_current_actor,
    sanitize_memory_text,
    get_memory_dir,
    doc_path_to_slug,
    append_chat_event,
    finalize_chat_session,
    get_context_briefing,
    list_chat_sessions,
    get_project_wiki,
    save_wiki_entry,
    PROJECTS_DIR
)

TEST_REPO = "test-memory-repo"

@pytest.fixture(autouse=True)
def cleanup_test_repo():
    test_repo_dir = os.path.join(PROJECTS_DIR, TEST_REPO)
    os.makedirs(test_repo_dir, exist_ok=True)
    yield
    if os.path.exists(test_repo_dir):
        shutil.rmtree(test_repo_dir, ignore_errors=True)

def test_sanitize_memory_text():
    raw_text = "My secret token is ghp_123456789012345678901234567890123456 and api_key='sk-abcdefghijklmnopqrstuvwxyz123456'"
    sanitized = sanitize_memory_text(raw_text)
    assert "ghp_" not in sanitized
    assert "REDACTED" in sanitized

def test_get_current_actor():
    actor = get_current_actor({"user": {"name": "Alice", "login": "alice", "avatar_url": "http://example.com/avatar.png"}})
    assert actor["name"] == "Alice"
    assert actor["handle"] == "alice"
    assert actor["avatar_url"] == "http://example.com/avatar.png"

def test_memory_lifecycle_and_handoff():
    doc_path = "specs/01-auth/login.md"
    session_id = "test-sess-001"
    
    # 1. Append chat events
    append_chat_event(TEST_REPO, doc_path, session_id, "user", "Como modelar o refresh token seguro?", model_info="gemini-3.5-flash")
    append_chat_event(TEST_REPO, doc_path, session_id, "model", "Recomendo usar cookies httpOnly com SameSite=Strict.", model_info="gemini-3.5-flash")

    # Verify session file was created
    mem_dir = get_memory_dir(TEST_REPO)
    session_file = os.path.join(mem_dir, "sessions", f"{session_id}.md")
    assert os.path.exists(session_file)

    with open(session_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "refresh token seguro" in content
    assert "httpOnly" in content

    # 2. Finalize session and generate Handoff
    res = finalize_chat_session(TEST_REPO, doc_path, session_id, "Decisão de usar cookies httpOnly para refresh token.")
    assert res["success"] is True

    # Verify Handoff file was created
    doc_slug = doc_path_to_slug(doc_path)
    handoff_file = os.path.join(mem_dir, "handoffs", f"{doc_slug}.md")
    assert os.path.exists(handoff_file)

    with open(handoff_file, "r", encoding="utf-8") as f:
        h_content = f.read()
    assert "httpOnly" in h_content

    # 3. Context Briefing
    briefing = get_context_briefing(TEST_REPO, doc_path)
    assert "MEMÓRIA PREGRESSA & HANDOFF DO DOCUMENTO ATIVO" in briefing
    assert "httpOnly" in briefing

    # 4. List chat sessions
    sessions = list_chat_sessions(TEST_REPO, doc_path)
    assert len(sessions) == 1
    assert sessions[0]["session_id"] == session_id

def test_wiki_entries():
    # 1. Save an ADR
    save_wiki_entry(TEST_REPO, "decisions", "0001-jwt-auth", "0001: Autenticação Stateless com JWT", "Decidimos adotar JWT assinado com RSA-256.")
    
    # 2. Save a Rule
    save_wiki_entry(TEST_REPO, "_rules", "lgpd-rule", "Conformidade LGPD", "Nenhum dado sensível em logs abertos.")

    wiki = get_project_wiki(TEST_REPO)
    assert len(wiki["decisions"]) == 1
    assert wiki["decisions"][0]["slug"] == "0001-jwt-auth"
    assert "JWT" in wiki["decisions"][0]["title"]
    assert len(wiki["_rules"]) == 1

def test_multi_provider_discovery_and_status():
    from server import fetch_provider_models, get_all_ai_providers_status
    
    # 1. Fallback / Curated discovery
    gemini_res = fetch_provider_models("gemini")
    assert gemini_res["provider"] == "gemini"
    assert "gemini-3.5-flash" in gemini_res["models"]
    
    openai_res = fetch_provider_models("openai")
    assert openai_res["provider"] == "openai"
    assert "gpt-4o" in openai_res["models"]

    local_res = fetch_provider_models("local")
    assert local_res["provider"] == "local"
    assert len(local_res["models"]) > 0

    # 2. Multi-provider status dictionary
    mock_cfg = {
        "ai_settings": { "provider": "openai", "model": "gpt-4o" },
        "ai_providers": {
            "gemini": { "api_key": "AIzaSyFakeKey", "model": "gemini-3.5-flash" },
            "openai": { "api_key": "sk-fakeKey", "model": "gpt-4o" },
            "local": { "custom_endpoint": "http://localhost:11434/v1", "model": "deepseek-r1:latest" }
        }
    }
    status = get_all_ai_providers_status(mock_cfg)
    assert status["active_provider"] == "openai"
    assert status["providers"]["gemini"]["configured"] is True
    assert status["providers"]["openai"]["configured"] is True
    assert status["providers"]["openai"]["is_active"] is True
    assert status["providers"]["local"]["configured"] is True
    assert status["providers"]["anthropic"]["configured"] is False


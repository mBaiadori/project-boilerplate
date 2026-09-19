// =============================================================================
// AUTH VIEW CONTROLLER
// =============================================================================
import { API } from './api.js';

export function initAuthView({ onLoginSuccess }) {
  const patTokenInput = document.getElementById('pat-token-input');
  const btnTokenLogin = document.getElementById('btn-token-login');
  const statusMsg = document.getElementById('auth-status-msg');

  function showMessage(text, type = 'error') {
    if (!statusMsg) return;
    statusMsg.style.display = 'block';
    if (type === 'error') {
      statusMsg.style.background = '#fef2f2';
      statusMsg.style.color = '#991b1b';
      statusMsg.style.border = '1px solid #fecaca';
      statusMsg.innerHTML = `<strong>⚠️ Erro:</strong> ${text}`;
    } else if (type === 'info') {
      statusMsg.style.background = '#eff6ff';
      statusMsg.style.color = '#1e40af';
      statusMsg.style.border = '1px solid #bfdbfe';
      statusMsg.innerHTML = `<span class="material-symbols-outlined icon-xs" style="vertical-align: middle;">sync</span> ${text}`;
    } else if (type === 'success') {
      statusMsg.style.background = '#f0fdf4';
      statusMsg.style.color = '#166534';
      statusMsg.style.border = '1px solid #bbf7d0';
      statusMsg.innerHTML = `<strong>✓ Sucesso:</strong> ${text}`;
    }
  }

  function hideMessage() {
    if (statusMsg) {
      statusMsg.style.display = 'none';
      statusMsg.innerHTML = '';
    }
  }

  async function handleLogin() {
    hideMessage();
    const token = (patTokenInput?.value || '').trim();
    if (!token) {
      showMessage('Por favor, cole seu Personal Access Token (PAT) do GitHub no campo acima.', 'error');
      if (patTokenInput) patTokenInput.focus();
      return;
    }

    if (btnTokenLogin) {
      btnTokenLogin.disabled = true;
      btnTokenLogin.innerHTML = '<span class="material-symbols-outlined icon-xs">sync</span> Autenticando no GitHub...';
    }
    showMessage('Conectando ao GitHub e validando permissões...', 'info');

    try {
      const { ok, data } = await API.loginWithToken(token);
      if (ok && data.success) {
        if (patTokenInput) patTokenInput.value = '';
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        const errMsg = data?.error || 'Token inválido ou sem permissões necessárias (repo, read:org).';
        showMessage(errMsg, 'error');
      }
    } catch (err) {
      console.error('[Auth] Erro ao conectar:', err);
      showMessage('Falha na comunicação com o servidor local (porta 4100).', 'error');
    } finally {
      if (btnTokenLogin) {
        btnTokenLogin.disabled = false;
        btnTokenLogin.innerHTML = '<span class="material-symbols-outlined icon-xs">login</span> Conectar Conta & Acessar';
      }
    }
  }

  if (btnTokenLogin) {
    btnTokenLogin.onclick = (e) => {
      e.preventDefault();
      handleLogin();
    };
  }

  if (patTokenInput) {
    patTokenInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    };
  }
}

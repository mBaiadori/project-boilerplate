// =============================================================================
// AUTH VIEW CONTROLLER
// =============================================================================
import { API } from './api.js';

export function initAuthView({ onLoginSuccess }) {
  const patTokenInput = document.getElementById('pat-token-input');
  const btnTokenLogin = document.getElementById('btn-token-login');

  btnTokenLogin.addEventListener('click', async () => {
    const token = patTokenInput.value.trim();
    if (!token) {
      alert('Por favor, cole seu token PAT do GitHub no campo.');
      return;
    }

    btnTokenLogin.disabled = true;
    btnTokenLogin.textContent = 'Autenticando no GitHub...';

    try {
      const { ok, data } = await API.loginWithToken(token);
      if (ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        alert(`Erro de autenticação: ${data.error || 'Token inválido'}`);
      }
    } catch (err) {
      alert('Erro de comunicação com o servidor local.');
    } finally {
      btnTokenLogin.disabled = false;
      btnTokenLogin.innerHTML = '<span class="material-symbols-outlined icon-xs">login</span> Conectar Conta & Acessar Repositórios';
    }
  });
}

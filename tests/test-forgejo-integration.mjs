import assert from 'node:assert';

const FORGEJO_URL = process.env.FORGEJO_URL || 'http://localhost:3000';
const FORGEJO_TOKEN = process.env.FORGEJO_TOKEN || '2ff8bb9148a263c57e22e9d22e4db5e9abd60adb';
const REPO_NAME = `e2e-forgejo-${Date.now()}`;

console.log('🚀 Iniciando Teste de Integração Automatizado com Forgejo...');
console.log(`📡 URL: ${FORGEJO_URL} | Repositório: ${REPO_NAME}\n`);

async function forgejoApi(endpoint, method = 'GET', body = null) {
  const url = `${FORGEJO_URL}/api/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const headers = {
    'Accept': 'application/json',
    'Authorization': `token ${FORGEJO_TOKEN}`,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function run() {
  // 1. Verifica versão e status do Forgejo
  console.log('1️⃣ Testando endpoint de versão do Forgejo...');
  const verRes = await forgejoApi('/version');
  assert.strictEqual(verRes.ok, true, 'Forgejo deve responder com 200 no /version');
  assert.ok(verRes.data.version, 'Versão do Forgejo deve estar presente');
  console.log(`   ✅ Forgejo online: Versão ${verRes.data.version}`);

  // 2. Cria Repositório Privado
  console.log(`2️⃣ Criando repositório privado '${REPO_NAME}'...`);
  const createRes = await forgejoApi('/user/repos', 'POST', {
    name: REPO_NAME,
    description: 'Repositório de Teste Automatizado Context OS',
    private: true,
    auto_init: true,
  });
  assert.strictEqual(createRes.ok, true, 'Criação do repositório deve retornar 201 Created');
  assert.strictEqual(createRes.data.private, true, 'Repositório deve ser privado');
  assert.strictEqual(createRes.data.default_branch, 'main', 'Branch padrão deve ser main');
  console.log(`   ✅ Repositório criado: ${createRes.data.full_name} (Privado: ${createRes.data.private})`);

  // 3. Aplica Regra de Branch Protection Automatizada (Governança)
  console.log('3️⃣ Aplicando Branch Protection na branch main...');
  const protectRes = await forgejoApi(`/repos/marcosbaiadori/${REPO_NAME}/branch_protections`, 'POST', {
    branch_name: 'main',
    enable_push: false,
    enable_push_whitelist: false,
    required_approvals: 1,
    enable_approvals_whitelist: false,
    protected_file_patterns: '.keymap.json;.project.config.json;.gitignore;.scripts/**;.github/**',
  });
  assert.strictEqual(protectRes.ok, true, 'Branch protection deve ser aceita pelo Forgejo');
  assert.strictEqual(protectRes.data.enable_push, false, 'Push direto na main DEVE estar bloqueado');
  assert.strictEqual(protectRes.data.required_approvals, 1, 'Exigência de aprovação de PR DEVE ser 1');
  assert.ok(protectRes.data.protected_file_patterns.includes('.keymap.json'), 'Padrões de arquivos protegidos devem incluir .keymap.json');
  console.log('   ✅ Branch Protection e Protected File Patterns ativados na main!');

  // 4. Adiciona Colaboradora @catiaua
  console.log('4️⃣ Adicionando colaboradora @catiaua ao repositório...');
  const addCollabRes = await forgejoApi(`/repos/marcosbaiadori/${REPO_NAME}/collaborators/catiaua`, 'PUT', {
    permission: 'write',
  });
  assert.strictEqual(addCollabRes.status, 204, 'Adicionar colaborador deve retornar 204 No Content');
  console.log('   ✅ Colaboradora @catiaua adicionada com permissão de escrita.');

  // 5. Lista e Valida Colaboradores
  console.log('5️⃣ Validando lista de colaboradores do repositório...');
  const listCollabsRes = await forgejoApi(`/repos/marcosbaiadori/${REPO_NAME}/collaborators`);
  assert.strictEqual(listCollabsRes.ok, true, 'Listagem de colaboradores deve retornar 200');
  const catia = listCollabsRes.data.find(c => c.login === 'catiaua');
  assert.ok(catia, 'Colaboradora catiaua deve estar na lista');
  console.log(`   ✅ Colaborador validado: @${catia.login} (ID: ${catia.id})`);

  // 6. Limpeza do ambiente de teste
  console.log('6️⃣ Excluindo repositório de teste...');
  const delRes = await forgejoApi(`/repos/marcosbaiadori/${REPO_NAME}`, 'DELETE');
  assert.strictEqual(delRes.status, 204, 'Exclusão do repositório deve retornar 204');
  console.log('   ✅ Repositório temporário excluído com sucesso.');

  console.log('\n🎉 TODOS OS TESTES DE INTEGRAÇÃO COM O FORGEJO PASSARAM COM SUCESSO ABSOLUTO!');
}

run().catch((err) => {
  console.error('\n❌ ERRO NO TESTE DE INTEGRAÇÃO:', err);
  process.exit(1);
});

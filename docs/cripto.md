
Revisão do Sistema de Criptografia — Avaliação Crítica e Plano

1. Como funciona hoje (o que o código realmente faz)
   Existem dois sistemas de criptografia convivendo, e o usuário vê pedaços dos dois.

unlockLevel(passphrase)
Sistema B - Novo (X25519 por DEPARTAMENTO)
Par X25519 no Keychain do SO
Chave publica em .keymap.json
DEK AES-256 por pasta/departamento
DEK selada para cada membro (slots)
arquivos *.md.enc no Git
Sistema A - Legado (passphrase por NIVEL)
Senha digitada na UI
PBKDF2 gera chave do nivel
Canary valida a senha
user_slots + canaries em .project.config.json
UI: NotionEditor / FileTree / GovernanceMembers
git.service (pull/commit/push)
Aspecto	Sistema A (legado)	Sistema B (novo)
Granularidade	Nível (0,1,2,3,999)	Departamento = pasta de 1º nível
Segredo do usuário	Passphrase digitada	Chave privada X25519 no Keychain
Onde fica	.project.config.json	.keymap.json + .md.enc
Quem usa na UI	Sim (desbloqueio, cadeados, editor)	Quase nada (só exibe fingerprint)
Quem usa no Git/PR	Não	Sim (sync, staging, PR worktree)
Resultado: a UI desbloqueia com um mecanismo (passphrase) e o Git cifra/decifra com outro (DEK/keymap). Não há ponte entre eles. O "desbloqueio" na UI não influencia a descriptografia real dos .enc.

2. Avaliação crítica
   2.1 Problemas de compreensão / UX
   Dois modelos mentais: "Nível" (hierarquia 0→3) vs. "Departamento" (compartimento). O crypto real usa departamento; a UI vende nível.
   Passphrase por nível sem explicação: a senha é criada na primeira digitação (unlockUserVault auto-provisiona quando o canary é o placeholder). Quem digitar primeiro define a senha do nível.
   Sem onboarding: inviteCollaborator só grava metadados e convida no GitHub. Não registra chave pública nem cria slots. O convidado fica sem acesso real até alguém chamar /keymap/register + setCompartmentDEK, e não há UI para isso.
   Sem estado visível: não existe tela "Meu acesso" dizendo o que abro, o que está bloqueado e por quê.
   Documentos/pastas/chaves sem relação clara: allowed_paths filtra exibição mas não é criptográfico; nível e departamento do arquivo são inferidos por nome de pasta hardcoded (executive→0, finance/legal→1, resto→2).
   Erros técnicos ("Canary falhou", "slot não abriu") expostos ao usuário.
   2.2 Falhas de segurança / correção

# Sev.	Problema	Local

S1	Alta	DEKs em base64 texto claro em .git/context-vault-session.json	saveSessionDEKs
S2	Alta	Sem revogação: removeCollaborator não remove membro/slots do keymap nem rotaciona a DEK; ex-membro mantém a DEK	governance.service.ts
S3	Alta	.keymap.json não é assinado: quem tem push pode inserir chave pública/level; na próxima setCompartmentDEK o admin sela a DEK para ele	setCompartmentDEK
S4	Alta	prepareGitStaging: sem a DEK, o usuário gera uma DEK nova e re-sela → fork de chaves, arquivos antigos ilegíveis para os demais	vault-engine.service.ts:524-529
S5	Média	Passphrases em sessionStorage e reenviadas ao servidor a cada decrypt/token	SecurityContext.tsx
S6	Média	Fallback 'marcosbaiadori' hardcoded e perfil root ['*'] quando não está no keymap	vault-engine.service.ts
S7	Média	Sal PBKDF2 padrão fixo, 100k iterações (baixo hoje)	crypto.ts
S8	Média	canAccessDocument duplicada em front e back (já divergem)	SecurityContext / crypto.ts
S9	Baixa	.gitignore com pastas fixas: pasta nova vaza texto plano	ensureGitIgnoreRules
S10	Baixa	department/level não entram como AAD do GCM: metadados adulteráveis	buildEncryptedEnvelope
2.3 Dívida técnica
Código legado/morto: /api/crypto/encrypt|decrypt, encryptContent/decryptContent, generateAIToken (não usados nos componentes), DEFAULT_* duplicados no front.
governance_security_vault (canaries/slots) mistura configuração com material criptográfico no .project.config.json.
Viola a regra de taxonomias dinâmicas: níveis/departamentos hardcoded em prepareGitStaging e .gitignore.
3. Modelo-alvo proposto
Uma ideia só: "Cofres". Cada pasta/nível protegido é um cofre. Você tem ou não tem a chave. Nível e departamento viram apenas regras de quem recebe a chave.

Chave do usuário: par X25519 no Keychain (automática). Opcional: proteger com senha/biometria.
Cofre = { id, pastas, nível mínimo, cor (do .project.config.json) } + uma DEK.
Acesso = existir um slot selado para o usuário. Admin concede/revoga pela UI.
Revogação = remover slot + rotacionar DEK + recifrar arquivos do cofre.
Keymap assinado (Ed25519) por admin → impede injeção de membros.
Passphrase deixa de ser o mecanismo principal.
4. Plano de implementação
Fase 0 — Decisões e documentação
Fechar o modelo-alvo (perguntas abaixo).
Escrever docs/ENCRYPTION.md com diagrama, glossário e fluxos (onboarding, revogar, recuperar).
Fase 1 — Correções críticas (Sistema B)
S1: remover context-vault-session.json; DEKs só em memória (ou Keychain).
S4: prepareGitStaging nunca cria DEK de cofre existente; só admin/owner inicializa; senão erro claro "Você não tem acesso ao cofre X".
S3: assinatura Ed25519 do .keymap.json, verificada no sync/PR.
S2: revokeMember(login) remove membro/slots, rotaciona DEKs, recifra .enc, audita; integrar em removeCollaborator e rebaixamento de nível.
S6: remover fallbacks hardcoded.
S10: department/level/key_id como AAD.
Fase 2 — Unificação (aposentar Sistema A)
Migrar user_slots/canaries para keymap/slots (script idempotente).
Resolver nível/departamento via projectConfig, removendo o mapa hardcoded.
Unificar canAccessDocument: back é a fonte da verdade; front consome GET /api/governance/access/me.
Remover rotas/contextos legados.
Fase 3 — Experiência do usuário
Tela "Meu Acesso": cofres com as cores do config, estado (aberto/bloqueado/pendente) e motivo.
Convite integrado: convidar → membro gera chave no 1º login → "Aguardando liberação" → admin "Liberar cofres" → slots criados.
Painel admin: conceder, revogar, rotacionar, fingerprints, auditoria.
Cadeado no FileTree/Editor com explicação simples e "Solicitar acesso".
Mensagens humanas e i18n (pt/en).
Fase 4 — Testes
Estender vault-engine.test.ts e vault-e2e.test.ts: revogação+rotação, keymap adulterado, usuário sem DEK, migração A→B.
5. Verificação
Automatizado: cd server && npm test; cd frontend && npm run build.
Manual: criar repo → convidar → liberar cofre → editar/commit/pull com 2 perfis → revogar e confirmar que o ex-membro não decifra novos commits.
Perguntas em aberto
IMPORTANT

Preciso destas decisões antes de executar.

Granularidade do cofre: por pasta/departamento (recomendado, é o que o Git já usa), por nível, ou combinados?
Compatibilidade: há repositórios com dados do Sistema A que exigem migração, ou posso quebrar compatibilidade?
Passphrase: remover de vez ou manter como proteção opcional da chave privada?
Escopo da 1ª entrega: só Fase 1 (segurança) ou Fases 1+2+3?
Revogação: aceitar que o histórico Git antigo continua legível para ex-membros (limitação inerente ao Git)?

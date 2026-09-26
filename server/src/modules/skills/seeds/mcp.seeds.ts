import { MCPServerDefinition } from '../skills.types.js';

export const eccSeedMcpTemplates: MCPServerDefinition[] = [
  {
    id: 'github-mcp',
    name: 'GitHub Official MCP Server',
    description: 'Conecta o Agente diretamente à API do GitHub para listar repositórios, abrir PRs, consultar issues e verificar status de CI.',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: '',
    },
    enabled: false,
    category: 'version-control',
    discovered_tools: [
      { name: 'github_create_pull_request', description: 'Abre um novo Pull Request no GitHub.' },
      { name: 'github_list_issues', description: 'Lista e busca issues no repositório remoto.' },
      { name: 'github_get_file_contents', description: 'Lê o conteúdo de arquivos diretamente da branch remota.' },
    ],
  },
  {
    id: 'postgres-mcp',
    name: 'PostgreSQL Database MCP Server',
    description: 'Permite ao Agente inspecionar schemas de banco de dados, listar tabelas e validar tipos de colunas em tempo real.',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:password@localhost:5432/mydb'],
    enabled: false,
    category: 'database',
    discovered_tools: [
      { name: 'postgres_list_tables', description: 'Lista todas as tabelas e schemas do banco.' },
      { name: 'postgres_describe_table', description: 'Descreve as colunas, tipos e chaves estrangeiras.' },
    ],
  },
  {
    id: 'fetch-web-mcp',
    name: 'Fetch & Web Docs MCP Server',
    description: 'Permite ao Agente buscar e converter documentações externas em markdown para consulta rápida durante o pareamento.',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    enabled: false,
    category: 'web',
    discovered_tools: [
      { name: 'fetch_url', description: 'Obtém o conteúdo textual de uma URL pública convertendo para Markdown.' },
    ],
  },
  {
    id: 'sqlite-mcp',
    name: 'SQLite Database MCP Server',
    description: 'Consulta schemas locais em bancos SQLite.',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './database.sqlite'],
    enabled: false,
    category: 'database',
    discovered_tools: [
      { name: 'sqlite_read_query', description: 'Executa uma consulta SELECT segura no SQLite.' },
      { name: 'sqlite_list_tables', description: 'Lista as tabelas do banco SQLite local.' },
    ],
  },
];

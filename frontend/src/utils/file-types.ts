export type FileCategory =
  | 'markdown'
  | 'code'
  | 'csv'
  | 'excel'
  | 'word'
  | 'pdf'
  | 'image'
  | 'generic';

export function getFileExtension(filePath: string): string {
  if (!filePath) return '';
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filePath.slice(lastDot + 1).toLowerCase();
}

export function getFileCategory(filePath: string): FileCategory {
  const ext = getFileExtension(filePath);

  if (['md', 'mdx', 'markdown'].includes(ext)) {
    return 'markdown';
  }

  if (['csv', 'tsv'].includes(ext)) {
    return 'csv';
  }

  if (['xlsx', 'xls'].includes(ext)) {
    return 'excel';
  }

  if (['docx', 'doc'].includes(ext)) {
    return 'word';
  }

  if (['pdf'].includes(ext)) {
    return 'pdf';
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
    return 'image';
  }

  if (
    [
      'ts',
      'tsx',
      'js',
      'jsx',
      'mjs',
      'cjs',
      'json',
      'yaml',
      'yml',
      'html',
      'htm',
      'css',
      'scss',
      'less',
      'py',
      'sql',
      'sh',
      'bash',
      'zsh',
      'env',
      'txt',
      'log',
      'xml',
      'toml',
      'ini',
      'dockerfile',
      'prisma',
      'graphql',
      'gql',
    ].includes(ext) ||
    filePath.endsWith('.env') ||
    filePath.endsWith('Dockerfile')
  ) {
    return 'code';
  }

  return 'generic';
}

export function getLanguageLabel(filePath: string): string {
  const ext = getFileExtension(filePath);
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    py: 'Python',
    sql: 'SQL',
    sh: 'Shell Script',
    bash: 'Bash',
    env: 'Environment Config',
    txt: 'Texto Simples',
    csv: 'Planilha CSV',
    tsv: 'Planilha TSV',
    xlsx: 'Planilha Excel',
    xls: 'Planilha Excel',
    docx: 'Documento Word',
    doc: 'Documento Word',
    pdf: 'Documento PDF',
    md: 'Markdown',
    mdx: 'MDX',
    svg: 'Imagem SVG',
    png: 'Imagem PNG',
    jpg: 'Imagem JPEG',
    jpeg: 'Imagem JPEG',
  };
  return map[ext] || (ext ? ext.toUpperCase() : 'Arquivo');
}

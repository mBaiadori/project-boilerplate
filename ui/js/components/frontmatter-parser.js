// =============================================================================
// FRONTMATTER PARSER & SERIALIZER
// Permite manipular metadados estruturados (IDs, Camadas, Status, Conexões)
// e o corpo do documento Markdown de forma desacoplada.
// =============================================================================

export function parseFrontmatter(rawContent = '') {
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      hasFrontmatter: false,
      metadata: createDefaultMetadata(),
      body: ''
    };
  }

  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      hasFrontmatter: false,
      metadata: createDefaultMetadata(),
      body: rawContent
    };
  }

  const yamlBlock = match[1];
  const body = match[2] || '';
  const metadata = parseYamlSimple(yamlBlock);

  return {
    hasFrontmatter: true,
    metadata: {
      ...createDefaultMetadata(),
      ...metadata
    },
    body
  };
}

export function serializeFrontmatter(metadata, body = '') {
  if (!metadata) return body;

  const lines = ['---'];
  if (metadata.id) lines.push(`id: "${escapeYamlString(metadata.id)}"`);
  if (metadata.title) lines.push(`title: "${escapeYamlString(metadata.title)}"`);
  if (metadata.type) lines.push(`type: "${escapeYamlString(metadata.type)}"`);
  if (metadata.version) lines.push(`version: "${escapeYamlString(metadata.version)}"`);
  if (metadata.status) lines.push(`status: "${escapeYamlString(metadata.status)}"`);
  if (metadata.layer) lines.push(`layer: "${escapeYamlString(metadata.layer)}"`);
  if (metadata.path) lines.push(`path: "${escapeYamlString(metadata.path)}"`);
  if (metadata.parent) lines.push(`parent: "${escapeYamlString(metadata.parent)}"`);

  // Lifecycle & Navigation Connections
  const lc = metadata.lifecycle;
  if (lc && (lc.stage || lc.previous_stage || lc.next_stage || lc.feedback_loops)) {
    lines.push('lifecycle:');
    if (lc.stage) lines.push(`  stage: "${escapeYamlString(lc.stage)}"`);
    if (lc.previous_stage) lines.push(`  previous_stage: "${escapeYamlString(lc.previous_stage)}"`);
    if (lc.next_stage) lines.push(`  next_stage: "${escapeYamlString(lc.next_stage)}"`);
    if (lc.feedback_loops) {
      if (typeof lc.feedback_loops === 'object') {
        lines.push('  feedback_loops:');
        for (const [key, val] of Object.entries(lc.feedback_loops)) {
          lines.push(`    ${key}: "${escapeYamlString(val)}"`);
        }
      } else {
        lines.push(`  feedback_loops: "${escapeYamlString(lc.feedback_loops)}"`);
      }
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(body.trimStart());

  return lines.join('\n');
}

export function stripFrontmatter(rawContent = '') {
  const parsed = parseFrontmatter(rawContent);
  return parsed.body;
}

function createDefaultMetadata() {
  return {
    id: '',
    title: '',
    type: 'spec',
    version: '1.0.0',
    status: 'draft',
    layer: 'L4_ARTIFACT',
    path: '',
    parent: '',
    lifecycle: {
      stage: 'docs',
      previous_stage: '',
      next_stage: '',
      feedback_loops: {}
    }
  };
}

function parseYamlSimple(yamlText) {
  const result = {};
  const lines = yamlText.split('\n');
  let currentParent = null;
  let currentSubKey = null;

  for (let line of lines) {
    line = line.trimEnd();
    if (!line || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Check for nested subkey (e.g. "  feedback_loops:")
    if (indent >= 4 && currentParent === 'lifecycle') {
      const match = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const subKey = match[1].trim();
        let subVal = match[2].trim();
        if (subVal.startsWith('"') && subVal.endsWith('"')) subVal = subVal.slice(1, -1);
        if (subVal.startsWith("'") && subVal.endsWith("'")) subVal = subVal.slice(1, -1);
        if (!result.lifecycle[currentSubKey]) result.lifecycle[currentSubKey] = {};
        if (typeof result.lifecycle[currentSubKey] === 'object') {
          result.lifecycle[currentSubKey][subKey] = subVal;
        }
      }
      continue;
    }

    // Check for child properties under lifecycle (indent 2)
    if (indent >= 2 && currentParent === 'lifecycle') {
      const match = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (!val) {
          currentSubKey = key;
          result.lifecycle[key] = {};
        } else {
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          result.lifecycle[key] = val;
        }
      }
      continue;
    }

    // Root level key
    currentParent = null;
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();

      if (key === 'lifecycle') {
        currentParent = 'lifecycle';
        result.lifecycle = result.lifecycle || {};
      } else {
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        result[key] = val;
      }
    }
  }

  return result;
}

function escapeYamlString(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/"/g, '\\"');
}

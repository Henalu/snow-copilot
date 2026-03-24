import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectServiceNowApis,
  inferArtifactTypes,
  inferScope,
  tokenizeText,
  unique
} from '../rag/shared.js';

function parseArgs(argv) {
  const entries = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.split('=');
    if (inlineValue !== undefined) {
      entries.set(key.slice(2), inlineValue);
      continue;
    }
    entries.set(key.slice(2), argv[i + 1]);
    i += 1;
  }
  return entries;
}

function parseScalar(value) {
  const trimmed = String(value || '').trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^['"].*['"]$/.test(trimmed)) return trimmed.slice(1, -1);
  if (/^\[(.*)\]$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => parseScalar(item));
  }
  return trimmed;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw };

  const lines = raw.split(/\r?\n/);
  const data = {};
  let index = 1;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '---') {
      return {
        data,
        body: lines.slice(index + 1).join('\n').trim()
      };
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) {
      index += 1;
      continue;
    }

    const [, key, inlineValue] = match;
    if (inlineValue) {
      data[key] = parseScalar(inlineValue);
      index += 1;
      continue;
    }

    const list = [];
    index += 1;
    while (index < lines.length) {
      const itemLine = lines[index];
      const itemMatch = itemLine.match(/^\s*-\s+(.*)$/);
      if (!itemMatch) break;
      list.push(parseScalar(itemMatch[1]));
      index += 1;
    }
    data[key] = list;
  }

  return { data, body: raw };
}

function splitMarkdownIntoSections(markdown, articleTitle) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let currentHeading = articleTitle;
  let buffer = [];

  function pushSection() {
    const content = buffer.join('\n').trim();
    if (!content) return;
    sections.push({
      heading: currentHeading,
      content
    });
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##+\s+(.*)$/);
    if (headingMatch) {
      pushSection();
      currentHeading = headingMatch[1].trim();
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  pushSection();
  return sections;
}

function chunkSection(sectionText, maxChars = 900) {
  const blocks = sectionText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current.trim());

    if (block.length <= maxChars) {
      current = block;
      continue;
    }

    const sentences = block.split(/(?<=[.!?])\s+/);
    let longCurrent = '';
    for (const sentence of sentences) {
      const longCandidate = longCurrent ? `${longCurrent} ${sentence}` : sentence;
      if (longCandidate.length <= maxChars) {
        longCurrent = longCandidate;
      } else {
        if (longCurrent) chunks.push(longCurrent.trim());
        longCurrent = sentence;
      }
    }
    current = longCurrent;
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

function createUrl(baseUrl, relativeSegments) {
  const normalizedBase = String(baseUrl).replace(/\/$/, '');
  return `${normalizedBase}/${relativeSegments.join('/')}/`;
}

async function readMarkdownFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildChunkDocument({ sourceId, baseUrl, filePath, relativePath, frontmatter, body }) {
  const slug = relativePath.replace(/\\/g, '/').replace(/\.md$/, '');
  const url = createUrl(baseUrl, ['articulos', ...slug.split('/')]);
  const sections = splitMarkdownIntoSections(body, frontmatter.title || slug);

  const baseSignals = inferArtifactTypes(
    [frontmatter.title, frontmatter.description, body, ...(frontmatter.tags || [])].filter(Boolean).join(' '),
    frontmatter.categoria || ''
  );
  const baseScope = inferScope(
    [frontmatter.title, frontmatter.description, body, frontmatter.categoria].filter(Boolean).join(' ')
  );

  const chunks = [];
  sections.forEach((section, sectionIndex) => {
    const sectionChunks = chunkSection(section.content);
    sectionChunks.forEach((chunkText, chunkIndex) => {
      const titleTerms = tokenizeText(frontmatter.title || '');
      const headingTerms = tokenizeText(section.heading || '');
      const tagTerms = tokenizeText((frontmatter.tags || []).join(' '));
      const terms = tokenizeText([
        frontmatter.title,
        frontmatter.description,
        frontmatter.categoria,
        (frontmatter.tags || []).join(' '),
        section.heading,
        chunkText
      ].filter(Boolean).join(' '));

      chunks.push({
        id: `${sourceId}:${slug}#${sectionIndex + 1}-${chunkIndex + 1}`,
        sourceId,
        documentId: `${sourceId}:${slug}`,
        title: frontmatter.title,
        description: frontmatter.description,
        url,
        category: frontmatter.categoria,
        tags: frontmatter.tags || [],
        difficulty: frontmatter.dificultad || null,
        servicenowVersions: frontmatter.servicenow_version || [],
        resolved: frontmatter.resuelto === true,
        heading: section.heading === frontmatter.title ? '' : section.heading,
        text: chunkText,
        terms,
        titleTerms,
        headingTerms,
        tagTerms,
        apiTerms: collectServiceNowApis(chunkText),
        signals: {
          artifactTypes: unique([
            ...baseSignals,
            ...inferArtifactTypes(
              [section.heading, chunkText, (frontmatter.tags || []).join(' ')].filter(Boolean).join(' '),
              frontmatter.categoria || ''
            )
          ]),
          scope: unique([
            ...baseScope,
            ...inferScope([section.heading, chunkText].filter(Boolean).join(' '))
          ])
        }
      });
    });
  });

  return chunks;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const breakingTrailPath = path.resolve(
    repoRoot,
    args.get('breakingTrailPath') || path.join('..', 'BREAKING-TRAIL')
  );
  const articlesRoot = path.join(breakingTrailPath, 'src', 'content', 'articles');
  const outputPath = path.resolve(
    repoRoot,
    args.get('out') || path.join('rag', 'indexes', 'breaking-trail.json')
  );
  const baseUrl = args.get('baseUrl') || 'https://breaking-trail.vercel.app';

  const markdownFiles = await readMarkdownFiles(articlesRoot);
  const chunks = [];

  for (const filePath of markdownFiles) {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const relativePath = path.relative(articlesRoot, filePath);
    chunks.push(...buildChunkDocument({
      sourceId: 'breakingTrail',
      baseUrl,
      filePath,
      relativePath,
      frontmatter: data,
      body
    }));
  }

  const index = {
    version: 1,
    builtAt: new Date().toISOString(),
    sourceId: 'breakingTrail',
    source: {
      id: 'breakingTrail',
      name: 'Breaking Trail',
      description: 'Bundled ServiceNow RAG index generated from Breaking Trail Astro markdown articles.',
      baseUrl,
      articleCount: unique(chunks.map((chunk) => chunk.documentId)).length,
      chunkCount: chunks.length
    },
    chunks
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(index));

  console.log(`Built Breaking Trail index: ${index.source.articleCount} articles, ${index.source.chunkCount} chunks`);
  console.log(`Output: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

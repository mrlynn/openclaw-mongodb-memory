'use client';

import { useState } from 'react';

// Disable static generation to avoid SSR issues
export const dynamic = 'force-dynamic';
import { AppShell } from '../../components/layout/AppShell';
import TextInput from '@leafygreen-ui/text-input';
import Icon from '@leafygreen-ui/icon';
import { H2, Body, Label } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
// import { Tabs, Tab } from '@leafygreen-ui/tabs'; // SSR issues, using buttons instead
import Badge from '@leafygreen-ui/badge';
import Button from '@leafygreen-ui/button';
// import Code from '@leafygreen-ui/code'; // SSR issues, using pre/code instead
import Banner from '@leafygreen-ui/banner';
import styles from './page.module.css';

interface DocSection {
  id: string;
  title: string;
  category: 'quickstart' | 'architecture' | 'troubleshooting' | 'api';
  content: string;
  codeExamples?: Array<{
    language: string;
    code: string;
    runnable?: boolean;
  }>;
  tags: string[];
}

const docSections: DocSection[] = [
  {
    id: 'quickstart-install',
    title: 'Quick Start - Installation',
    category: 'quickstart',
    content: 'Get started with OpenClaw Memory in under 5 minutes.',
    codeExamples: [
      {
        language: 'bash',
        code: `# Clone repository
git clone https://github.com/mrlynn/openclaw-mongodb-memory.git
cd openclaw-mongodb-memory

# Install dependencies
pnpm install

# Configure environment
cd packages/daemon
cp .env.example .env.local

# Start daemon
npm start`,
      },
    ],
    tags: ['installation', 'setup', 'getting-started'],
  },
  {
    id: 'api-remember',
    title: 'API - Store Memory',
    category: 'api',
    content: 'Store a memory with semantic embedding.',
    codeExamples: [
      {
        language: 'bash',
        code: `curl -X POST http://localhost:7751/remember \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "my-agent",
    "text": "Important fact to remember",
    "tags": ["work", "priority"]
  }'`,
        runnable: true,
      },
    ],
    tags: ['api', 'remember', 'store', 'example'],
  },
  {
    id: 'api-recall',
    title: 'API - Semantic Search',
    category: 'api',
    content: 'Search memories using semantic similarity.',
    codeExamples: [
      {
        language: 'bash',
        code: `curl "http://localhost:7751/recall?agentId=my-agent&query=important+facts&limit=5"`,
        runnable: true,
      },
    ],
    tags: ['api', 'recall', 'search', 'semantic', 'example'],
  },
  {
    id: 'troubleshooting-port',
    title: 'Troubleshooting - Port Already in Use',
    category: 'troubleshooting',
    content: 'Error: listen EADDRINUSE: address already in use :::7751',
    codeExamples: [
      {
        language: 'bash',
        code: `# Find and kill process
lsof -ti:7751 | xargs kill -9

# Or change port
echo "MEMORY_DAEMON_PORT=7752" >> packages/daemon/.env.local`,
      },
    ],
    tags: ['troubleshooting', 'error', 'port'],
  },
  {
    id: 'architecture-overview',
    title: 'Architecture - System Overview',
    category: 'architecture',
    content: 'OpenClaw Memory uses a two-tier strategy: file-based memory (MEMORY.md) for curated long-term wisdom, and MongoDB for semantic search at scale.',
    tags: ['architecture', 'overview', 'design'],
  },
];

export default function DocsPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = [
    { id: 0, label: 'All' },
    { id: 1, label: 'Quick Start' },
    { id: 2, label: 'API Reference' },
    { id: 3, label: 'Architecture' },
    { id: 4, label: 'Troubleshooting' },
  ];

  const filteredSections = docSections.filter(section => {
    const matchesTab = selectedTab === 0 || 
      (selectedTab === 1 && section.category === 'quickstart') ||
      (selectedTab === 2 && section.category === 'api') ||
      (selectedTab === 3 && section.category === 'architecture') ||
      (selectedTab === 4 && section.category === 'troubleshooting');
    
    const matchesSearch = searchQuery === '' ||
      section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesTab && matchesSearch;
  });

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AppShell>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <H2>📚 Documentation</H2>
          <Body>Interactive guides, API reference, and troubleshooting</Body>
        </div>

        {/* Search */}
        <div className={styles.search}>
          <TextInput
            label=""
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Buttons (instead of Tabs for SSR compatibility) */}
        <div className={styles.categories}>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedTab === cat.id ? 'primary' : 'default'}
              onClick={() => setSelectedTab(cat.id)}
              size="small"
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Results Count */}
        <div className={styles.resultsCount}>
          <Body>
            {filteredSections.length} {filteredSections.length === 1 ? 'result' : 'results'}
          </Body>
        </div>

        {/* Documentation Sections */}
        <div className={styles.sections}>
          {filteredSections.map((section) => (
            <Card key={section.id} className={styles.card}>
              {/* Section Header */}
              <div className={styles.cardHeader}>
                <H2>{section.title}</H2>
              </div>

              {/* Tags */}
              <div className={styles.tags}>
                {section.tags.map((tag) => (
                  <Badge key={tag} variant="lightgray">{tag}</Badge>
                ))}
              </div>

              {/* Content */}
              <div className={styles.content}>
                <Body>{section.content}</Body>
              </div>

              {/* Code Examples */}
              {section.codeExamples?.map((example, idx) => (
                <div key={idx} className={styles.codeBlock}>
                  <div className={styles.codeHeader}>
                    <Badge>{example.language}</Badge>
                    <Button
                      size="small"
                      onClick={() => handleCopy(example.code, `${section.id}-${idx}`)}
                    >
                      {copiedId === `${section.id}-${idx}` ? '✓ Copied' : 'Copy'}
                    </Button>
                  </div>
                  <pre className={styles.codeSnippet}>
                    <code>{example.code}</code>
                  </pre>
                </div>
              ))}
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredSections.length === 0 && (
          <Banner variant="info">
            No documentation found for &quot;{searchQuery}&quot;. Try a different search term.
          </Banner>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <Body>
            Full documentation available on{' '}
            <a 
              href="https://github.com/mrlynn/openclaw-mongodb-memory" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </Body>
        </div>
      </div>
    </AppShell>
  );
}

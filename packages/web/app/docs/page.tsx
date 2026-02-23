'use client';

import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  PlayArrow as RunIcon,
  Architecture as ArchitectureIcon,
  Help as HelpIcon,
  Code as CodeIcon,
  Book as BookIcon,
} from '@mui/icons-material';
import { AppShell } from '../../components/layout/AppShell';

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
    content: `Get started with OpenClaw Memory in under 5 minutes.`,
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
# Edit .env.local with your MongoDB URI

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
    content: `Store a memory with semantic embedding.`,
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
      {
        language: 'typescript',
        code: `import { MemoryClient } from '@openclaw-memory/client';

const client = new MemoryClient('http://localhost:7751', 'my-agent');

await client.remember({
  text: 'Important fact to remember',
  tags: ['work', 'priority'],
});`,
      },
    ],
    tags: ['api', 'remember', 'store', 'example'],
  },
  {
    id: 'api-recall',
    title: 'API - Semantic Search',
    category: 'api',
    content: `Search memories using semantic similarity.`,
    codeExamples: [
      {
        language: 'bash',
        code: `curl "http://localhost:7751/recall?agentId=my-agent&query=important+facts&limit=5"`,
        runnable: true,
      },
      {
        language: 'typescript',
        code: `const results = await client.recall('important facts', 5);
results.forEach(memory => {
  console.log(memory.text, memory.score);
});`,
      },
    ],
    tags: ['api', 'recall', 'search', 'semantic', 'example'],
  },
  {
    id: 'troubleshooting-port',
    title: 'Troubleshooting - Port Already in Use',
    category: 'troubleshooting',
    content: `Error: listen EADDRINUSE: address already in use :::7751`,
    codeExamples: [
      {
        language: 'bash',
        code: `# Find and kill process
lsof -ti:7751 | xargs kill -9

# Or change port
echo "MEMORY_DAEMON_PORT=7752" >> packages/daemon/.env.local`,
      },
    ],
    tags: ['troubleshooting', 'error', 'port', 'eaddrinuse'],
  },
  {
    id: 'architecture-overview',
    title: 'Architecture - System Overview',
    category: 'architecture',
    content: `OpenClaw Memory uses a two-tier strategy: file-based memory (MEMORY.md) for curated long-term wisdom, and MongoDB for semantic search at scale.`,
    tags: ['architecture', 'overview', 'design'],
  },
];

export default function DocsPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['All', 'Quick Start', 'API Reference', 'Architecture', 'Troubleshooting'];
  
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

  const handleRun = async (code: string) => {
    // Extract the curl command and execute it
    alert('Running code... (Demo mode)');
    // TODO: Implement actual code execution
  };

  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" gutterBottom>
            📚 Documentation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Interactive guides, API reference, and troubleshooting
          </Typography>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        {/* Tabs */}
        <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mb: 3 }}>
          {categories.map((cat, i) => (
            <Tab key={i} label={cat} />
          ))}
        </Tabs>

        {/* Results Count */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {filteredSections.length} {filteredSections.length === 1 ? 'result' : 'results'}
        </Typography>

        {/* Documentation Sections */}
        {filteredSections.map((section) => (
          <Card key={section.id} sx={{ mb: 2 }}>
            <CardContent>
              {/* Section Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {section.category === 'architecture' && <ArchitectureIcon sx={{ mr: 1 }} />}
                {section.category === 'troubleshooting' && <HelpIcon sx={{ mr: 1 }} />}
                {section.category === 'api' && <CodeIcon sx={{ mr: 1 }} />}
                {section.category === 'quickstart' && <BookIcon sx={{ mr: 1 }} />}
                <Typography variant="h6">{section.title}</Typography>
              </Box>

              {/* Tags */}
              <Box sx={{ mb: 2 }}>
                {section.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                ))}
              </Box>

              {/* Content */}
              <Typography variant="body1" sx={{ mb: 2 }}>
                {section.content}
              </Typography>

              {/* Code Examples */}
              {section.codeExamples?.map((example, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Chip label={example.language} size="small" />
                    <Box>
                      {example.runnable && (
                        <Tooltip title="Run code">
                          <IconButton size="small" onClick={() => handleRun(example.code)}>
                            <RunIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={copiedId === `${section.id}-${idx}` ? 'Copied!' : 'Copy code'}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleCopy(example.code, `${section.id}-${idx}`)}
                        >
                          {copiedId === `${section.id}-${idx}` ? (
                            <CheckIcon fontSize="small" color="success" />
                          ) : (
                            <CopyIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.900',
                      color: 'grey.100',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    {example.code}
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* No Results */}
        {filteredSections.length === 0 && (
          <Alert severity="info">
            No documentation found for "{searchQuery}". Try a different search term.
          </Alert>
        )}

        {/* Footer Links */}
        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Full documentation available on{' '}
            <a 
              href="https://github.com/mrlynn/openclaw-mongodb-memory" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              GitHub
            </a>
          </Typography>
        </Box>
      </Container>
    </AppShell>
  );
}

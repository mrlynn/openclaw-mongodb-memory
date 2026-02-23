'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { H2, H3, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Button from '@leafygreen-ui/button';
import TextInput from '@leafygreen-ui/text-input';
import { LoadingIndicator } from '@leafygreen-ui/loading-indicator';
import Banner from '@leafygreen-ui/banner';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

interface Doc {
  id: string;
  title: string;
  category: string;
  filename: string;
  size: number;
  tags: string[];
  content?: string;
}

export default function DocsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch list of docs on mount
  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await fetch('/api/docs');
        if (!res.ok) throw new Error('Failed to fetch docs');
        const data = await res.json();
        setDocs(data.docs);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }
    fetchDocs();
  }, []);

  // Load selected doc content
  const loadDoc = async (docId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/docs?id=${docId}`);
      if (!res.ok) throw new Error('Failed to load document');
      const data = await res.json();
      setSelectedDoc(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const filteredDocs = docs.filter(doc =>
    searchQuery === '' ||
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <H2>📚 Setup Guides</H2>
        <Body>Complete documentation for MongoDB Atlas, Docker, and local setup</Body>
      </div>

      {/* Search */}
      <div className={styles.search}>
        <TextInput
          label=""
          placeholder="Search setup guides..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && !selectedDoc ? (
        <div className={styles.loading}>
          <LoadingIndicator />
        </div>
      ) : error ? (
        <Banner variant="danger">{error}</Banner>
      ) : selectedDoc ? (
        /* Document View */
        <div className={styles.documentView}>
          <div className={styles.backButton}>
            <Button
              size="small"
              onClick={() => setSelectedDoc(null)}
              leftGlyph={<span>←</span>}
            >
              Back to all guides
            </Button>
          </div>

          <Card className={styles.documentCard}>
            <div className={styles.documentHeader}>
              <H2>{selectedDoc.title}</H2>
              <div className={styles.tags}>
                {selectedDoc.tags.map(tag => (
                  <Badge key={tag} variant="blue">{tag}</Badge>
                ))}
              </div>
            </div>

            <div className={styles.markdownContent}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedDoc.content || ''}
              </ReactMarkdown>
            </div>
          </Card>
        </div>
      ) : (
        /* Document List */
        <div className={styles.documentList}>
          <div className={styles.resultsCount}>
            <Body>
              {filteredDocs.length} {filteredDocs.length === 1 ? 'guide' : 'guides'}
            </Body>
          </div>

          <div className={styles.sections}>
            {filteredDocs.map(doc => (
              <Card key={doc.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <H3>{doc.title}</H3>
                </div>

                <div className={styles.tags}>
                  {doc.tags.map(tag => (
                    <Badge key={tag} variant="lightgray">{tag}</Badge>
                  ))}
                </div>

                <div className={styles.cardFooter}>
                  <Body className={styles.fileInfo}>
                    {doc.filename} · {(doc.size / 1024).toFixed(1)} KB
                  </Body>
                  <Button size="small" onClick={() => loadDoc(doc.id)}>
                    Read Guide →
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {filteredDocs.length === 0 && (
            <Banner variant="info">
              No guides found for &quot;{searchQuery}&quot;. Try a different search term.
            </Banner>
          )}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <Body>
          Full repository:{' '}
          <a
            href="https://github.com/mrlynn/openclaw-mongodb-memory"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/mrlynn/openclaw-mongodb-memory
          </a>
        </Body>
      </div>
    </div>
  );
}

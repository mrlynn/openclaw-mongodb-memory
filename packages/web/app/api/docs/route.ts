import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface DocFile {
  id: string;
  title: string;
  category: string;
  filename: string;
  size: number;
  tags: string[];
}

const docFiles: DocFile[] = [
  {
    id: 'docker-setup',
    title: 'Docker Setup Guide',
    category: 'setup',
    filename: 'docker-setup.md',
    size: 0,
    tags: ['docker', 'setup', 'quick-start', 'containers'],
  },
  {
    id: 'mongodb-atlas-setup',
    title: 'MongoDB Atlas Setup (Cloud)',
    category: 'setup',
    filename: 'mongodb-atlas-setup.md',
    size: 0,
    tags: ['mongodb', 'atlas', 'cloud', 'setup', 'production'],
  },
  {
    id: 'mongodb-local-setup',
    title: 'MongoDB Local Setup',
    category: 'setup',
    filename: 'mongodb-local-setup.md',
    size: 0,
    tags: ['mongodb', 'local', 'setup', 'development', 'offline'],
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('id');

  // If requesting a specific doc, return its content
  if (docId) {
    const doc = docFiles.find(d => d.id === docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    try {
      // Read from project root docs/ folder
      // process.cwd() is packages/web in dev, so go up two levels to project root
      const projectRoot = path.resolve(process.cwd(), '../..');
      const docsPath = path.join(projectRoot, 'docs', doc.filename);
      const content = await fs.readFile(docsPath, 'utf-8');
      
      return NextResponse.json({
        ...doc,
        content,
        size: Buffer.byteLength(content, 'utf-8'),
      });
    } catch (error) {
      console.error('Error reading doc file:', error);
      console.error('Attempted path:', path.join(path.resolve(process.cwd(), '../..'), 'docs', doc.filename));
      return NextResponse.json(
        { error: 'Failed to read document', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Return list of all docs
  return NextResponse.json({ docs: docFiles });
}

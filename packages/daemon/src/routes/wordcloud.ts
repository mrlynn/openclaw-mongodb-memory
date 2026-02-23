import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

const WordCloudSchema = z.object({
  agentId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(500).default(150),
  minCount: z.coerce.number().int().positive().default(2),
});

/** Common English stop words to exclude from word cloud. */
const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see",
  "other", "than", "then", "now", "look", "only", "come", "its", "over",
  "think", "also", "back", "after", "use", "two", "how", "our", "work",
  "first", "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "is", "are", "was", "were", "been", "has",
  "had", "did", "does", "am", "being", "having", "doing", "shall",
  "should", "may", "might", "must", "need", "dare", "ought", "used",
  "here", "very", "more", "much", "such", "each", "own", "same", "both",
  "still", "too", "through", "between", "those", "where", "while",
  "before", "during", "without", "however", "since", "until",
  "it's", "i'm", "don't", "didn't", "won't", "isn't", "aren't",
  "that's", "there's", "what's", "let's", "here's", "who's",
  "he's", "she's", "we're", "they're", "i've", "you've", "we've",
  "they've", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
  "i'd", "you'd", "he'd", "she'd", "we'd", "they'd",
  "can't", "couldn't", "wouldn't", "shouldn't", "mightn't", "mustn't",
  "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "been", "being", "has", "had", "does", "did",
  "got", "going", "gone", "getting", "let", "made", "making",
  "many", "few", "lot", "lots", "thing", "things",
  "really", "quite", "just", "already", "always", "never", "often",
  "something", "anything", "everything", "nothing",
  "someone", "anyone", "everyone", "nobody",
  "also", "another", "other", "every", "either", "neither",
  "enough", "less", "least", "more", "most",
]);

/**
 * Tokenize text into words suitable for word cloud analysis.
 * Splits on non-alphanumeric boundaries, lowercases, and filters
 * out stop words and very short tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z0-9'-]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * GET /wordcloud?agentId=X&limit=150&minCount=2
 *
 * Extracts word frequencies from all memories for the given agent.
 * Streams documents to avoid loading the entire corpus into memory.
 * Returns the top N most frequent non-stop-words with relative frequency.
 */
export const wordcloudRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = WordCloudSchema.parse(req.query);

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  // Stream only the text field — skip embeddings (1024 floats) and metadata
  const cursor = collection.find(
    { agentId: data.agentId },
    { projection: { text: 1, _id: 0 } },
  );

  const wordCounts = new Map<string, number>();
  let totalMemories = 0;

  for await (const doc of cursor) {
    totalMemories++;
    const words = tokenize(doc.text as string);
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Filter by minimum occurrence count, sort descending, take top N
  const entries = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= data.minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, data.limit);

  const maxCount = entries.length > 0 ? entries[0][1] : 0;

  const words = entries.map(([text, count]) => ({
    text,
    count,
    frequency: maxCount > 0 ? count / maxCount : 0,
  }));

  res.json({
    success: true,
    agentId: data.agentId,
    totalMemories,
    totalUniqueWords: wordCounts.size,
    words,
  });
});

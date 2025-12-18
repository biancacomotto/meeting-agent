import { knowledgeDocs } from "./docs";

type ScoredDoc = {
  id: string;
  title: string;
  text: string;
  score: number;
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const scoreDoc = (queryTokens: string[], docText: string) => {
  if (queryTokens.length === 0) return 0;
  const docTokens = tokenize(docText);
  const docSet = new Set(docTokens);
  let hits = 0;
  for (const token of queryTokens) {
    if (docSet.has(token)) hits += 1;
  }
  return hits / Math.max(docSet.size, 1);
};

export const retrieveContext = (query: string, limit = 3): ScoredDoc[] => {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = knowledgeDocs
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      text: doc.text,
      score: scoreDoc(queryTokens, `${doc.title} ${doc.text}`),
    }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
};

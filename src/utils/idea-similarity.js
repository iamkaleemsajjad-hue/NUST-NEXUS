/**
 * NEVIN NEXUS — Idea Similarity Detection
 * Normalized text hashing + Jaccard similarity for duplicate idea detection
 */

// Common English stopwords to filter out
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'am', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
  'up', 'down', 'about', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they',
  'them', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'and', 'but', 'or', 'if', 'then', 'else', 'also', 'just', 'because',
  'using', 'use', 'based', 'system', 'project', 'application', 'app',
  'create', 'make', 'build', 'develop', 'implement', 'design'
]);

/**
 * Normalize text: lowercase, remove punctuation, remove stopwords, sort words
 * @param {string} text
 * @returns {string[]} Sorted unique meaningful words
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return [];
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')  // Remove punctuation
      .split(/\s+/)                     // Split by whitespace
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))  // Remove short/stopwords
      .sort()
  )];
}

/** Ordered tokens (non-unique) for bigram overlap — catches paraphrases with same meaning */
export function tokenSequence(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function wordBigrams(tokens) {
  if (tokens.length < 2) return [];
  const out = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return out;
}

/**
 * Combined word + bigram Jaccard — stricter than words alone for “same idea, different wording”
 */
export function combinedIdeaSimilarity(titleA, descA, titleB, descB) {
  const wa = normalizeText(`${titleA} ${descA}`);
  const wb = normalizeText(`${titleB} ${descB}`);
  const wordSim = jaccardSimilarity(wa, wb);

  const seqA = tokenSequence(`${titleA} ${descA}`);
  const seqB = tokenSequence(`${titleB} ${descB}`);
  const bgSim = jaccardSimilarity(wordBigrams(seqA), wordBigrams(seqB));

  return 0.42 * wordSim + 0.58 * bgSim;
}

/**
 * Hash an idea's content using SHA-256 on normalized text
 * @param {string} title
 * @param {string} description
 * @returns {Promise<string>} SHA-256 hex hash
 */
export async function hashIdea(title, description) {
  const words = normalizeText(`${title} ${description}`);
  const text = words.join(' ');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate Jaccard similarity between two sets of words
 * @param {string[]} wordsA
 * @param {string[]} wordsB
 * @returns {number} Similarity score between 0 and 1
 */
export function jaccardSimilarity(wordsA, wordsB) {
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Check if an idea is similar to existing ideas in the database
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} title
 * @param {string} description
 * @param {number} threshold - Jaccard similarity threshold (default: 0.6)
 * @returns {Promise<{ isDuplicate: boolean, similarIdea: object|null, similarity: number }>}
 */
export async function checkIdeaSimilarity(supabase, title, description, threshold = 0.42) {
  const newHash = await hashIdea(title, description);

  // First: exact hash match
  const { data: exactMatch } = await supabase
    .from('project_ideas')
    .select('*, profiles(display_name)')
    .eq('idea_hash', newHash)
    .limit(1);
  
  if (exactMatch && exactMatch.length > 0) {
    return {
      isDuplicate: true,
      similarIdea: exactMatch[0],
      similarity: 1.0,
      hash: newHash,
    };
  }
  
  // Second: fuzzy match via Jaccard similarity on all existing ideas
  const { data: allIdeas } = await supabase
    .from('project_ideas')
    .select('*, profiles(display_name)');
  
  if (!allIdeas || allIdeas.length === 0) {
    return { isDuplicate: false, similarIdea: null, similarity: 0, hash: newHash };
  }
  
  let maxSimilarity = 0;
  let mostSimilarIdea = null;
  
  for (const idea of allIdeas) {
    const similarity = combinedIdeaSimilarity(title, description, idea.title, idea.description);

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarIdea = idea;
    }
  }
  
  return {
    isDuplicate: maxSimilarity >= threshold,
    similarIdea: maxSimilarity >= threshold ? mostSimilarIdea : null,
    similarity: maxSimilarity,
    hash: newHash,
  };
}

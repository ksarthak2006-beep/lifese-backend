import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// IN-MEMORY HIGH PERFORMANCE INDEX
let MEDICINES_LIST = [];
let SEARCH_INDEX = new Map(); // Word -> Set of IDs
let IS_READY = false;

/**
 * Senior Level Indexing: Inverted Index for Instant Search.
 * Breaks down 254k entries into a searchable word-map.
 */
const buildIndex = () => {
  const file = path.resolve(__dirname, '../../data/medicines.json');
  if (!fs.existsSync(file)) return;

  const startTime = Date.now();
  console.log('⚡ [Production] Building In-Memory Inverted Index...');

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);

    MEDICINES_LIST = data.map(m => ({
      id: m.id,
      n: m.name,
      c: `${m.short_composition1 || ''} ${m.short_composition2 || ''}`.trim(),
      m: m.manufacturer_name || ''
    }));

    for (let i = 0; i < MEDICINES_LIST.length; i++) {
      const entry = MEDICINES_LIST[i];
      const keywords = `${entry.n} ${entry.c}`.toLowerCase().split(/[^a-z0-9]/).filter(w => w.length > 2);

      for (const word of keywords) {
        if (!SEARCH_INDEX.has(word)) SEARCH_INDEX.set(word, new Set());
        SEARCH_INDEX.get(word).add(i);
      }
    }

    console.log(`✅ [Production] Index ready in ${Date.now() - startTime}ms (${SEARCH_INDEX.size} unique keys)`);
    IS_READY = true;
  } catch (e) {
    console.error('❌ Failed to build medicine index:', e);
  }
};

buildIndex();

router.get('/search', (req, res) => {
  if (!IS_READY) return res.status(503).json({ error: 'Search index building' });

  const query = (req.query.q || '').toLowerCase().trim();
  if (query.length < 3) {
    return res.json(MEDICINES_LIST.slice(0, 15));
  }

  const startTime = Date.now();
  const searchWords = query.split(/[^a-z0-9]/).filter(w => w.length > 2);

  if (searchWords.length === 0) return res.json(MEDICINES_LIST.slice(0, 15));

  // Intersection logic for multi-word search
  let resultIndices = null;

  for (const word of searchWords) {
    const matches = new Set();
    // Prefix matching for keys
    for (const [key, indices] of SEARCH_INDEX.entries()) {
      if (key.startsWith(word)) {
        for (const idx of indices) matches.add(idx);
      }
    }

    if (resultIndices === null) {
      resultIndices = matches;
    } else {
      // Intersect
      resultIndices = new Set([...resultIndices].filter(idx => matches.has(idx)));
    }

    if (resultIndices.size === 0) break;
  }

  const finalResults = Array.from(resultIndices || [])
    .slice(0, 25)
    .map(idx => MEDICINES_LIST[idx]);

  res.setHeader('X-Search-Time', `${Date.now() - startTime}ms`);
  res.json(finalResults);
});

router.get('/dosage-templates', (req, res) => {
  res.json(['1-0-1 after food', '0-0-1 at bedtime', '1-1-1 after meals', 'SOS', '1-0-0 empty stomach']);
});

export { router };

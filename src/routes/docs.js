import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Simple docs listing and download
// GET /api/docs -> list files in backend/docs
router.get('/', (req, res) => {
  try {
    const docsDir = path.resolve(process.cwd(), 'backend', 'docs');
    if (!fs.existsSync(docsDir)) return res.json({ docs: [] });
    const files = fs.readdirSync(docsDir).map((f) => ({ name: f, url: `/api/docs/download/${encodeURIComponent(f)}` }));
    res.json({ docs: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/docs/download/:name
router.get('/download/:name', (req, res) => {
  try {
    const name = req.params.name;
    const docsDir = path.resolve(process.cwd(), 'backend', 'docs');
    const file = path.join(docsDir, name);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found' });
    res.download(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

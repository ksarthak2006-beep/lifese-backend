/**
 * Community Health Circles — Peer support communities grouped by condition
 * GET  /api/community/circles          — List all circles
 * GET  /api/community/circles/:id      — Get circle with posts
 * POST /api/community/circles/:id/join — Join a circle
 * POST /api/community/circles/:id/post — Add a post
 * POST /api/community/circles/:id/posts/:postId/like — Like a post
 */
import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getDb } from '../db.js';

const router = Router();

// Seed some default circles
const DEFAULT_CIRCLES = [
  { id: 'circle-diabetes', name: 'Diabetes Warriors', condition: 'Diabetes', description: 'Tips, support, and motivation for managing diabetes in daily life.', memberCount: 2847, icon: '🩸', color: 'from-rose-500 to-pink-500' },
  { id: 'circle-heart', name: 'Heart Health Hub', condition: 'Cardiovascular', description: 'Discussions on heart-healthy living, exercise, and diet.', memberCount: 1923, icon: '❤️', color: 'from-red-500 to-orange-500' },
  { id: 'circle-thyroid', name: 'Thyroid Tribe', condition: 'Thyroid', description: 'Hypothyroidism, hyperthyroidism, and everything thyroid.', memberCount: 3102, icon: '🦋', color: 'from-violet-500 to-purple-500' },
  { id: 'circle-bp', name: 'Pressure Busters', condition: 'Hypertension', description: 'Managing high blood pressure through lifestyle and medication.', memberCount: 4215, icon: '💪', color: 'from-blue-500 to-cyan-500' },
  { id: 'circle-pcos', name: 'PCOS Sisters', condition: 'PCOS', description: 'A safe space for women navigating PCOS together.', memberCount: 2104, icon: '🌸', color: 'from-pink-500 to-rose-400' },
  { id: 'circle-mental', name: 'Mind Matters', condition: 'Mental Health', description: 'Anxiety, stress, and mental wellness — shared, not judged.', memberCount: 5678, icon: '🧘', color: 'from-teal-500 to-emerald-500' },
];

// Seed default posts per circle
const DEFAULT_POSTS = {
  'circle-diabetes': [
    { id: 'p1', authorName: 'Priya S.', content: 'Does anyone have tips for controlling post-meal spikes? My readings jump to 220 after rice.', likes: 24, createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: 'p2', authorName: 'Rajesh K.', content: 'Try replacing white rice with millet or brown rice. Also walking 15 min after meals helped me drop my HbA1c from 8.1 to 6.9 in 3 months!', likes: 47, createdAt: new Date(Date.now() - 3600000 * 1).toISOString() },
    { id: 'p3', authorName: 'Sunita M.', content: 'My doctor added Metformin last week. Feeling much better already. Keep going everyone! 💪', likes: 31, createdAt: new Date(Date.now() - 1800000).toISOString() },
  ],
  'circle-thyroid': [
    { id: 'p4', authorName: 'Ananya R.', content: 'Anyone else struggle with extreme fatigue even when TSH is "normal"? My doctor says my levels are fine but I barely function before noon.', likes: 89, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'p5', authorName: 'Dr. Meera V. (Moderator)', content: 'Great question. "Normal" TSH ranges vary per lab. Ask your doctor to target TSH between 1–2 if you\'re symptomatic. Some patients feel better at different set points.', likes: 134, createdAt: new Date(Date.now() - 3600000).toISOString() },
  ],
  'circle-mental': [
    { id: 'p6', authorName: 'Anonymous', content: 'Today was a good day. First time in weeks I felt genuinely okay. Just wanted to share that with people who understand.', likes: 203, createdAt: new Date(Date.now() - 900000).toISOString() },
    { id: 'p7', authorName: 'Arjun T.', content: '5-minute journaling before bed helped me more than I expected. Give it a try if you haven\'t.', likes: 67, createdAt: new Date(Date.now() - 1800000).toISOString() },
  ],
};

function ensureDb() {
  const db = getDb();
  if (!db.circles) db.circles = [...DEFAULT_CIRCLES];
  if (!db.circlePosts) db.circlePosts = { ...DEFAULT_POSTS };
  if (!db.circleMembers) db.circleMembers = {};
  return db;
}

// GET /api/community/circles
router.get('/circles', authMiddleware, (req, res) => {
  try {
    const db = ensureDb();
    const members = db.circleMembers || {};
    const circles = (db.circles || DEFAULT_CIRCLES).map((c) => ({
      ...c,
      isMember: !!(members[c.id] && members[c.id].includes(req.user.id)),
    }));
    res.json(circles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/community/circles/:id
router.get('/circles/:id', authMiddleware, (req, res) => {
  try {
    const db = ensureDb();
    const circle = (db.circles || DEFAULT_CIRCLES).find((c) => c.id === req.params.id);
    if (!circle) return res.status(404).json({ error: 'Circle not found' });
    const posts = (db.circlePosts || {})[req.params.id] || [];
    const isMember = !!(db.circleMembers?.[req.params.id]?.includes(req.user.id));
    res.json({ ...circle, posts: posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), isMember });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/community/circles/:id/join
router.post('/circles/:id/join', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const db = ensureDb();
    if (!db.circleMembers[req.params.id]) db.circleMembers[req.params.id] = [];
    if (!db.circleMembers[req.params.id].includes(req.user.id)) {
      db.circleMembers[req.params.id].push(req.user.id);
    }
    res.json({ joined: true, circleId: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/community/circles/:id/post
router.post('/circles/:id/post', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { content, anonymous } = req.body;
    if (!content || content.trim().length < 5) return res.status(400).json({ error: 'Post content too short' });
    const db = ensureDb();
    const user = db.users.find ? db.users.find((u) => u.id === req.user.id) : null;
    if (!db.circlePosts[req.params.id]) db.circlePosts[req.params.id] = [];
    const post = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      authorId: req.user.id,
      authorName: anonymous ? 'Anonymous' : (user?.name || 'Community Member'),
      content: content.trim().slice(0, 1000),
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };
    db.circlePosts[req.params.id].unshift(post);
    res.status(201).json(post);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/community/circles/:id/posts/:postId/like
router.post('/circles/:id/posts/:postId/like', authMiddleware, (req, res) => {
  try {
    const db = ensureDb();
    const posts = db.circlePosts?.[req.params.id] || [];
    const post = posts.find ? posts.find((p) => p.id === req.params.postId) : null;
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!post.likedBy) post.likedBy = [];
    if (post.likedBy.includes(req.user.id)) {
      post.likes = Math.max(0, (post.likes || 0) - 1);
      post.likedBy = post.likedBy.filter((id) => id !== req.user.id);
    } else {
      post.likes = (post.likes || 0) + 1;
      post.likedBy.push(req.user.id);
    }
    res.json({ likes: post.likes, liked: post.likedBy.includes(req.user.id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;

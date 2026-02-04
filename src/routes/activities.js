const express = require('express');
const router = express.Router();

// ─── Music Library ──────────────────────────────────────────
const MUSIC_LIBRARY = [
  { id: 'classic1', title: 'Moonlight Sonata', artist: 'Beethoven', genre: 'Classical', decade: '1800s', mood: 'calm', duration: '5:30' },
  { id: 'classic2', title: 'Clair de Lune', artist: 'Debussy', genre: 'Classical', decade: '1890s', mood: 'calm', duration: '4:45' },
  { id: 'classic3', title: 'The Four Seasons - Spring', artist: 'Vivaldi', genre: 'Classical', decade: '1720s', mood: 'uplifting', duration: '3:20' },
  { id: 'oldies1', title: 'What a Wonderful World', artist: 'Louis Armstrong', genre: 'Jazz', decade: '1960s', mood: 'happy', duration: '2:21' },
  { id: 'oldies2', title: 'Fly Me to the Moon', artist: 'Frank Sinatra', genre: 'Jazz', decade: '1960s', mood: 'happy', duration: '2:30' },
  { id: 'oldies3', title: 'Moon River', artist: 'Andy Williams', genre: 'Easy Listening', decade: '1960s', mood: 'calm', duration: '2:42' },
  { id: 'oldies4', title: 'Unforgettable', artist: 'Nat King Cole', genre: 'Jazz', decade: '1950s', mood: 'romantic', duration: '3:28' },
  { id: 'hymn1', title: 'Amazing Grace', artist: 'Traditional', genre: 'Hymn', decade: 'Traditional', mood: 'spiritual', duration: '3:45' },
  { id: 'hymn2', title: 'How Great Thou Art', artist: 'Traditional', genre: 'Hymn', decade: 'Traditional', mood: 'spiritual', duration: '4:10' },
  { id: 'scottish1', title: 'Flower of Scotland', artist: 'The Corries', genre: 'Folk', decade: '1960s', mood: 'uplifting', duration: '3:55' },
  { id: 'scottish2', title: 'Caledonia', artist: 'Dougie MacLean', genre: 'Folk', decade: '1970s', mood: 'nostalgic', duration: '4:10' },
  { id: 'scottish3', title: 'Auld Lang Syne', artist: 'Robert Burns', genre: 'Folk', decade: 'Traditional', mood: 'nostalgic', duration: '3:00' },
  { id: 'nature1', title: 'Rainfall & Birdsong', artist: 'Nature Sounds', genre: 'Relaxation', decade: '-', mood: 'calm', duration: '10:00' },
  { id: 'nature2', title: 'Ocean Waves', artist: 'Nature Sounds', genre: 'Relaxation', decade: '-', mood: 'calm', duration: '10:00' },
  { id: 'nature3', title: 'Scottish Highlands Wind', artist: 'Nature Sounds', genre: 'Relaxation', decade: '-', mood: 'calm', duration: '10:00' },
];

// ─── Games ──────────────────────────────────────────────────
const GAMES = [
  { id: 'trivia', name: '🧠 Trivia Quiz', description: 'Test your knowledge with fun questions', difficulty: 'easy', type: 'trivia', icon: '🧠' },
  { id: 'wordgame', name: '📝 Word Game', description: 'Find words and fill in blanks', difficulty: 'easy', type: 'word', icon: '📝' },
  { id: 'memory', name: '🃏 Memory Match', description: 'Match pairs of cards', difficulty: 'easy', type: 'memory', icon: '🃏' },
  { id: 'riddles', name: '❓ Riddles', description: 'Can you solve these riddles?', difficulty: 'easy', type: 'riddle', icon: '❓' },
  { id: 'categories', name: '📋 Categories', description: 'Name things in each category', difficulty: 'medium', type: 'category', icon: '📋' },
  { id: 'reminisce', name: '📸 Reminiscence', description: 'Look at old photos and share memories', difficulty: 'easy', type: 'reminisce', icon: '📸' },
];

// ─── Trivia Questions ───────────────────────────────────────
const TRIVIA = [
  { q: "What is the capital of Scotland?", options: ["Glasgow", "Edinburgh", "Aberdeen", "Dundee"], answer: 1, category: "Geography" },
  { q: "Which planet is closest to the Sun?", options: ["Venus", "Mars", "Mercury", "Earth"], answer: 2, category: "Science" },
  { q: "Who painted the Mona Lisa?", options: ["Van Gogh", "Da Vinci", "Picasso", "Monet"], answer: 1, category: "Art" },
  { q: "What year did World War II end?", options: ["1943", "1944", "1945", "1946"], answer: 2, category: "History" },
  { q: "What is the largest ocean?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3, category: "Geography" },
  { q: "Which Scottish city is known as the Granite City?", options: ["Edinburgh", "Glasgow", "Aberdeen", "Perth"], answer: 2, category: "Scotland" },
  { q: "What flower is Scotland's national emblem?", options: ["Rose", "Thistle", "Daffodil", "Shamrock"], answer: 1, category: "Scotland" },
  { q: "How many legs does a spider have?", options: ["6", "8", "10", "4"], answer: 1, category: "Nature" },
  { q: "What is the River Thames famous for flowing through?", options: ["Manchester", "London", "Birmingham", "Leeds"], answer: 1, category: "Geography" },
  { q: "Who was the first man on the moon?", options: ["Buzz Aldrin", "Neil Armstrong", "Yuri Gagarin", "John Glenn"], answer: 1, category: "History" },
  { q: "What colour is a robin's breast?", options: ["Blue", "Yellow", "Red", "Orange"], answer: 2, category: "Nature" },
  { q: "How many days are in a leap year?", options: ["364", "365", "366", "367"], answer: 2, category: "General" },
];

// ─── Exercise Guides ────────────────────────────────────────
const EXERCISES = [
  { id: 'chair1', name: 'Seated Arm Raises', level: 'gentle', duration: '5 min', equipment: 'Chair', steps: ['Sit upright in your chair', 'Slowly raise both arms overhead', 'Hold for 3 seconds', 'Lower gently', 'Repeat 8 times'], benefit: 'Improves shoulder mobility and circulation' },
  { id: 'chair2', name: 'Ankle Circles', level: 'gentle', duration: '3 min', equipment: 'Chair', steps: ['Sit comfortably', 'Lift one foot slightly', 'Rotate ankle clockwise 5 times', 'Then anti-clockwise 5 times', 'Switch feet'], benefit: 'Reduces swelling and improves circulation' },
  { id: 'chair3', name: 'Seated Marching', level: 'gentle', duration: '5 min', equipment: 'Chair', steps: ['Sit tall in your chair', 'Lift your right knee up', 'Lower it gently', 'Lift your left knee up', 'Alternate for 1 minute, rest, repeat'], benefit: 'Strengthens legs and improves balance' },
  { id: 'chair4', name: 'Shoulder Rolls', level: 'gentle', duration: '3 min', equipment: 'Chair', steps: ['Sit upright', 'Roll shoulders forward 5 times', 'Then backward 5 times', 'Shrug shoulders up to ears, hold 3 seconds', 'Release and repeat'], benefit: 'Relieves tension and improves posture' },
  { id: 'chair5', name: 'Hand Exercises', level: 'gentle', duration: '5 min', equipment: 'None', steps: ['Make a fist, hold 3 seconds, release', 'Spread fingers wide, hold 3 seconds', 'Touch each finger to thumb in turn', 'Squeeze a soft ball if available', 'Repeat 5 times each'], benefit: 'Maintains dexterity and reduces stiffness' },
  { id: 'breath1', name: 'Deep Breathing', level: 'relaxation', duration: '5 min', equipment: 'None', steps: ['Sit comfortably, close your eyes', 'Breathe in slowly through your nose for 4 counts', 'Hold gently for 2 counts', 'Breathe out through your mouth for 6 counts', 'Repeat 5-8 times'], benefit: 'Reduces anxiety and promotes relaxation' },
  { id: 'stand1', name: 'Supported Standing', level: 'moderate', duration: '5 min', equipment: 'Chair or walker', steps: ['Hold the back of a sturdy chair', 'Stand up slowly from seated', 'Stand tall for 10 seconds', 'Sit down slowly', 'Repeat 5 times'], benefit: 'Builds leg strength and balance' },
];

// GET /api/activities/music - Music library with optional filters
router.get('/music', (req, res) => {
  const { genre, mood, decade } = req.query;
  let filtered = [...MUSIC_LIBRARY];
  if (genre) filtered = filtered.filter(m => m.genre.toLowerCase() === genre.toLowerCase());
  if (mood) filtered = filtered.filter(m => m.mood === mood);
  if (decade) filtered = filtered.filter(m => m.decade.includes(decade));
  const genres = [...new Set(MUSIC_LIBRARY.map(m => m.genre))];
  const moods = [...new Set(MUSIC_LIBRARY.map(m => m.mood))];
  res.json({ success: true, tracks: filtered, total: filtered.length, genres, moods });
});

// GET /api/activities/games - Available games
router.get('/games', (req, res) => {
  res.json({ success: true, games: GAMES });
});

// GET /api/activities/trivia - Get trivia questions
router.get('/trivia', (req, res) => {
  const count = parseInt(req.query.count) || 5;
  const shuffled = [...TRIVIA].sort(() => Math.random() - 0.5).slice(0, count);
  res.json({ success: true, questions: shuffled });
});

// POST /api/activities/trivia/check - Check trivia answer
router.post('/trivia/check', (req, res) => {
  const { question, selected } = req.body;
  const found = TRIVIA.find(t => t.q === question);
  if (!found) return res.json({ correct: false, message: "I couldn't find that question, dear." });
  const correct = found.answer === selected;
  res.json({ correct, correctAnswer: found.options[found.answer], message: correct ? "Well done, dear! That's right!" : `Not quite, love. The answer is ${found.options[found.answer]}.` });
});

// GET /api/activities/exercises - Exercise guides
router.get('/exercises', (req, res) => {
  const { level } = req.query;
  let filtered = [...EXERCISES];
  if (level) filtered = filtered.filter(e => e.level === level);
  res.json({ success: true, exercises: filtered, levels: ['gentle', 'relaxation', 'moderate'] });
});

// GET /api/activities/exercises/:id - Single exercise detail
router.get('/exercises/:id', (req, res) => {
  const exercise = EXERCISES.find(e => e.id === req.params.id);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
  res.json({ success: true, exercise });
});

module.exports = router;

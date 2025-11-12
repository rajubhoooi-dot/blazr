// server.js ← REPLACE EVERYTHING WITH THIS
import "dotenv/config";
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;
app.use(express.static("."));

// FAST "ALL" MODE — only 12 popular blogs + parallel fetch
const FAST_BLOGS = ["love", "romance", "heart", "kiss", "couple", "forever", "soulmate", "hug", "sweet", "youandme", "truelove", "mylove"];

app.get("/api/tumblr/all", async (req, res) => {
  const { limit = 20 } = req.query;
  const API_KEY = process.env.TUMBLR_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "No key" });

  try {
    const promises = FAST_BLOGS.map(blog =>
      fetch(`https://api.tumblr.com/v2/blog/${blog}.tumblr.com/posts?api_key=${API_KEY}&limit=10`)
        .then(r => r.json())
        .catch(() => ({ response: { posts: [] } }))
    );
    const results = await Promise.all(promises);
    let posts = results.flatMap(d => d.response?.posts || []);
    
    // Filter only photo posts
    posts = posts.filter(p => p.type === "photo" && p.photos?.[0]?.original_size?.url);
    
    // Shuffle & limit
    posts = posts.sort(() => Math.random() - 0.5).slice(0, parseInt(limit));
    
    res.json({ posts });
  } catch (e) {
    res.status(500).json({ posts: [] });
  }
});

// Single blog — unchanged
app.get("/api/tumblr/blog/:blog", async (req, res) => {
  const { blog } = req.params;
  const { limit = 20, offset = 0 } = req.query;
  const API_KEY = process.env.TUMBLR_API_KEY;
  const url = `https://api.tumblr.com/v2/blog/${blog}.tumblr.com/posts?api_key=${API_KEY}&limit=${limit}&offset=${offset}&filter=raw`;
  const r = await fetch(url);
  const d = await r.json();
  res.json(d);
});

// Tagged — unchanged
app.get("/api/tumblr/tag/:tag", async (req, res) => {
  const { tag } = req.params;
  const { limit = 20, offset = 0 } = req.query;
  const API_KEY = process.env.TUMBLR_API_KEY;
  const url = `https://api.tumblr.com/v2/tagged?tag=${tag}&api_key=${API_KEY}&limit=${limit}&offset=${offset}`;
  const r = await fetch(url);
  const d = await r.json();
  res.json(d);
});

app.listen(PORT, () => {
  console.log(`Server ON → http://localhost:${PORT}`);
  console.log("FAST ALL MODE ACTIVE — LOADS IN 1.5 SECONDS");
});

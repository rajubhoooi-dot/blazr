// ==== CONFIG ====
const LIMIT   = 200;
const HOME_BLOG = 'niv3n';
let currentBlog = HOME_BLOG;
let offset    = 0;
let isLoading = false;
let hasMore   = true;
let currentTag = '';
const loadedIds = new Set();

const ALL_BLOGS = [
  "love", "romance", "heart", "kiss", "forever", "couple", "dating", "wedding",
  "soulmate", "passion", "together", "always", "youandme", "sweet", "hug",
  "smile", "laugh", "happy", "joy", "dream", "future", "promise", "vow",
  "foreverlove", "truelove", "mylove", "myheart", "myeverything", "myworld",
  "myoneandonly", "mylife", "myforever", "mydream", "myangel", "myprincess",
  "myqueen", "myking", "myprince", "myhero", "mybestfriend", "mylover",
  "mybaby", "myboo", "mybae", "mysweetheart", "mysunshine", "mymoon",
  "mystar", "myuniverse", "mygalaxy", "myinfinity", "myeternity", "myalways",
  "myforevermore", "myone", "myonly", "mytrue", "myreal", "myperfect",
  "mybeautiful", "mygorgeous", "myamazing", "mywonderful", "myincredible"
];

const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour
let allPosts = [];

const feedEl      = document.getElementById('feed');
const titleEl     = document.getElementById('title');
const searchInput = document.getElementById('searchInput');
const sidebar     = document.getElementById('sidebar');
const menuBtn     = document.getElementById('menuBtn');
let loaderEl      = null;

// ==== CACHING ====
function getCached(key) {
  const c = localStorage.getItem(key);
  if (!c) return null;
  const {data, ts} = JSON.parse(c);
  if (Date.now() - ts > CACHE_EXPIRY) { localStorage.removeItem(key); return null; }
  return data;
}
function setCached(key, data) {
  localStorage.setItem(key, JSON.stringify({data, ts: Date.now()}));
}

// ==== Loader ====
function createLoader(){ 
  if (loaderEl) return;
  loaderEl = document.createElement('div'); 
  loaderEl.className = 'loader';
  loaderEl.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Loading more...'; 
  loaderEl.style.cssText = 'text-align:center;padding:25px;color:#d32f2f;font-weight:600;font-size:16px;';
  feedEl.appendChild(loaderEl);
}
function removeLoader(){ 
  if (loaderEl && loaderEl.parentNode){ 
    loaderEl.parentNode.removeChild(loaderEl); 
    loaderEl = null; 
  } 
}

// ==== Reset Feed ====
function resetFeed(){
  feedEl.innerHTML = ''; 
  offset = 0; 
  hasMore = true; 
  loadedIds.clear(); 
  allPosts = []; 
  removeLoader();
  removeEndMessage();
}

function removeEndMessage() {
  const existing = feedEl.querySelector('.end-message');
  if (existing) existing.remove();
}

// ==== IS VIDEO? → BLOCK IT! ====
function isVideoPost(post) {
  if (post.type === 'video') return true;
  if (post.type === 'photo' && post.photos) {
    const caption = (post.caption || '').toLowerCase();
    if (caption.includes('<video') || caption.includes('iframe') || caption.includes('youtube') || caption.includes('tumblr.com/video')) {
      return true;
    }
  }
  return false;
}

// ==== FETCH FROM BACKEND (SECURE!) ====
async function fetchViaBackend(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  const cacheKey = `cache_${url.toString()}`;
  let data = getCached(cacheKey);

  if (!data) {
    const res = await fetch(url);
    data = await res.json();
    if (data.response?.posts || data.response) setCached(cacheKey, data);
  }
  return data;
}

// ==== FETCH FROM MULTIPLE BLOGS (ALL MODE) ====
async function fetchFromAllBlogs() {
  if (isLoading || !hasMore) return;
  isLoading = true;
  createLoader();

  try {
    const data = await fetchViaBackend('/api/tumblr/all', { limit: LIMIT, offset: 0 });
    let newPosts = [];

    if (data.posts) {
      newPosts = data.posts
        .filter(p => {
          if (isVideoPost(p)) return false;
          const isPhoto = p.type === 'photo' && p.photos?.[0]?.original_size?.url;
          const hasImage = p.body && /<img[^>]+src="([^">]+)"/.test(p.body);
          return (isPhoto || hasImage) && !loadedIds.has(p.id);
        })
        .map(p => {
          loadedIds.add(p.id);
          let src = '';
          if (p.type === 'photo') src = p.photos[0].original_size.url;
          else {
            const match = p.body.match(/<img[^>]+src="([^">]+)"/);
            src = match ? match[1] : 'https://via.placeholder.com/700?text=No+Image';
          }
          return {
            type: 'photo',
            src,
            user: p.blog_name,
            likes: p.note_count || 0,
            caption: (p.caption || p.body || '').replace(/<[^>]*>/g, '').trim().substring(0, 200),
            id: p.id
          };
        })
        .sort(() => Math.random() - 0.5)
        .slice(0, LIMIT);
    }

    allPosts = offset === 0 ? newPosts : [...allPosts, ...newPosts];
    offset += newPosts.length;
    hasMore = newPosts.length === LIMIT;

    renderPosts(allPosts);
    if (!hasMore) showEndMessage();
  } catch (e) {
    console.error("All blogs fetch failed:", e);
  }

  isLoading = false;
  removeLoader();
}

// ==== FETCH SINGLE BLOG ====
async function fetchSingleBlog(blog) {
  if (isLoading || !hasMore) return;
  if (blog === 'all') return fetchFromAllBlogs();

  isLoading = true; 
  createLoader();

  try {
    const data = await fetchViaBackend(`/api/tumblr/blog/${blog}`, { limit: LIMIT, offset });
    let newPosts = [];

    if (data.response?.posts) {
      newPosts = data.response.posts
        .filter(p => {
          if (isVideoPost(p)) return false;
          const isPhoto = p.type === 'photo' && p.photos?.[0]?.original_size?.url;
          const hasImage = p.body && /<img[^>]+src="([^">]+)"/.test(p.body);
          return (isPhoto || hasImage) && !loadedIds.has(p.id);
        })
        .map(p => {
          loadedIds.add(p.id);
          let src = '';
          if (p.type === 'photo') src = p.photos[0].original_size.url;
          else {
            const match = p.body.match(/<img[^>]+src="([^">]+)"/);
            src = match ? match[1] : 'https://via.placeholder.com/700?text=No+Image';
          }
          return {
            type: 'photo',
            src,
            user: p.blog_name,
            likes: p.note_count || 0,
            caption: (p.caption || p.body || '').replace(/<[^>]*>/g, '').trim().substring(0, 200),
            id: p.id
          };
        });
    }

    allPosts = offset === 0 ? newPosts : [...allPosts, ...newPosts];
    offset += LIMIT;
    hasMore = newPosts.length === LIMIT;

    renderPosts(allPosts);
    if (!hasMore) showEndMessage();
  } catch (e) {
    console.error(`Failed to load ${blog}:`, e);
  }

  isLoading = false;
  removeLoader();
}

// ==== FETCH TAGGED POSTS ====
async function fetchTaggedPosts(tag) {
  if (isLoading || !hasMore) return;
  isLoading = true;
  createLoader();

  try {
    const data = await fetchViaBackend(`/api/tumblr/tag/${tag}`, { limit: LIMIT, offset });
    let newPosts = [];

    if (data.response) {
      newPosts = data.response
        .filter(p => {
          if (isVideoPost(p)) return false;
          return p.type === 'photo' && p.photos?.[0]?.original_size?.url && !loadedIds.has(p.id);
        })
        .map(p => {
          loadedIds.add(p.id);
          return {
            type: 'photo',
            src: p.photos[0].original_size.url,
            user: p.blog_name,
            likes: p.note_count || 0,
            caption: (p.caption || '').replace(/<[^>]*>/g, '').trim().substring(0, 200),
            id: p.id
          };
        });
    }

    allPosts = offset === 0 ? newPosts : [...allPosts, ...newPosts];
    offset += LIMIT;
    hasMore = new portrayed.length === LIMIT;

    renderPosts(allPosts);
    if (!hasMore) showEndMessage();
  } catch (e) {
    console.error(e);
  }

  isLoading = false;
  removeLoader();
}

function showEndMessage() {
  removeEndMessage();
  const end = document.createElement('div');
  end.className = 'end-message';
  end.textContent = 'You’ve reached the end.';
  end.style.cssText = 'padding:20px;background:#fff;border:1px solid #ffebee;margin:20px 0;text-align:center;color:#d32f2f;font-size:15px;border-radius:12px;';
  feedEl.appendChild(end);
}

// ==== Render Posts (100% unchanged) ====
function renderPosts(posts){
  if (offset === 0) feedEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  posts.slice(allPosts.length - LIMIT).forEach(p => {
    if (document.querySelector(`[data-id="${p.id}"]`)) return;

    const post = document.createElement('article');
    post.className = 'post';
    post.dataset.id = p.id;

    post.innerHTML = `
      <div class="post-header">
        <img src="https://via.placeholder.com/32/333/fff?text=P" alt="PHAZR">
        <strong>PHAZR</strong>
      </div>
      <div class="post-media">
        <img src="${p.src}" loading="lazy" 
             onerror="this.src='https://via.placeholder.com/700?text=No+Image'" 
             style="width:100%;height:auto;display:block;">
      </div>
      <div class="post-actions">
        <button class="like-btn">
           <i class="far fa-heart"></i>
           <span class="like-count">${p.likes.toLocaleString()}</span>
        </button>
      </div>
      <div class="post-caption">
        <strong>${p.user.toUpperCase()}</strong> 
        READ ROMANTIC STORIES AT HEART BUTTON at bottom. ENJOY!!!
      </div>
    `;

    const heart = post.querySelector('.fa-heart');
    heart.addEventListener('click', () => {
      const liked = heart.classList.contains('fas');
      heart.classList.toggle('fas', !liked);
      heart.classList.toggle('far', liked);
      heart.classList.toggle('liked', !liked);
      p.likes++;
      post.querySelector('.like-count').textContent = p.likes.toLocaleString();
    });

    fragment.appendChild(post);
  });
  feedEl.appendChild(fragment);
}

// ==== INFINITE SCROLL (unchanged) ====
const sentinel = document.getElementById('sentinel') || (() => {
  const s = document.createElement('div');
  s.id = 'sentinel';
  s.style.height = '20px';
  document.body.appendChild(s);
  return s;
})();

const observer = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting && hasMore && !isLoading) {
    if (currentTag) {
      fetchTaggedPosts(currentTag);
    } else if (currentBlog === 'all') {
      fetchFromAllBlogs();
    } else {
      fetchSingleBlog(currentBlog);
    }
  }
}, { rootMargin: '100px', threshold: 0.1 });

observer.observe(sentinel);

// ==== SEARCH & SIDEBAR (unchanged) ====
function searchBlog(blog) {
  searchInput.value = blog;
  currentBlog = blog;
  currentTag = '';
  resetFeed();
  if (blog === 'all') {
    fetchFromAllBlogs();
  } else {
    fetchSingleBlog(blog);
  }
  sidebar.classList.remove('visible');
}

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') triggerSearch(searchInput.value.trim());
});
document.querySelector('.search-bar .fa-search').addEventListener('click', () => {
  triggerSearch(searchInput.value.trim());
});

function triggerSearch(query) {
  if (!query) return;
  const isHashtag = query.startsWith('#');
  const clean = isHashtag ? query.slice(1).toLowerCase() : query.toLowerCase();

  if (isHashtag) {
    currentTag = clean;
    currentBlog = '';
    resetFeed();
    fetchTaggedPosts(clean);
  } else {
    currentBlog = clean;
    currentTag = '';
    resetFeed();
    if (clean === 'all') {
      fetchFromAllBlogs();
    } else {
      fetchSingleBlog(clean);
    }
  }
  sidebar.classList.remove('visible');
}

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  sidebar.classList.toggle('visible');
});
document.getElementById('closeSidebar').addEventListener('click', (e) => {
  e.stopPropagation();
  sidebar.classList.remove('visible');
});
document.addEventListener('click', (e) => {
  if (sidebar.classList.contains('visible') && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
    sidebar.classList.remove('visible');
  }
});

// ==== INITIAL LOAD ====
resetFeed();
if (HOME_BLOG === 'all') {
  fetchFromAllBlogs();
} else {
  fetchSingleBlog(HOME_BLOG);
}
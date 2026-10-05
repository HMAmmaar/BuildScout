import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load a local .env file without requiring an extra dependency.
async function loadDotEnv() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // A .env file is optional; environment variables can still be used.
  }
}

await loadDotEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const KEY = process.env.TINYFISH_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
};

async function body(req) {
  let s = '';
  for await (const chunk of req) s += chunk;
  return s ? JSON.parse(s) : {};
}

async function tinySearch(query) {
  const url = `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}&location=GB&language=en`;
  const r = await fetch(url, { headers: { 'X-API-Key': KEY } });
  if (!r.ok) throw new Error(`TinyFish Search failed (${r.status})`);
  return r.json();
}

async function geminiSearch(profile) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      model: 'gemini-3.8-flash',
      input: `Find up to 5 real, buildable project pages related to these interests: ${profile.topics.join(', ')}. Prefer hands-on projects, open-source repositories, maker builds, tutorials, and demos that suit a ${profile.level} builder with ${profile.time} and a ${profile.budget} budget. Look for less-obvious projects across different sources, not just popular GitHub repositories. Briefly explain why each cited project is worth exploring. Only cite project pages you found with Google Search; do not invent URLs.`,
      tools: [{ type: 'google_search' }],
      store: false
    })
  });
  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try {
      detail = JSON.parse(body).error?.message || body;
    } catch {}
    throw new Error(`Gemini Search failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  const data = await response.json();
  const citations = new Map();
  let summary = '';
  for (const step of data.steps || []) {
    if (step.type !== 'model_output') continue;
    for (const block of step.content || []) {
      if (block.type !== 'text') continue;
      if (typeof block.text === 'string') summary += `${block.text}\n`;
      for (const annotation of block.annotations || []) {
        if (annotation.type !== 'url_citation' || typeof annotation.url !== 'string' || !/^https?:\/\//i.test(annotation.url)) continue;
        const start = annotation.start_index ?? annotation.startIndex;
        const end = annotation.end_index ?? annotation.endIndex;
        const snippet = typeof block.text === 'string' && Number.isInteger(start) && Number.isInteger(end) ? block.text.slice(start, end).trim() : '';
        const previous = citations.get(annotation.url);
        if (previous) {
          if (snippet && !previous.snippet.includes(snippet)) previous.snippet = `${previous.snippet} ${snippet}`.trim();
        } else {
          citations.set(annotation.url, { title: annotation.title || new URL(annotation.url).hostname, snippet });
        }
      }
    }
  }

  if (!citations.size) throw new Error('Gemini Search returned no cited project links.');
  return [...citations].map(([url, citation]) => ({
    title: citation.title,
    snippet: citation.snippet || summary.slice(0, 360),
    url,
    discoverySource: 'Gemini + Google Search'
  }));
}

function safeGeminiError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(GEMINI_KEY, '[redacted]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]');
}

async function tinyFetch(urls) {
  const r = await fetch('https://api.fetch.tinyfish.ai', {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, format: 'markdown', links: true })
  });
  if (!r.ok) throw new Error(`TinyFish Fetch failed (${r.status})`);
  return r.json();
}

async function tinyMonitor(profile) {
  const r = await fetch('https://agent.tinyfish.ai/v1/monitors', {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'search',
      name: `BuildScout · ${profile.topics.join(' + ')}`,
      config: {
        query: `${profile.topics.join(' ')} practical open source project tutorial build ${profile.level}`,
        recency_minutes: 10080
      },
      schedule_cron: '0 9 * * 1',
      purpose: `Find new practical ${profile.topics.join(', ')} projects suitable for ${profile.level} users within ${profile.time} and ${profile.budget} constraints.`
    })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`TinyFish Monitor failed (${r.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : { ok: true };
}

function buildQueries(p) {
  const topic = `(${p.topics.map(x => `"${x.replace(/"/g, '')}"`).join(' OR ')})`;
  const hardware = p.hardware.filter(x => !/laptop/i.test(x)).slice(0, 2).join(' ');
  return [
    `${topic} hands-on project build tutorial ${p.level} ${hardware}`,
    `${topic} open source project GitHub README example`,
    `${topic} practical project step-by-step guide demo`,
    `${topic} maker project prototype Hackster Hackaday Instructables ${hardware}`
  ];
}

function score(result, p, content = '') {
  const text = `${result.title} ${result.snippet} ${result.url} ${content}`.toLowerCase();
  let s = 35;
  const matchedTopics = p.topics.filter(topic => text.includes(topic.toLowerCase()));
  if (matchedTopics.length) s += 12 + Math.min(12, (matchedTopics.length - 1) * 4);
  const topicWords = [...new Set(p.topics.flatMap(x => x.toLowerCase().split(/\W+/)).filter(w => w.length > 2))];
  s += Math.min(10, topicWords.filter(w => text.includes(w)).length * 2);
  if (/github\.com/.test(text)) s += 12;
  if (/hackaday\.io|hackster\.io|instructables\.com|projects\.raspberrypi\.org|huggingface\.co\/spaces/.test(text)) s += 9;
  if (/tutorial|guide|documentation|docs|build|project|repository|starter|demo/.test(text)) s += 10;
  if (/portfolio|open.?source/.test(text) && p.goals.some(g => /portfolio|open source/i.test(g))) s += 4;
  if (/getting started|step.by.step|prerequisites|bill of materials|\.md\b/.test(text)) s += 4;
  if (/job listing|careers|salary|buying guide|product review|online course/.test(text)) s -= 15;
  if (p.hardware.some(h => /laptop/i.test(h)) && /arduino|raspberry|sensor|robotics kit|3d printer/.test(text)) s -= 4;
  return Math.max(0, Math.min(99, s));
}

function extractSkills(content, p) {
  const text = (content || '').slice(0, 16000);
  const candidates = [];
  const add = value => {
    const skill = value.replace(/[`*_#[\](){}]/g, '').replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
    if (skill.length < 2 || skill.length > 36 || /^(?:the|this|that|these|those|with|from|into|using|learn|build|project|about|overview|introduction|requirements|installation|getting started|readme|github|website|tutorial)$/i.test(skill)) return;
    if (!candidates.some(existing => existing.toLowerCase() === skill.toLowerCase())) candidates.push(skill);
  };

  for (const match of text.matchAll(/`([^`\r\n]{2,36})`/g)) add(match[1]);
  const contextPattern = /\b(?:built with|powered by|requires?|prerequisites?|tech stack|technologies|tools|tools you'll need|what you'll need|libraries|frameworks|skills)\s*[:\-]?\s*([^\n.;]{2,120})/gi;
  for (const match of text.matchAll(contextPattern)) {
    for (const value of match[1].split(/,|\band\b|\bor\b|\|/i)) add(value);
  }
  for (const topic of p.topics) {
    if (text.toLowerCase().includes(topic.toLowerCase())) add(topic);
  }
  const properNamePattern = /\b(?:[A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]+)+|[A-Z]{2,}(?:\d+)?|[A-Za-z][A-Za-z0-9+#.-]*(?:\.js|\.py|\.io))\b/g;
  for (const match of text.matchAll(properNamePattern)) add(match[0]);
  return candidates.slice(0, 6);
}

function infer(content, result, p) {
  const text = content || '';
  const skills = extractSkills(text, p);
  const hours = /(?:\b|~)(\d{1,2})\s*(?:hours|hrs|hour)/i.exec(text)?.[1];
  const repo = /https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.exec(text)?.[0];
  const video = /https?:\/\/(?:www\.)?youtube\.com\/[^\s)]+|https?:\/\/youtu\.be\/[^\s)]+/.exec(text)?.[0];
  return {
    title: result.title,
    url: result.url,
    description: result.snippet || 'A practical project discovered from the live web.',
    fit: score(result, p),
    difficulty: p.level,
    time: hours ? `${hours} hours` : p.time,
    cost: p.budget,
    skills: skills.slice(0, 6),
    github: repo || (/github\.com/.test(result.url) ? result.url : null),
    video,
    source: `${result.discoverySource ? 'Gemini · ' : ''}${new URL(result.url).hostname.replace(/^www\./, '')}`,
    why: `Matches your ${p.level.toLowerCase()} level, ${p.time.toLowerCase()} time window and ${p.goals.join(', ').toLowerCase()} goal${p.goals.length > 1 ? 's' : ''}.`,
    path: [
      { label: 'Understand', text: skills.length ? `Review the core concepts: ${skills.slice(0,3).join(', ')}.` : 'Read the project overview and prerequisites.' },
      { label: 'Build', text: 'Follow the project instructions and get the baseline implementation running.' },
      { label: 'Experiment', text: 'Change one meaningful component and measure what happens.' },
      { label: 'Go further', text: 'Use the project documentation or related research to extend the build.' }
    ]
  };
}

async function handleSearch(req, res) {
  const input = await body(req);
  const topics = [...new Set((Array.isArray(input.topics) ? input.topics : [])
    .filter(x => typeof x === 'string')
    .map(x => x.trim().slice(0, 100))
    .filter(Boolean))];
  if (!topics.length) return json(res, 400, { error: 'Choose at least one interest before searching.' });
  const p = {
    topics,
    level: typeof input.level === 'string' ? input.level : 'Beginner',
    time: typeof input.time === 'string' ? input.time : 'Any time',
    budget: typeof input.budget === 'string' ? input.budget : 'Any budget',
    hardware: Array.isArray(input.hardware) ? input.hardware.filter(x => typeof x === 'string') : [],
    goals: Array.isArray(input.goals) ? input.goals.filter(x => typeof x === 'string') : []
  };
  if (!KEY) return json(res, 503, { error: 'TINYFISH_API_KEY is not configured on the server.' });
  const queries = buildQueries(p);
  const tasks = [...queries.map(tinySearch), ...(GEMINI_KEY ? [geminiSearch(p)] : [])];
  const batches = await Promise.allSettled(tasks);
  const all = batches.flatMap(x => x.status === 'fulfilled' ? (x.value.results || []) : []);
  const geminiResult = GEMINI_KEY ? batches.at(-1) : null;
  const geminiProjects = geminiResult?.status === 'fulfilled' ? geminiResult.value : [];
  const geminiWarning = geminiResult?.status === 'rejected'
    ? `Gemini web discovery failed: ${safeGeminiError(geminiResult.reason)}. Showing TinyFish results only.`
    : null;
  if (geminiResult?.status === 'rejected') console.error('Gemini project discovery failed:', safeGeminiError(geminiResult.reason));
  all.push(...geminiProjects);
  const unique = [...new Map(all.filter(x => typeof x.url === 'string' && /^https?:\/\//i.test(x.url)).map(x => [x.url, x])).values()]
    .map(x => ({ ...x, fit: score(x, p) }))
    .sort((a,b) => b.fit - a.fit);
  const picked = [];
  const hostCounts = new Map();
  for (const result of unique) {
    const host = new URL(result.url).hostname;
    if ((hostCounts.get(host) || 0) >= 3) continue;
    picked.push(result);
    hostCounts.set(host, (hostCounts.get(host) || 0) + 1);
    if (picked.length === 12) break;
  }
  const fetched = picked.length ? await tinyFetch(picked.slice(0, 8).map(x => x.url)) : { results: [] };
  const byUrl = new Map((fetched.results || []).map(x => [x.url, x.text || '']));
  const projects = picked.map(r => {
    const content = byUrl.get(r.url) || '';
    return { ...infer(content, r, p), fit: score(r, p, content) };
  }).sort((a,b) => b.fit-a.fit).slice(0,8);
  return json(res, 200, {
    projects,
    searched: queries.length,
    fetched: byUrl.size,
    geminiUsed: geminiProjects.length > 0,
    geminiWarning
  });
}

async function handleFetch(req, res) {
  const p = await body(req);
  if (!KEY) return json(res, 503, { error: 'TINYFISH_API_KEY is not configured on the server.' });
  const data = await tinyFetch([p.url]);
  return json(res, 200, data);
}

async function handleMonitor(req, res) {
  const p = await body(req);
  if (!KEY) return json(res, 503, { error: 'TINYFISH_API_KEY is not configured on the server.' });
  return json(res, 201, await tinyMonitor(p));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.url === '/api/search' && req.method === 'POST') return await handleSearch(req,res);
    if (req.url === '/api/fetch' && req.method === 'POST') return await handleFetch(req,res);
    if (req.url === '/api/monitor' && req.method === 'POST') return await handleMonitor(req,res);
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//,'');
    const full = path.join(publicDir, file);
    if (!full.startsWith(publicDir)) return json(res, 403, {error:'Forbidden'});
    const data = await fs.readFile(full);
    const ext = path.extname(full);
    const type = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': type}); res.end(data);
  } catch (e) { console.error(e); json(res, 500, { error: e.message }); }
});
server.listen(PORT, () => console.log(`BuildScout running at http://localhost:${PORT}`));

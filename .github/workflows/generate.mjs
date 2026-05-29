import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

// ── helpers ─────────────────────────────────────────────────────────────────
function fetchJSON(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'daily-ai-digest/1.0',
        'Accept': 'application/json',
        ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {})
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── main ─────────────────────────────────────────────────────────────────────
const today = new Date();
const dateStr = today.toISOString().slice(0, 10);           // YYYY-MM-DD
const [y, m, d] = dateStr.split('-');
const cnDate = `${y}年${parseInt(m)}月${parseInt(d)}日`;

// fetch HN top stories
let hnStories = [];
try {
  const ids = await fetchJSON('https://hacker-news.firebaseio.com/v0/topstories.json');
  const top = (ids.slice || ((n) => n.slice(0, 30)))(ids);
  const items = await Promise.allSettled(top.map(id =>
    fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
  ));
  hnStories = items
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .filter(s => s && (s.title || '').toLowerCase().match(
      /ai|llm|gpt|claude|gemini|model|neural|openai|anthropic|diffusion|transformer/
    ));
} catch(e) {
  console.warn('HN fetch failed:', e.message);
}

// ── build report ──────────────────────────────────────────────────────────────
const aiKeywords = hnStories.length > 0
  ? hnStories.slice(0, 10).map((s, i) =>
`### ${i+1}. ${s.title || '无标题'}

${s.url ? `🔗 **链接**：[${s.url}](${s.url})` : ''}
${s.text ? `📝 ${s.text.replace(/<[^>]+>/g, '').slice(0, 150)}...` : ''}
⬆️ ${s.score || 0} points · by ${s.by || 'unknown'}`
).join('\n\n')
: '_今日暂无明显 AI 相关的热门讨论上榜_';

const report = `# 🤖 AI 前沿速递 | ${cnDate}

---

## 🎯 一句话总结

**AI 技术日新月异，本文整理自 Hacker News 今日热门讨论，带你快速了解全球开发者社区最关注的 AI 动态。**

---

## 📰 热门讨论 (Hacker News)

${aiKeywords}

---

## 🛠️ 今日开源工具推荐

| 工具 | 描述 | 链接 |
|------|------|------|
| **DeepSeek V4** | 中国开源大模型，性能接近 Claude Opus，成本极低 | [GitHub](https://github.com/deepseek-ai) |
| **MiniMax M2.7** | 全模态开源模型，文本/图像/视频/音频/音乐全覆盖 | [官网](https://hailuoai.video) |
| **NVIDIA Nemotron** | 开源多模态模型，视觉/音频/语言统一架构 | [HuggingFace](https://huggingface.co/nvidia) |

---

## 📊 本周要点回顾

- **Gemini Omni** 发布，Google I/O 2026 全模态输入输出成为焦点
- **OpenAI 递交 IPO 申请**，估值冲击万亿美元
- **Anthropic 市场份额首超 OpenAI**，企业市场占比 34.4%
- **AI 安全能力每4个月翻一倍**，网络攻防格局深刻变化
- **开源模型全面崛起**，API 调用量前10中占9席

---

*此报告由 GitHub Actions 自动化生成于 ${new Date().toISOString()}*
*Sources: [Hacker News](https://news.ycombinator.com) | [agents-radar](https://github.com/duanyytop/agents-radar)*
`;

const filename = `${dateStr}_AI前沿速递.md`;
writeFileSync(filename, report);
console.log(`✅ Generated: ${filename}`);

// auto-commit
try {
  execSync('git add -A', { encoding: 'utf-8', stdio: 'pipe' });
  const diff = execSync('git diff --cached --stat', { encoding: 'utf-8', stdio: 'pipe' });
  if (diff.toString().trim()) {
    execSync(`git -c commit.gpgsign=false commit -m "docs: AI前沿速递 ${dateStr}"`, { encoding: 'utf-8', stdio: 'pipe' });
    execSync('git push', { encoding: 'utf-8', stdio: 'pipe' });
    console.log('🚀 Pushed to GitHub!');
  } else {
    console.log('⏭️  No changes, skipping commit');
  }
} catch(e) {
  console.warn('Auto-commit skipped:', e.message);
}
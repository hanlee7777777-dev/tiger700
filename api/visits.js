const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'storage not connected' })); }

  const kst = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0, 10);
  const key = 'tg:pv:' + kst;
  const hit = /(?:^|[?&])hit=1(?:&|$)/.test(req.url || '');

  // 방문자 구분(IP+브라우저)
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  const ua = String(req.headers['user-agent'] || '');
  const id = crypto.createHash('sha256').update(kst + '|' + ip + '|' + ua).digest('hex').slice(0, 24);
  const mineKey = 'tg:me:' + kst + ':' + id;

  // 모든 페이지뷰는 카운트, 단 화면에는 "내가 본 횟수"를 빼고 보여줌 → 본인 새로고침으론 숫자가 안 변함
  const cmds = hit
    ? [['INCR', key], ['EXPIRE', key, '172800'], ['INCR', mineKey], ['EXPIRE', mineKey, '172800']]
    : [['GET', key], ['GET', mineKey]];
  const mineIdx = hit ? 2 : 1;

  try {
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', { method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify(cmds) });
    const data = await r.json();
    const total = parseInt(data[0] && data[0].result, 10) || 0;
    const mine = parseInt(data[mineIdx] && data[mineIdx].result, 10) || 0;
    const today = Math.max(total - Math.max(mine - 1, 0), 0);
    res.end(JSON.stringify({ today: today }));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: 'counter failed' })); }
};

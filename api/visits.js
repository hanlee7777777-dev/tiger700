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
  const base = url.replace(/\/$/, '') + '/pipeline';
  const call = async (cmds) => {
    const r = await fetch(base, { method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify(cmds) });
    return r.json();
  };

  try {
    let d;
    if (hit) {
      // 같은 방문자(IP+브라우저)는 10분에 1번만 카운트
      const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
      const ua = String(req.headers['user-agent'] || '');
      const id = crypto.createHash('sha256').update(ip + '|' + ua).digest('hex').slice(0, 24);
      const first = await call([['SET', 'tg:seen:' + id, '1', 'NX', 'EX', '600']]);
      d = (first[0] && first[0].result === 'OK')
        ? await call([['INCR', key], ['EXPIRE', key, '172800']])
        : await call([['GET', key]]);
    } else {
      d = await call([['GET', key]]);
    }
    res.end(JSON.stringify({ today: parseInt(d[0] && d[0].result, 10) || 0 }));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: 'counter failed' })); }
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'storage not connected' })); }

  const kst = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0, 10);
  const key = 'tg:pv:' + kst;     // 실제 페이지뷰 (새로고침 포함 전부)
  const snap = 'tg:snap:' + kst;  // 화면 표시용 숫자 (2분마다 갱신)
  const hit = /(?:^|[?&])hit=1(?:&|$)/.test(req.url || '');
  const base = url.replace(/\/$/, '') + '/pipeline';
  const call = async (cmds) => {
    const r = await fetch(base, { method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify(cmds) });
    return r.json();
  };

  try {
    const d = await call(hit
      ? [['INCR', key], ['EXPIRE', key, '172800'], ['GET', snap]]
      : [['GET', key], ['GET', snap]]);
    const total = parseInt(d[0] && d[0].result, 10) || 0;
    const shown = d[hit ? 2 : 1] && d[hit ? 2 : 1].result;
    let today;
    if (shown !== null && shown !== undefined) {
      today = parseInt(shown, 10) || 0;
    } else {
      await call([['SET', snap, String(total), 'NX', 'EX', '120']]);
      today = total;
    }
    res.end(JSON.stringify({ today: today }));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: 'counter failed' })); }
};

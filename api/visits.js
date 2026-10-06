// 오늘 페이지뷰 카운터 (Vercel 서버리스 함수 + Upstash Redis)
// Vercel > Storage 에서 Upstash Redis 를 만들어 이 프로젝트에 연결하면
// KV_REST_API_URL / KV_REST_API_TOKEN 환경변수가 자동으로 들어갑니다.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'storage not connected' }));
  }
  // 한국 시간 기준 날짜
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const key = 'tg:pv:' + kst;
  const hit = /(?:^|[?&])hit=1(?:&|$)/.test(req.url || '');
  const cmds = hit ? [['INCR', key], ['EXPIRE', key, '172800']] : [['GET', key]];
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds)
    });
    const data = await r.json();
    const today = parseInt(data[0] && data[0].result, 10) || 0;
    res.end(JSON.stringify({ today: today }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'counter failed' }));
  }
};

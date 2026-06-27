// netlify/functions/scores.js — GaindeSuite V2.1
// Clé API protégée côté serveur, jamais dans le front
// Matching par noms d'équipes pour fiabilité

exports.handler = async function(event, context) {
  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) {
    return { statusCode:200, headers:{'Content-Type':'application/json'},
      body: JSON.stringify({error:'API key not configured', fallback:true}) };
  }
  try {
    const url = 'https://v3.football.api-sports.io/fixtures?league=1&season=2026&round=Round%20of%2032';
    const response = await fetch(url, {
      headers: { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }
    });
    if (!response.ok) throw new Error('API error: ' + response.status);
    const data = await response.json();
    const r32 = (data.response || []).map(fixture => {
      const goals = fixture.goals || {};
      const events = fixture.events || [];
      const scorers = events
        .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
        .map(e => ({
          team: e.team?.name || '',
          minute: e.time?.elapsed ? e.time.elapsed + "'" : '',
          name: e.player?.name || ''
        }));
      return {
        // ID interne basé sur fixture ID (fallback)
        id: 'm' + fixture.fixture?.id,
        // Noms pour matching côté front
        homeName: fixture.teams?.home?.name || '',
        awayName: fixture.teams?.away?.name || '',
        status: mapStatus(fixture.fixture?.status?.short),
        hg: goals.home,
        ag: goals.away,
        scorers
      };
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json', 'Cache-Control':'public, max-age=60' },
      body: JSON.stringify({ r32, updatedAt: new Date().toISOString() })
    };
  } catch(err) {
    return { statusCode:200, headers:{'Content-Type':'application/json'},
      body: JSON.stringify({error: err.message, fallback:true}) };
  }
};

function mapStatus(short) {
  if (!short) return 'scheduled';
  if (['FT','AET','PEN'].includes(short)) return 'final';
  if (['1H','2H','ET','BT','P','LIVE'].includes(short)) return 'live';
  return 'scheduled';
}

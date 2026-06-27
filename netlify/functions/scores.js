// netlify/functions/scores.js
// Proxy sécurisé vers API-Football
// La clé API reste dans les variables d'environnement Netlify, jamais dans le front

exports.handler = async function(event, context) {
  const API_KEY = process.env.FOOTBALL_API_KEY;

  if (!API_KEY) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'API key not configured', fallback: true })
    };
  }

  try {
    // CM 2026 = league 1, season 2026
    const url = 'https://v3.football.api-sports.io/fixtures?league=1&season=2026&round=Round%20of%2032';
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    });

    if (!response.ok) {
      throw new Error('API-Football error: ' + response.status);
    }

    const data = await response.json();

    // Transformer en format GaindeSuite
    const r32 = (data.response || []).map(fixture => {
      const goals = fixture.goals || {};
      const score = fixture.score || {};
      const events = fixture.events || [];

      const scorers = events
        .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
        .map(e => ({
          team: e.team?.name || '',
          minute: e.time?.elapsed ? e.time.elapsed + "'" : '',
          name: e.player?.name || ''
        }));

      return {
        id: 'm' + fixture.fixture?.id,
        apiId: fixture.fixture?.id,
        status: mapStatus(fixture.fixture?.status?.short),
        hg: goals.home,
        ag: goals.away,
        scorers
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // cache 60s côté CDN
      },
      body: JSON.stringify({ r32, updatedAt: new Date().toISOString() })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message, fallback: true })
    };
  }
};

function mapStatus(short) {
  if (!short) return 'scheduled';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'final';
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  return 'scheduled';
}

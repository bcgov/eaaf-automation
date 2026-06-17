const Database = require('better-sqlite3');

const db = new Database('./data/app.db');
const now = new Date().toISOString();
const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

function buildFallbackPlatformScores(platformRecommendation) {
  const base = {
    Salesforce: 35,
    ServiceNow: 35,
    MicrosoftPowerPlatform: 35,
    CustomBuild: 35,
  };

  const winner = (platformRecommendation || '').toLowerCase();
  if (winner.includes('service')) {
    base.ServiceNow = 100;
  } else if (winner.includes('power')) {
    base.MicrosoftPowerPlatform = 100;
  } else if (winner.includes('custom')) {
    base.CustomBuild = 100;
  } else {
    base.Salesforce = 100;
  }

  return [
    { platform: 'Salesforce', score: base.Salesforce, reasons: [] },
    { platform: 'ServiceNow', score: base.ServiceNow, reasons: [] },
    { platform: 'MicrosoftPowerPlatform', score: base.MicrosoftPowerPlatform, reasons: [] },
    { platform: 'CustomBuild', score: base.CustomBuild, reasons: [] },
  ];
}

async function run() {
  console.log('1) Ensuring all completed assessments are in baseline history...');

  const completed = db
    .prepare(
      `SELECT a.id, a.name, a.business_context, a.business_goals, a.business_drivers, a.business_requirement,
              r.platform_recommendation, r.confidence_score
       FROM assessments a
       LEFT JOIN recommendations r ON r.assessment_id = a.id
       WHERE a.status = 'completed'
       ORDER BY a.id`
    )
    .all();

  for (const a of completed) {
    const existing = db
      .prepare(`SELECT id, snapshot_json FROM assessment_history WHERE assessment_id = ? ORDER BY id DESC LIMIT 1`)
      .get(a.id);

    let snapshot = {
      assessmentName: a.name,
      businessContext: a.business_context || '',
      businessGoal: a.business_goals || '',
      businessDriver: a.business_drivers || '',
      businessRequirement: a.business_requirement || '',
      platformScores: buildFallbackPlatformScores(a.platform_recommendation || ''),
      platformRecommendation: a.platform_recommendation || 'Unknown',
      confidenceScore: a.confidence_score || 0,
    };

    if (existing) {
      try {
        const parsed = JSON.parse(existing.snapshot_json);
        snapshot = {
          ...snapshot,
          ...parsed,
          platformScores:
            Array.isArray(parsed.platformScores) && parsed.platformScores.length > 0
              ? parsed.platformScores
              : snapshot.platformScores,
        };
      } catch {
        // Keep generated snapshot
      }

      db.prepare(`UPDATE assessment_history SET snapshot_json = ?, created_at = ? WHERE id = ?`).run(
        JSON.stringify(snapshot),
        now,
        existing.id
      );
    } else {
      db.prepare(`INSERT INTO assessment_history (assessment_id, snapshot_json, created_at) VALUES (?, ?, ?)`).run(
        a.id,
        JSON.stringify(snapshot),
        now
      );
    }
  }

  console.log(`   Baseline ready for ${completed.length} completed assessments.`);

  console.log('2) Triggering similarity endpoint to generate offline embeddings via local sentence-transformers service...');

  let embeddingMethodCount = 0;
  let scoreMethodCount = 0;
  let failed = 0;

  for (const a of completed) {
    try {
      const res = await fetch(`${baseUrl}/api/assessment/${a.id}/similar`);
      const json = await res.json();

      if (!res.ok) {
        failed++;
        console.log(`   ⚠ Assessment ${a.id}: ${json.error || res.statusText}`);
        if (res.status === 503) {
          console.log(`     Local embedding service is down or unreachable. Start local-embedding-service/app.py.`);
        }
        continue;
      }

      const methods = (json.similar || []).map((s) => s.similarityMethod);
      embeddingMethodCount += methods.filter((m) => m === 'embedding').length;
      scoreMethodCount += methods.filter((m) => m === 'score').length;

      console.log(
        `   ✓ Assessment ${a.id}: type=${json.type}, similar=${(json.similar || []).length}, methods=${methods.join(', ') || 'none'}`
      );
    } catch (error) {
      failed++;
      console.log(`   ⚠ Assessment ${a.id}: request failed (${error.message})`);
    }
  }

  const embeddingCount = db.prepare(`SELECT COUNT(*) AS count FROM assessment_embeddings`).get().count;

  console.log('\n3) Summary');
  console.log(`   assessment_embeddings rows: ${embeddingCount}`);
  console.log(`   similarity method usage -> embedding: ${embeddingMethodCount}, score: ${scoreMethodCount}, failed: ${failed}`);

  if (embeddingCount === 0) {
    console.log('\n   No embeddings were persisted. Ensure local embedding service is running at LOCAL_EMBEDDING_SERVICE_URL.');
  }

  if (scoreMethodCount > 0) {
    console.log('\n   Warning: score-based similarity was returned, but embedding-only mode is expected.');
  }

  db.close();
}

run().catch((error) => {
  console.error('Backfill failed:', error);
  db.close();
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Migrate exercises from exercises.json to Supabase
 * Run with: node scripts/migrate-exercises.js
 */

const exercises = require('../src/data/exercises.json');

const SUPABASE_URL = 'https://gwynpezohzwhueeimjao.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eW5wZXpvaHp3aHVlZWltamFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk3MTQyOCwiZXhwIjoyMDg1NTQ3NDI4fQ.udVu0wVudIec3FhEbvow3YfYhjMyzI5ukE7aF7TnuBQ';

async function migrate() {
  console.log(`Found ${exercises.exercises.length} exercises to migrate\n`);

  // First, get existing exercises to avoid duplicates
  const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/exercises?select=name`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  });
  const existing = await existingRes.json();
  const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
  console.log(`Found ${existingNames.size} existing exercises in Supabase\n`);

  let inserted = 0;
  let skipped = 0;

  for (const ex of exercises.exercises) {
    // Skip if already exists
    if (existingNames.has(ex.name.toLowerCase())) {
      console.log(`⏭️  Skipping (exists): ${ex.name}`);
      skipped++;
      continue;
    }

    // Map to Supabase schema
    const record = {
      name: ex.name,
      category: 'strength', // Default, can be updated based on tags
      muscle_group: ex.category, // chest, back, biceps, etc.
      tutorial_url: null,
      tutorial_steps: ex.tutorial ? [
        ex.tutorial.setup,
        ex.tutorial.execution,
        ...(ex.tutorial.cues || [])
      ].filter(Boolean) : null,
      // Extended fields (stored as JSONB if columns exist, otherwise ignored)
      equipment: ex.equipment || [],
      movement_pattern: ex.movementPattern || null,
      primary_muscles: ex.primaryMuscles || [],
      secondary_muscles: ex.secondaryMuscles || [],
      difficulty: ex.difficulty || 'intermediate',
      tags: ex.tags || [],
    };

    // Set category based on tags
    if (ex.tags?.includes('cardio')) record.category = 'cardio';
    else if (ex.tags?.includes('hyrox')) record.category = 'hyrox';
    else record.category = 'strength';

    const res = await fetch(`${SUPABASE_URL}/rest/v1/exercises`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (res.ok) {
      console.log(`✅ Inserted: ${ex.name}`);
      inserted++;
    } else {
      const err = await res.text();
      console.log(`❌ Failed: ${ex.name} - ${err}`);
    }
  }

  console.log(`\n✅ Done! Inserted: ${inserted}, Skipped: ${skipped}`);
}

migrate().catch(console.error);

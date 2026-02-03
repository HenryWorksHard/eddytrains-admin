const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/exercises.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Tag mapping rules
const tagRules = {
  // Hyrox-specific exercises
  hyroxExercises: [
    'rowing_machine', 'assault_bike', 'sled_push', 'burpees', 'farmers_carry',
    'kettlebell_swing', 'wall_balls', 'skierg', 'sled_pull', 'sandbag_lunges',
    'box_jumps', 'battle_ropes', 'thrusters', 'running'
  ],
  
  // Cardio exercises
  cardioExercises: [
    'rowing_machine', 'assault_bike', 'jump_rope', 'stair_climber', 
    'mountain_climbers', 'burpees', 'running', 'skierg', 'battle_ropes'
  ],
  
  // Pure strength (not good for cardio/hyrox)
  strengthOnly: [
    'barbell_bench_press', 'incline_barbell_bench', 'leg_press', 'leg_extension',
    'leg_curl', 'machine_chest_press', 'pec_deck', 'preacher_curl',
    'concentration_curl', 'tricep_pushdown', 'skull_crushers', 
    'lat_pulldown', 'seated_cable_row', 'cable_crossover'
  ]
};

// Add tags to each exercise
data.exercises = data.exercises.map(ex => {
  const tags = [];
  const id = ex.id.toLowerCase();
  
  // Check if Hyrox-specific
  if (tagRules.hyroxExercises.some(h => id.includes(h.replace(/_/g, '')) || id.includes(h))) {
    tags.push('hyrox');
  }
  
  // Check if cardio
  if (ex.category === 'cardio' || tagRules.cardioExercises.some(c => id.includes(c.replace(/_/g, '')))) {
    tags.push('cardio');
  }
  
  // Most exercises are strength
  if (ex.category !== 'cardio') {
    tags.push('strength');
  }
  
  // Hybrid = good for mixed training (compound movements, functional)
  const hybridPatterns = ['squat', 'deadlift', 'press', 'row', 'pull', 'lunge', 'carry', 'swing', 'thruster', 'clean'];
  if (hybridPatterns.some(p => id.includes(p)) || ex.category === 'fullbody') {
    tags.push('hybrid');
  }
  
  // Remove duplicates
  ex.tags = [...new Set(tags)];
  
  // Ensure at least strength tag for non-cardio
  if (ex.tags.length === 0) {
    ex.tags = ['strength'];
  }
  
  return ex;
});

// Add missing Hyrox exercises
const newExercises = [
  {
    id: "skierg",
    name: "SkiErg",
    category: "cardio",
    equipment: ["machine"],
    movementPattern: "pull_vertical",
    primaryMuscles: ["lats", "triceps", "core"],
    secondaryMuscles: ["shoulders", "legs"],
    difficulty: "beginner",
    tags: ["cardio", "hyrox", "hybrid"],
    tutorial: {
      setup: "Stand facing the SkiErg with feet shoulder-width apart. Grip handles with arms extended overhead.",
      execution: "Pull handles down in a fluid motion, hinging at hips and bending knees slightly. Drive through the pull using lats and core. Return to start with control.",
      cues: ["Engage core throughout", "Drive with lats not just arms", "Maintain rhythm"],
      commonMistakes: ["Using only arms", "Not engaging core", "Choppy motion"],
      breathingPattern: "Exhale on pull, inhale on return"
    }
  },
  {
    id: "wall_balls",
    name: "Wall Balls",
    category: "fullbody",
    equipment: ["medicineball"],
    movementPattern: "squat",
    primaryMuscles: ["quads", "glutes", "shoulders"],
    secondaryMuscles: ["core", "triceps"],
    difficulty: "intermediate",
    tags: ["hyrox", "cardio", "hybrid"],
    tutorial: {
      setup: "Stand facing wall, feet shoulder-width apart, holding medicine ball at chest height.",
      execution: "Squat down until thighs are parallel. Explosively stand and throw ball to target on wall. Catch ball and immediately descend into next rep.",
      cues: ["Full depth squat", "Explosive hip drive", "Aim for target"],
      commonMistakes: ["Shallow squat", "Using arms instead of legs", "Not catching ball properly"],
      breathingPattern: "Inhale on descent, exhale on throw"
    }
  },
  {
    id: "sled_pull",
    name: "Sled Pull",
    category: "fullbody",
    equipment: ["sled"],
    movementPattern: "pull_horizontal",
    primaryMuscles: ["back", "biceps", "legs"],
    secondaryMuscles: ["core", "grip"],
    difficulty: "intermediate",
    tags: ["hyrox", "strength", "hybrid"],
    tutorial: {
      setup: "Face the sled with rope/strap in hands. Athletic stance with knees bent.",
      execution: "Pull sled toward you using arms and legs, walking backward or standing stationary. Maintain tension throughout.",
      cues: ["Stay low", "Drive with legs", "Keep core tight"],
      commonMistakes: ["Standing too upright", "Pulling with arms only", "Losing tension"],
      breathingPattern: "Breathe rhythmically with pulls"
    }
  },
  {
    id: "sandbag_lunges",
    name: "Sandbag Lunges",
    category: "legs",
    equipment: ["sandbag"],
    movementPattern: "lunge",
    primaryMuscles: ["quads", "glutes", "hamstrings"],
    secondaryMuscles: ["core", "shoulders"],
    difficulty: "intermediate",
    tags: ["hyrox", "strength", "hybrid"],
    tutorial: {
      setup: "Hold sandbag on shoulders or bear hug position. Stand tall with feet hip-width apart.",
      execution: "Step forward into a lunge, lowering back knee toward ground. Push through front heel to return to standing. Alternate legs.",
      cues: ["Keep torso upright", "Control the descent", "Drive through front heel"],
      commonMistakes: ["Leaning forward", "Knee caving in", "Short steps"],
      breathingPattern: "Inhale on descent, exhale on drive up"
    }
  },
  {
    id: "running_treadmill",
    name: "Running (Treadmill)",
    category: "cardio",
    equipment: ["machine"],
    movementPattern: "locomotion",
    primaryMuscles: ["quads", "hamstrings", "calves"],
    secondaryMuscles: ["core", "hip_flexors"],
    difficulty: "beginner",
    tags: ["cardio", "hyrox"],
    tutorial: {
      setup: "Set treadmill to desired speed and incline. Start with warm-up pace.",
      execution: "Run with proper form - midfoot strike, arms at 90 degrees, slight forward lean.",
      cues: ["Stay relaxed", "Quick turnover", "Breathe rhythmically"],
      commonMistakes: ["Overstriding", "Heel striking", "Tensing shoulders"],
      breathingPattern: "Find a rhythm that works for your pace"
    }
  },
  {
    id: "running_outdoor",
    name: "Running (Outdoor)",
    category: "cardio",
    equipment: ["bodyweight"],
    movementPattern: "locomotion",
    primaryMuscles: ["quads", "hamstrings", "calves"],
    secondaryMuscles: ["core", "hip_flexors"],
    difficulty: "beginner",
    tags: ["cardio", "hyrox"],
    tutorial: {
      setup: "Choose appropriate terrain and route. Warm up with light jog or dynamic stretches.",
      execution: "Run with proper form - midfoot strike, arms at 90 degrees, slight forward lean.",
      cues: ["Stay relaxed", "Quick turnover", "Scan terrain ahead"],
      commonMistakes: ["Starting too fast", "Poor pacing", "Ignoring terrain"],
      breathingPattern: "Find a rhythm that works for your pace"
    }
  }
];

// Add new exercises if they don't exist
newExercises.forEach(newEx => {
  if (!data.exercises.find(e => e.id === newEx.id)) {
    data.exercises.push(newEx);
  }
});

// Add programTypes config
data.programTypes = [
  { id: "strength", label: "Strength Training", icon: "💪" },
  { id: "cardio", label: "Cardio", icon: "❤️" },
  { id: "hyrox", label: "Hyrox", icon: "🏃" },
  { id: "hybrid", label: "Hybrid", icon: "⚡" }
];

// Update version
data.lastUpdated = new Date().toISOString().split('T')[0];

// Write back
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

console.log(`Updated ${data.exercises.length} exercises with tags`);
console.log('Added programTypes config');
console.log('Sample tags:', data.exercises.slice(0, 5).map(e => ({ name: e.name, tags: e.tags })));

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Fetch all exercises with pagination (Supabase default limit is 1000)
    const allExercises: any[] = []
    let from = 0
    const pageSize = 1000
    
    while (true) {
      const { data, error: fetchError } = await supabase
        .from('exercises')
        .select('*')
        .order('name')
        .range(from, from + pageSize - 1)
      
      if (fetchError) {
        console.error('Error fetching exercises:', fetchError)
        return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
      }
      
      if (!data || data.length === 0) break
      allExercises.push(...data)
      
      if (data.length < pageSize) break
      from += pageSize
    }
    
    const exercises = allExercises

    // Transform to match the expected format
    const transformed = exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      category: ex.muscle_group || 'fullbody', // muscle_group is the body part category
      equipment: ex.equipment || [],
      movementPattern: ex.movement_pattern || 'compound',
      primaryMuscles: ex.primary_muscles || [ex.muscle_group].filter(Boolean),
      secondaryMuscles: ex.secondary_muscles || [],
      difficulty: ex.difficulty || 'intermediate',
      tags: ex.tags || ['strength'],
      tutorial: ex.tutorial_steps ? {
        steps: ex.tutorial_steps,
        url: ex.tutorial_url
      } : null
    }))

    return NextResponse.json({ exercises: transformed })
  } catch (err) {
    console.error('Error in exercises API:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

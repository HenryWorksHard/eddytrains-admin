import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Dumbbell, Users, Clock, Edit2, Trash2, Search } from 'lucide-react'

interface Program {
  id: string
  name: string
  description: string | null
  category: string
  duration_weeks: number | null
  difficulty: string
  is_active: boolean
  created_at: string
}

async function getPrograms(): Promise<Program[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('programs')
    .select('*')
    .order('created_at', { ascending: false })
  
  return (data as Program[]) || []
}

const categoryColors: Record<string, string> = {
  strength: 'from-blue-500 to-blue-600',
  cardio: 'from-green-500 to-green-600',
  hyrox: 'from-yellow-400 to-yellow-500',
  nutrition: 'from-purple-500 to-purple-600',
  recovery: 'from-pink-500 to-pink-600',
}

const difficultyBadges: Record<string, string> = {
  beginner: 'badge-success',
  intermediate: 'badge-warning',
  advanced: 'badge-error',
}

export default async function ProgramsPage() {
  const programs = await getPrograms()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Programs</h1>
          <p className="text-zinc-400 mt-1">Manage your fitness programs and workouts</p>
        </div>
        <Link
          href="/programs/new"
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Program
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="search"
          placeholder="Search programs..."
          className="w-full max-w-md pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Programs Grid */}
      {programs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program) => (
            <div key={program.id} className="card p-6 group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[program.category] || 'from-zinc-500 to-zinc-600'} flex items-center justify-center`}>
                  <Dumbbell className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/programs/${program.id}`}
                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  <button className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-semibold text-white mb-2">{program.name}</h3>
              <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                {program.description || 'No description'}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="badge badge-info capitalize">{program.category}</span>
                <span className={`badge ${difficultyBadges[program.difficulty] || 'badge-info'} capitalize`}>
                  {program.difficulty}
                </span>
                {!program.is_active && (
                  <span className="badge badge-error">Inactive</span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-zinc-500">
                {program.duration_weeks && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {program.duration_weeks} weeks
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  0 enrolled
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No programs yet</h3>
          <p className="text-zinc-400 mb-6">Create your first fitness program to get started</p>
          <Link
            href="/programs/new"
            className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Your First Program
          </Link>
        </div>
      )}
    </div>
  )
}

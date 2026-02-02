'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Apple, Plus, Search, Users, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface NutritionPlan {
  id: string
  name: string
  description: string | null
  calories: number
  protein: number
  carbs: number
  fats: number
  is_template: boolean
  created_at: string
}

export default function NutritionPage() {
  const [plans, setPlans] = useState<NutritionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('nutrition_plans')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPlans(data)
    }
    setLoading(false)
  }

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const deletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this nutrition plan?')) return
    
    const { error } = await supabase
      .from('nutrition_plans')
      .delete()
      .eq('id', id)

    if (!error) {
      setPlans(plans.filter(p => p.id !== id))
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Nutrition</h1>
          <p className="text-zinc-400 mt-1">Manage nutrition plans and assign to clients</p>
        </div>
        <Link
          href="/nutrition/new"
          className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Plan
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search nutrition plans..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50"
        />
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800">
          <Apple className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No nutrition plans yet</h3>
          <p className="text-zinc-400 mb-4">Create your first nutrition plan to get started</p>
          <Link
            href="/nutrition/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Plan
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Apple className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-zinc-400 text-sm mt-1">{plan.description}</p>
                    )}
                    <div className="flex gap-4 mt-3">
                      <div className="text-sm">
                        <span className="text-zinc-500">Calories:</span>{' '}
                        <span className="text-white font-medium">{plan.calories}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-zinc-500">P:</span>{' '}
                        <span className="text-blue-400 font-medium">{plan.protein}g</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-zinc-500">C:</span>{' '}
                        <span className="text-yellow-400 font-medium">{plan.carbs}g</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-zinc-500">F:</span>{' '}
                        <span className="text-red-400 font-medium">{plan.fats}g</span>
                      </div>
                    </div>
                    {plan.is_template && (
                      <span className="inline-block mt-2 px-2 py-1 bg-purple-500/10 text-purple-400 text-xs font-medium rounded-lg">
                        Template
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/nutrition/${plan.id}`}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Edit className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

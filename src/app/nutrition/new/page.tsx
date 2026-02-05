'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import BMRCalculator from '@/components/BMRCalculator'

export default function NewNutritionPlanPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [plan, setPlan] = useState({
    name: '',
    description: '',
    calories: 2000,
    protein: 150,
    carbs: 200,
    fats: 70,
    is_template: true,
  })

  // Fetch user's organization_id on mount
  useEffect(() => {
    const fetchOrgId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        if (profile?.organization_id) {
          setOrganizationId(profile.organization_id)
        }
      }
    }
    fetchOrgId()
  }, [supabase])

  const handleSave = async () => {
    if (!plan.name.trim()) {
      alert('Please enter a plan name')
      return
    }

    if (!organizationId) {
      alert('Unable to determine organization. Please try again.')
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('nutrition_plans')
      .insert({ ...plan, organization_id: organizationId })
      .select()
      .single()

    if (error) {
      console.error('Error creating plan:', error)
      alert('Failed to create plan')
      setSaving(false)
      return
    }

    router.push('/nutrition')
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/nutrition"
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">New Nutrition Plan</h1>
          <p className="text-zinc-400 mt-1">Create a new nutrition plan template</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Plan Name</label>
          <input
            type="text"
            value={plan.name}
            onChange={(e) => setPlan({ ...plan, name: e.target.value })}
            placeholder="e.g., Muscle Building, Fat Loss, Maintenance"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Description</label>
          <textarea
            value={plan.description}
            onChange={(e) => setPlan({ ...plan, description: e.target.value })}
            placeholder="Brief description of this nutrition plan..."
            rows={2}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 resize-none"
          />
        </div>

        {/* BMR Calculator */}
        <BMRCalculator
          onApply={(result) => {
            setPlan({
              ...plan,
              calories: result.tdee,
              protein: result.protein,
              carbs: result.carbs,
              fats: result.fats,
            })
          }}
        />

        {/* Macros */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-4">Daily Targets</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Calories</label>
              <input
                type="number"
                value={plan.calories}
                onChange={(e) => setPlan({ ...plan, calories: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-yellow-400/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Protein (g)</label>
              <input
                type="number"
                value={plan.protein}
                onChange={(e) => setPlan({ ...plan, protein: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-400/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Carbs (g)</label>
              <input
                type="number"
                value={plan.carbs}
                onChange={(e) => setPlan({ ...plan, carbs: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-yellow-400/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Fats (g)</label>
              <input
                type="number"
                value={plan.fats}
                onChange={(e) => setPlan({ ...plan, fats: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-400/50"
              />
            </div>
          </div>
          <div className="mt-4 p-4 bg-zinc-800 rounded-xl">
            <div className="text-sm text-zinc-400">
              Calculated: <span className="text-white font-medium">{plan.protein * 4 + plan.carbs * 4 + plan.fats * 9} cal</span> from macros
              {Math.abs((plan.protein * 4 + plan.carbs * 4 + plan.fats * 9) - plan.calories) > 50 && (
                <span className="text-yellow-400 ml-2">(differs from target by {Math.abs((plan.protein * 4 + plan.carbs * 4 + plan.fats * 9) - plan.calories)} cal)</span>
              )}
            </div>
          </div>
        </div>

        {/* Template Toggle */}
        <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-xl">
          <div>
            <div className="text-white font-medium">Save as Template</div>
            <div className="text-sm text-zinc-400">Templates can be assigned to multiple clients</div>
          </div>
          <button
            onClick={() => setPlan({ ...plan, is_template: !plan.is_template })}
            className={`w-12 h-6 rounded-full transition-colors ${
              plan.is_template ? 'bg-yellow-400' : 'bg-zinc-600'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
              plan.is_template ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Creating...' : 'Create Plan'}
      </button>
    </div>
  )
}

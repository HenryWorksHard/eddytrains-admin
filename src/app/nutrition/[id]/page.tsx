'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import BMRCalculator from '@/components/BMRCalculator'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditNutritionPlanPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [plan, setPlan] = useState({
    name: '',
    description: '',
    calories: 2000,
    protein: 150,
    carbs: 200,
    fats: 70,
    is_template: true,
  })

  useEffect(() => {
    const fetchPlan = async () => {
      const { data, error } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        console.error('Error fetching plan:', error)
        router.push('/nutrition')
        return
      }

      setPlan({
        name: data.name || '',
        description: data.description || '',
        calories: data.calories || 2000,
        protein: data.protein || 150,
        carbs: data.carbs || 200,
        fats: data.fats || 70,
        is_template: data.is_template ?? true,
      })
      setLoading(false)
    }

    fetchPlan()
  }, [id, router, supabase])

  const handleSave = async () => {
    if (!plan.name.trim()) {
      alert('Please enter a plan name')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('nutrition_plans')
      .update(plan)
      .eq('id', id)

    if (error) {
      console.error('Error updating plan:', error)
      alert('Failed to update plan')
      setSaving(false)
      return
    }

    router.push('/nutrition')
  }

  const handleDelete = async () => {
    setDeleting(true)
    
    // First check if plan is assigned to any clients
    const { data: assignments } = await supabase
      .from('client_nutrition')
      .select('id')
      .eq('plan_id', id)
      .eq('is_active', true)
      .limit(1)

    if (assignments && assignments.length > 0) {
      alert('Cannot delete plan - it is currently assigned to one or more clients. Remove the assignments first.')
      setDeleting(false)
      setShowDeleteConfirm(false)
      return
    }

    const { error } = await supabase
      .from('nutrition_plans')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan')
      setDeleting(false)
      return
    }

    router.push('/nutrition')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/nutrition"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Edit Nutrition Plan</h1>
            <p className="text-zinc-400 mt-1">Update nutrition plan settings</p>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Delete plan"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-2">Delete Nutrition Plan?</h3>
            <p className="text-zinc-400 mb-6">
              This action cannot be undone. The plan will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}

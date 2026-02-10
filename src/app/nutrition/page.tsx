'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Apple, Search, User, Edit2, Save, Loader2, Plus, Trash2 } from 'lucide-react'

interface Client {
  id: string
  full_name: string | null
  email: string
  profile_picture_url: string | null
}

interface NutritionPlan {
  id: string
  client_id: string
  plan_id: string | null
  plan_name: string | null
  calories: number
  protein: number
  carbs: number
  fats: number
  notes: string | null
  created_by_type: 'trainer' | 'client'
}

interface NutritionTemplate {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

export default function NutritionPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [nutrition, setNutrition] = useState<NutritionPlan | null>(null)
  const [templates, setTemplates] = useState<NutritionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingNutrition, setLoadingNutrition] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  
  // Editable fields
  const [editCalories, setEditCalories] = useState(0)
  const [editProtein, setEditProtein] = useState(0)
  const [editCarbs, setEditCarbs] = useState(0)
  const [editFats, setEditFats] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  
  const supabase = createClient()

  useEffect(() => {
    fetchClients()
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      fetchClientNutrition(selectedClientId)
    } else {
      setNutrition(null)
    }
  }, [selectedClientId])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_picture_url')
      .eq('organization_id', profile.organization_id)
      .eq('role', 'client')
      .order('full_name')

    if (data) setClients(data)
    setLoading(false)
  }

  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) return

    const { data } = await supabase
      .from('nutrition_plans')
      .select('id, name, calories, protein, carbs, fats')
      .eq('organization_id', profile.organization_id)
      .eq('is_template', true)

    if (data) setTemplates(data)
  }

  const fetchClientNutrition = async (clientId: string) => {
    setLoadingNutrition(true)
    
    const { data } = await supabase
      .from('client_nutrition')
      .select(`
        id,
        client_id,
        plan_id,
        calories,
        protein,
        carbs,
        fats,
        notes,
        created_by_type,
        nutrition_plans(name)
      `)
      .eq('client_id', clientId)
      .single()

    if (data) {
      const plan: NutritionPlan = {
        id: data.id,
        client_id: data.client_id,
        plan_id: data.plan_id,
        plan_name: (data.nutrition_plans as any)?.name || null,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        notes: data.notes,
        created_by_type: data.created_by_type
      }
      setNutrition(plan)
      setEditCalories(plan.calories)
      setEditProtein(plan.protein)
      setEditCarbs(plan.carbs)
      setEditFats(plan.fats)
      setEditNotes(plan.notes || '')
    } else {
      setNutrition(null)
    }
    
    setLoadingNutrition(false)
  }

  const startEditing = () => {
    if (nutrition) {
      setEditCalories(nutrition.calories)
      setEditProtein(nutrition.protein)
      setEditCarbs(nutrition.carbs)
      setEditFats(nutrition.fats)
      setEditNotes(nutrition.notes || '')
    }
    setEditing(true)
  }

  const saveNutrition = async () => {
    if (!selectedClientId) return
    setSaving(true)

    const nutritionData = {
      client_id: selectedClientId,
      calories: editCalories,
      protein: editProtein,
      carbs: editCarbs,
      fats: editFats,
      notes: editNotes || null,
      created_by_type: 'trainer' as const,
      updated_at: new Date().toISOString()
    }

    if (nutrition?.id) {
      // Update existing
      await supabase
        .from('client_nutrition')
        .update(nutritionData)
        .eq('id', nutrition.id)
    } else {
      // Insert new
      await supabase
        .from('client_nutrition')
        .insert(nutritionData)
    }

    await fetchClientNutrition(selectedClientId)
    setEditing(false)
    setSaving(false)
  }

  const assignTemplate = async () => {
    if (!selectedClientId || !selectedTemplate) return
    setSaving(true)

    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return

    const nutritionData = {
      client_id: selectedClientId,
      plan_id: template.id,
      calories: template.calories,
      protein: template.protein,
      carbs: template.carbs,
      fats: template.fats,
      created_by_type: 'trainer' as const,
      updated_at: new Date().toISOString()
    }

    if (nutrition?.id) {
      await supabase
        .from('client_nutrition')
        .update(nutritionData)
        .eq('id', nutrition.id)
    } else {
      await supabase
        .from('client_nutrition')
        .insert(nutritionData)
    }

    await fetchClientNutrition(selectedClientId)
    setShowAssignModal(false)
    setSelectedTemplate('')
    setSaving(false)
  }

  const removeNutrition = async () => {
    if (!nutrition?.id) return
    
    await supabase
      .from('client_nutrition')
      .delete()
      .eq('id', nutrition.id)
    
    setNutrition(null)
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-green-500/10 rounded-xl">
          <Apple className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Nutrition</h1>
          <p className="text-zinc-500">Manage client nutrition plans</p>
        </div>
      </div>

      {/* Client Selector */}
      <div className="card p-6 mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Select Client
        </label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">Choose a client...</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.full_name || client.email}
            </option>
          ))}
        </select>
      </div>

      {/* Nutrition Display/Edit */}
      {selectedClientId && (
        <div className="card p-6">
          {loadingNutrition ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-400" />
            </div>
          ) : nutrition ? (
            <>
              {/* Header with actions */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedClient?.full_name || 'Client'}'s Nutrition
                  </h2>
                  {nutrition.plan_name && (
                    <p className="text-sm text-zinc-500">Based on: {nutrition.plan_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button
                        onClick={saveNutrition}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={startEditing}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={removeNutrition}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Macros */}
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-500 mb-1">Calories</label>
                    <input
                      type="number"
                      value={editCalories}
                      onChange={(e) => setEditCalories(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-500 mb-1">Protein (g)</label>
                    <input
                      type="number"
                      value={editProtein}
                      onChange={(e) => setEditProtein(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-500 mb-1">Carbs (g)</label>
                    <input
                      type="number"
                      value={editCarbs}
                      onChange={(e) => setEditCarbs(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-500 mb-1">Fats (g)</label>
                    <input
                      type="number"
                      value={editFats}
                      onChange={(e) => setEditFats(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-zinc-500 mb-1">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-400">{nutrition.calories}</p>
                      <p className="text-sm text-zinc-500">Calories</p>
                    </div>
                    <div className="bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-blue-400">{nutrition.protein}g</p>
                      <p className="text-sm text-zinc-500">Protein</p>
                    </div>
                    <div className="bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-yellow-400">{nutrition.carbs}g</p>
                      <p className="text-sm text-zinc-500">Carbs</p>
                    </div>
                    <div className="bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-orange-400">{nutrition.fats}g</p>
                      <p className="text-sm text-zinc-500">Fats</p>
                    </div>
                  </div>
                  {nutrition.notes && (
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <p className="text-sm text-zinc-400">{nutrition.notes}</p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* No nutrition assigned */
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Apple className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No Nutrition Plan</h3>
              <p className="text-zinc-500 mb-4">
                {selectedClient?.full_name || 'This client'} doesn't have a nutrition plan yet.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Assign Template
                </button>
                <button
                  onClick={() => {
                    setEditCalories(2000)
                    setEditProtein(150)
                    setEditCarbs(200)
                    setEditFats(70)
                    setEditNotes('')
                    setEditing(true)
                    setNutrition({ id: '', client_id: selectedClientId, plan_id: null, plan_name: null, calories: 0, protein: 0, carbs: 0, fats: 0, notes: null, created_by_type: 'trainer' })
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Create Custom
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No client selected state */}
      {!selectedClientId && !loading && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Select a Client</h3>
          <p className="text-zinc-500">Choose a client from the dropdown above to view or edit their nutrition plan.</p>
        </div>
      )}

      {/* Assign Template Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white">Assign Nutrition Template</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Select Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="">Choose a template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.calories} kcal)
                  </option>
                ))}
              </select>
              
              {selectedTemplate && (
                <div className="mt-4 p-4 bg-zinc-800 rounded-xl">
                  {(() => {
                    const t = templates.find(t => t.id === selectedTemplate)
                    if (!t) return null
                    return (
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <div>
                          <p className="font-bold text-green-400">{t.calories}</p>
                          <p className="text-zinc-500">kcal</p>
                        </div>
                        <div>
                          <p className="font-bold text-blue-400">{t.protein}g</p>
                          <p className="text-zinc-500">protein</p>
                        </div>
                        <div>
                          <p className="font-bold text-yellow-400">{t.carbs}g</p>
                          <p className="text-zinc-500">carbs</p>
                        </div>
                        <div>
                          <p className="font-bold text-orange-400">{t.fats}g</p>
                          <p className="text-zinc-500">fats</p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-zinc-800">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedTemplate('')
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={assignTemplate}
                disabled={!selectedTemplate || saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-medium rounded-xl transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

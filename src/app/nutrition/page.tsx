'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Apple, Search, User, ChevronRight, Check, X } from 'lucide-react'
import Link from 'next/link'

interface ClientNutrition {
  id: string
  full_name: string | null
  email: string
  profile_picture_url: string | null
  nutrition: {
    calories: number
    protein: number
    carbs: number
    fats: number
    plan_name?: string
  } | null
}

export default function NutritionPage() {
  const [clients, setClients] = useState<ClientNutrition[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    // Get current trainer
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Get trainer's profile to find their org
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      setLoading(false)
      return
    }

    // Get all clients in this organization
    const { data: clientsData } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_picture_url')
      .eq('organization_id', profile.organization_id)
      .eq('role', 'client')
      .order('full_name')

    if (!clientsData) {
      setLoading(false)
      return
    }

    // Get nutrition data for each client
    const clientIds = clientsData.map(c => c.id)
    
    const { data: nutritionData } = await supabase
      .from('client_nutrition')
      .select(`
        client_id,
        calories,
        protein,
        carbs,
        fats,
        nutrition_plans(name)
      `)
      .in('client_id', clientIds)

    // Map nutrition to clients
    const nutritionMap = new Map(
      nutritionData?.map(n => [n.client_id, {
        calories: n.calories,
        protein: n.protein,
        carbs: n.carbs,
        fats: n.fats,
        plan_name: (n.nutrition_plans as any)?.name
      }]) || []
    )

    const clientsWithNutrition: ClientNutrition[] = clientsData.map(client => ({
      ...client,
      nutrition: nutritionMap.get(client.id) || null
    }))

    setClients(clientsWithNutrition)
    setLoading(false)
  }

  const filteredClients = clients.filter(client =>
    (client.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const clientsWithPlan = clients.filter(c => c.nutrition).length
  const clientsWithoutPlan = clients.filter(c => !c.nutrition).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-500/10 rounded-xl">
            <Apple className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Nutrition</h1>
            <p className="text-zinc-500">Manage client nutrition plans</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{clients.length}</p>
          <p className="text-sm text-zinc-500">Total Clients</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-400">{clientsWithPlan}</p>
          <p className="text-sm text-zinc-500">With Plan</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-orange-400">{clientsWithoutPlan}</p>
          <p className="text-sm text-zinc-500">No Plan</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No clients found</h3>
          <p className="text-zinc-500">
            {searchQuery ? 'Try a different search term' : 'Add clients to manage their nutrition'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredClients.map((client) => (
            <Link
              key={client.id}
              href={`/users/${client.id}?tab=nutrition`}
              className="card p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                {client.profile_picture_url ? (
                  <img
                    src={client.profile_picture_url}
                    alt={client.full_name || 'Client'}
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <User className="w-6 h-6 text-zinc-600" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{client.full_name || 'Unnamed'}</p>
                  <p className="text-sm text-zinc-500">{client.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {client.nutrition ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        {client.nutrition.calories} kcal
                      </p>
                      <p className="text-xs text-zinc-500">
                        P: {client.nutrition.protein}g • C: {client.nutrition.carbs}g • F: {client.nutrition.fats}g
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-orange-400">No plan assigned</span>
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <X className="w-4 h-4 text-orange-400" />
                    </div>
                  </div>
                )}
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

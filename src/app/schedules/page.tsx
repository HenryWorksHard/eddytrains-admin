'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Calendar, User, ChevronDown, Plus, GripVertical, Trash2, 
  Clock, ChevronRight, AlertCircle, Check, Loader2 
} from 'lucide-react'

interface Client {
  id: string
  full_name: string
  email: string
}

interface Program {
  id: string
  name: string
  category: string
  difficulty: string
  duration_weeks: number | null
}

interface ClientProgram {
  id: string
  client_id: string
  program_id: string
  program?: Program
  start_date: string
  end_date: string | null
  duration_weeks: number
  is_active: boolean
  order_index: number
  notes: string | null
}

const categoryColors: Record<string, string> = {
  strength: 'bg-blue-500',
  cardio: 'bg-green-500',
  hyrox: 'bg-yellow-500',
  hybrid: 'bg-purple-500',
  nutrition: 'bg-pink-500',
  recovery: 'bg-cyan-500',
}

export default function SchedulesPage() {
  const supabase = createClient()

  const [clients, setClients] = useState<Client[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  // Load clients and programs on mount
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load client programs when client is selected
  useEffect(() => {
    if (selectedClient) {
      loadClientPrograms(selectedClient.id)
    } else {
      setClientPrograms([])
    }
  }, [selectedClient])

  const loadInitialData = async () => {
    try {
      const [clientsRes, programsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
        supabase.from('programs').select('id, name, category, difficulty, duration_weeks').eq('is_active', true).order('name')
      ])

      setClients(clientsRes.data || [])
      setPrograms(programsRes.data || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadClientPrograms = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_programs')
        .select(`
          *,
          program:programs (id, name, category, difficulty, duration_weeks)
        `)
        .eq('client_id', clientId)
        .order('start_date', { ascending: true })

      if (error) throw error

      // Calculate end dates and set order
      const programsWithDates = (data || []).map((cp, index) => ({
        ...cp,
        duration_weeks: cp.duration_weeks || cp.program?.duration_weeks || 4,
        order_index: index,
        end_date: cp.end_date || calculateEndDate(cp.start_date, cp.duration_weeks || cp.program?.duration_weeks || 4)
      }))

      setClientPrograms(programsWithDates)
    } catch (err) {
      console.error('Error loading client programs:', err)
    }
  }

  const calculateEndDate = (startDate: string, weeks: number): string => {
    const start = new Date(startDate)
    start.setDate(start.getDate() + (weeks * 7))
    return start.toISOString().split('T')[0]
  }

  const getNextStartDate = (): string => {
    if (clientPrograms.length === 0) {
      return new Date().toISOString().split('T')[0]
    }
    const lastProgram = clientPrograms[clientPrograms.length - 1]
    const endDate = lastProgram.end_date || calculateEndDate(lastProgram.start_date, lastProgram.duration_weeks)
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    return nextDay.toISOString().split('T')[0]
  }

  const addProgram = async (programId: string, durationWeeks: number) => {
    if (!selectedClient) return

    setSaving(true)
    try {
      const startDate = getNextStartDate()
      const endDate = calculateEndDate(startDate, durationWeeks)

      const { data, error } = await supabase
        .from('client_programs')
        .insert({
          client_id: selectedClient.id,
          program_id: programId,
          start_date: startDate,
          end_date: endDate,
          duration_weeks: durationWeeks,
          is_active: clientPrograms.length === 0, // First program is active
          current_week: 1,
        })
        .select(`
          *,
          program:programs (id, name, category, difficulty, duration_weeks)
        `)
        .single()

      if (error) throw error

      setClientPrograms([...clientPrograms, { ...data, order_index: clientPrograms.length }])
      setShowAddModal(false)
    } catch (err) {
      console.error('Error adding program:', err)
    } finally {
      setSaving(false)
    }
  }

  const removeProgram = async (programId: string) => {
    if (!confirm('Remove this program from the schedule?')) return

    setSaving(true)
    try {
      await supabase.from('client_programs').delete().eq('id', programId)
      setClientPrograms(clientPrograms.filter(cp => cp.id !== programId))
      // Recalculate dates for remaining programs
      await recalculateDates(clientPrograms.filter(cp => cp.id !== programId))
    } catch (err) {
      console.error('Error removing program:', err)
    } finally {
      setSaving(false)
    }
  }

  const updateDuration = async (programId: string, newDuration: number) => {
    setSaving(true)
    try {
      const programIndex = clientPrograms.findIndex(cp => cp.id === programId)
      if (programIndex === -1) return

      const program = clientPrograms[programIndex]
      const newEndDate = calculateEndDate(program.start_date, newDuration)

      await supabase
        .from('client_programs')
        .update({ duration_weeks: newDuration, end_date: newEndDate })
        .eq('id', programId)

      // Update local state and recalculate subsequent dates
      const updated = [...clientPrograms]
      updated[programIndex] = { ...program, duration_weeks: newDuration, end_date: newEndDate }
      
      // Recalculate start dates for subsequent programs
      for (let i = programIndex + 1; i < updated.length; i++) {
        const prevEndDate = updated[i - 1].end_date!
        const newStartDate = new Date(prevEndDate)
        newStartDate.setDate(newStartDate.getDate() + 1)
        const startDateStr = newStartDate.toISOString().split('T')[0]
        const endDateStr = calculateEndDate(startDateStr, updated[i].duration_weeks)
        
        updated[i] = { ...updated[i], start_date: startDateStr, end_date: endDateStr }
        
        await supabase
          .from('client_programs')
          .update({ start_date: startDateStr, end_date: endDateStr })
          .eq('id', updated[i].id)
      }

      setClientPrograms(updated)
    } catch (err) {
      console.error('Error updating duration:', err)
    } finally {
      setSaving(false)
    }
  }

  const recalculateDates = async (programs: ClientProgram[]) => {
    let currentDate = programs.length > 0 ? programs[0].start_date : new Date().toISOString().split('T')[0]
    
    for (let i = 0; i < programs.length; i++) {
      const endDate = calculateEndDate(currentDate, programs[i].duration_weeks)
      programs[i] = { ...programs[i], start_date: currentDate, end_date: endDate }
      
      await supabase
        .from('client_programs')
        .update({ start_date: currentDate, end_date: endDate })
        .eq('id', programs[i].id)

      const nextDay = new Date(endDate)
      nextDay.setDate(nextDay.getDate() + 1)
      currentDate = nextDay.toISOString().split('T')[0]
    }

    setClientPrograms(programs)
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetId) {
      setDraggedItem(null)
      return
    }

    const draggedIndex = clientPrograms.findIndex(cp => cp.id === draggedItem)
    const targetIndex = clientPrograms.findIndex(cp => cp.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reorder the array
    const newPrograms = [...clientPrograms]
    const [removed] = newPrograms.splice(draggedIndex, 1)
    newPrograms.splice(targetIndex, 0, removed)

    // Recalculate all dates based on new order
    await recalculateDates(newPrograms)
    setDraggedItem(null)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    })
  }

  const isCurrentProgram = (program: ClientProgram) => {
    const today = new Date().toISOString().split('T')[0]
    return program.start_date <= today && (!program.end_date || program.end_date >= today)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Program Scheduler</h1>
        <p className="text-zinc-400 mt-1">Schedule and manage client training programs</p>
      </div>

      {/* Client Selector */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-zinc-400 mb-3">Select Client</label>
        <div className="relative max-w-md">
          <select
            value={selectedClient?.id || ''}
            onChange={(e) => {
              const client = clients.find(c => c.id === e.target.value)
              setSelectedClient(client || null)
            }}
            className="w-full appearance-none px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
          >
            <option value="">Choose a client...</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.full_name || client.email}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* Program Timeline */}
      {selectedClient && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center">
                <User className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedClient.full_name || 'Client'}</h2>
                <p className="text-sm text-zinc-500">{selectedClient.email}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Program
            </button>
          </div>

          {clientPrograms.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
              <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">No programs scheduled</h3>
              <p className="text-zinc-500 text-sm mb-4">Add a program to start building this client's schedule</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Program
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {clientPrograms.map((cp, index) => {
                const isCurrent = isCurrentProgram(cp)
                const isPast = cp.end_date && cp.end_date < new Date().toISOString().split('T')[0]
                
                return (
                  <div
                    key={cp.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, cp.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, cp.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-move ${
                      draggedItem === cp.id 
                        ? 'opacity-50 border-yellow-400' 
                        : isCurrent 
                          ? 'bg-yellow-400/10 border-yellow-400/30' 
                          : isPast
                            ? 'bg-zinc-800/30 border-zinc-800 opacity-60'
                            : 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-zinc-600 cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    {/* Order number */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCurrent ? 'bg-yellow-400 text-black' : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Program info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                          {cp.program?.name || 'Unknown Program'}
                        </h3>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded-full">
                            CURRENT
                          </span>
                        )}
                        {isPast && (
                          <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs font-medium rounded-full">
                            COMPLETED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(cp.start_date)} → {cp.end_date ? formatDate(cp.end_date) : '...'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                          categoryColors[cp.program?.category || 'strength']
                        } bg-opacity-20 text-white`}>
                          {cp.program?.category}
                        </span>
                      </div>
                    </div>

                    {/* Duration selector */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <select
                        value={cp.duration_weeks}
                        onChange={(e) => updateDuration(cp.id, parseInt(e.target.value))}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(w => (
                          <option key={w} value={w}>{w} week{w !== 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeProgram(cp.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}

              {/* Timeline summary */}
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Total scheduled:</span>
                  <span className="text-white font-medium">
                    {clientPrograms.reduce((sum, cp) => sum + cp.duration_weeks, 0)} weeks
                    ({clientPrograms.length} program{clientPrograms.length !== 1 ? 's' : ''})
                  </span>
                </div>
                {clientPrograms.length > 0 && clientPrograms[clientPrograms.length - 1].end_date && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-zinc-500">Schedule ends:</span>
                    <span className="text-white font-medium">
                      {formatDate(clientPrograms[clientPrograms.length - 1].end_date!)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Program Modal */}
      {showAddModal && (
        <AddProgramModal
          programs={programs}
          onAdd={addProgram}
          onClose={() => setShowAddModal(false)}
          saving={saving}
          nextStartDate={getNextStartDate()}
        />
      )}
    </div>
  )
}

// Add Program Modal Component
function AddProgramModal({ 
  programs, 
  onAdd, 
  onClose, 
  saving,
  nextStartDate 
}: { 
  programs: Program[]
  onAdd: (programId: string, duration: number) => void
  onClose: () => void
  saving: boolean
  nextStartDate: string
}) {
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [duration, setDuration] = useState<number>(4)

  const program = programs.find(p => p.id === selectedProgram)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Add Program to Schedule</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Starting {new Date(nextStartDate).toLocaleDateString('en-AU', { 
              weekday: 'long',
              day: 'numeric', 
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Program selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Select Program</label>
            <div className="relative">
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value)
                  const p = programs.find(pr => pr.id === e.target.value)
                  if (p?.duration_weeks) setDuration(p.duration_weeks)
                }}
                className="w-full appearance-none px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                <option value="">Choose a program...</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Duration</label>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 6, 8].map(w => (
                <button
                  key={w}
                  onClick={() => setDuration(w)}
                  className={`py-2 rounded-lg font-medium transition-colors ${
                    duration === w
                      ? 'bg-yellow-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {w}wk
                </button>
              ))}
            </div>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 4)}
              min="1"
              max="52"
              className="mt-3 w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="Custom weeks"
            />
          </div>

          {/* Preview */}
          {selectedProgram && (
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <p className="text-sm text-zinc-400 mb-2">Preview:</p>
              <p className="text-white font-medium">{program?.name}</p>
              <p className="text-sm text-zinc-500">
                {new Date(nextStartDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                {' → '}
                {new Date(new Date(nextStartDate).getTime() + (duration * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' '}({duration} weeks)
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onAdd(selectedProgram, duration)}
            disabled={!selectedProgram || saving}
            className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Add to Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

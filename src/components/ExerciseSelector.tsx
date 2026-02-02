'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Dumbbell, ChevronDown } from 'lucide-react'
import exercisesData from '@/data/exercises.json'

interface Exercise {
  id: string
  name: string
  category: string
  equipment: string[]
  movementPattern: string
  primaryMuscles: string[]
  difficulty: string
}

interface ExerciseSelectorProps {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

const categoryColors: Record<string, string> = {
  chest: 'bg-red-500/20 text-red-400 border-red-500/30',
  back: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  shoulders: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  biceps: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  triceps: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  legs: 'bg-green-500/20 text-green-400 border-green-500/30',
  glutes: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  core: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  fullbody: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  cardio: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

export default function ExerciseSelector({ onSelect, onClose }: ExerciseSelectorProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const exercises = exercisesData.exercises as Exercise[]
  const categories = exercisesData.categories
  const equipment = exercisesData.equipment

  useEffect(() => {
    searchRef.current?.focus()
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.primaryMuscles.some(m => m.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = !selectedCategory || ex.category === selectedCategory
    const matchesEquipment = !selectedEquipment || ex.equipment.includes(selectedEquipment)
    return matchesSearch && matchesCategory && matchesEquipment
  })

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Select Exercise</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="w-full appearance-none px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>

            <div className="relative flex-1">
              <select
                value={selectedEquipment || ''}
                onChange={(e) => setSelectedEquipment(e.target.value || null)}
                className="w-full appearance-none px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                <option value="">All Equipment</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredExercises.length > 0 ? (
            <div className="space-y-2">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => onSelect(exercise)}
                  className="w-full flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-6 h-6 text-zinc-400 group-hover:text-yellow-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-yellow-400 transition-colors">
                      {exercise.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[exercise.category] || 'bg-zinc-700 text-zinc-400'}`}>
                        {exercise.category}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {exercise.primaryMuscles.slice(0, 2).join(', ')}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-600 capitalize">{exercise.difficulty}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Dumbbell className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No exercises found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 text-center">
          <span className="text-sm text-zinc-500">
            {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''} available
          </span>
        </div>
      </div>
    </div>
  )
}

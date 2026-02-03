'use client'

import { useEffect, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface WorkoutSchedule {
  dayOfWeek: number
  workoutId: string
  workoutName: string
  programName: string
}

interface UserScheduleProps {
  userId: string
}

export default function UserSchedule({ userId }: UserScheduleProps) {
  const [loading, setLoading] = useState(true)
  const [scheduleByDay, setScheduleByDay] = useState<Record<number, WorkoutSchedule>>({})
  const [completionsByDate, setCompletionsByDate] = useState<Record<string, string>>({})
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const today = new Date()
  
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  useEffect(() => {
    fetchScheduleData()
  }, [userId])

  const fetchScheduleData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}/schedule`)
      const { scheduleByDay: schedule, completionsByDate: completions, error } = await response.json()
      
      if (error) throw new Error(error)
      
      setScheduleByDay(schedule || {})
      setCompletionsByDate(completions || {})
    } catch (err) {
      console.error('Failed to fetch schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get status for a specific date
  const getDateStatus = (date: Date): 'completed' | 'skipped' | 'upcoming' | 'rest' => {
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()
    const hasWorkout = scheduleByDay[dayOfWeek]
    
    if (!hasWorkout) return 'rest'
    
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    
    if (completionsByDate[dateStr]) {
      return 'completed'
    }
    
    if (dateStart < todayStart) {
      return 'skipped'
    }
    
    return 'upcoming'
  }

  // Get week dates
  const getWeekDates = () => {
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days: (Date | null)[] = []
    
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'skipped': return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'upcoming': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      default: return 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'skipped': return 'bg-red-500'
      case 'upcoming': return 'bg-yellow-500'
      default: return 'bg-zinc-700'
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
        </div>
      </div>
    )
  }

  const weekDates = getWeekDates()
  const calendarDays = getCalendarDays()
  const hasSchedule = Object.keys(scheduleByDay).length > 0

  if (!hasSchedule) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Training Schedule</h2>
        </div>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No active program with scheduled workouts</p>
          <p className="text-zinc-500 text-sm mt-1">Assign a program with day-of-week scheduling to see the calendar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-5 h-5 text-yellow-400" />
        <h2 className="text-lg font-semibold text-white">Training Schedule</h2>
      </div>

      {/* Weekly View */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">This Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, idx) => {
            const isToday = date.toDateString() === today.toDateString()
            const dayOfWeek = date.getDay()
            const workout = scheduleByDay[dayOfWeek]
            const status = getDateStatus(date)
            
            return (
              <div 
                key={idx}
                className={`rounded-xl border p-3 text-center transition-all ${
                  workout
                    ? getStatusColor(status)
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="text-xs text-zinc-500 mb-1">{daysOfWeek[dayOfWeek]}</div>
                <div className={`text-lg font-bold ${workout ? 'text-white' : 'text-zinc-600'}`}>
                  {date.getDate()}
                </div>
                {/* Today indicator - white dot */}
                {isToday && (
                  <div className="w-2 h-2 rounded-full mx-auto mt-1 bg-white" />
                )}
                {/* Status dot for workout days (not today) */}
                {workout && !isToday && (
                  <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${getStatusDot(status)}`} />
                )}
                {workout && (
                  <div className="text-[10px] text-zinc-400 mt-1 truncate" title={workout.workoutName}>
                    {workout.workoutName.length > 8 ? workout.workoutName.slice(0, 8) + '...' : workout.workoutName}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly Calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map(day => (
              <div key={day} className="text-center text-zinc-500 text-xs font-medium py-1">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="aspect-square" />
              }
              
              const isToday = date.toDateString() === today.toDateString()
              const status = getDateStatus(date)
              const hasWorkout = scheduleByDay[date.getDay()]
              
              return (
                <div
                  key={date.toISOString()}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${
                    hasWorkout
                      ? getStatusColor(status)
                      : 'text-zinc-600'
                  } ${hasWorkout ? 'border' : ''} ${isToday ? 'font-bold' : ''}`}
                >
                  <span className={isToday && !hasWorkout ? 'text-white' : ''}>{date.getDate()}</span>
                  {/* Today indicator - white dot */}
                  {isToday && (
                    <div className="w-1 h-1 rounded-full mt-0.5 bg-white" />
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-zinc-400 text-xs">Complete</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-zinc-400 text-xs">Missed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-zinc-400 text-xs">Upcoming</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-zinc-400 text-xs">Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

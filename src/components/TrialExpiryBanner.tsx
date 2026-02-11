'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, Zap } from 'lucide-react'

interface TrialExpiryBannerProps {
  daysRemaining: number
}

export default function TrialExpiryBanner({ daysRemaining }: TrialExpiryBannerProps) {
  // Determine urgency level and styling
  const isUrgent = daysRemaining <= 1
  const isWarning = daysRemaining <= 3 && daysRemaining > 1

  const bgColor = isUrgent 
    ? 'bg-red-500/20 border-red-500/50' 
    : 'bg-orange-500/20 border-orange-500/50'
  
  const textColor = isUrgent ? 'text-red-400' : 'text-orange-400'
  const buttonColor = isUrgent 
    ? 'bg-red-500 hover:bg-red-400' 
    : 'bg-orange-500 hover:bg-orange-400'

  const Icon = isUrgent ? AlertTriangle : Clock

  const message = isUrgent
    ? daysRemaining === 0 
      ? 'Your trial expires today!' 
      : 'Your trial expires tomorrow!'
    : `Your trial expires in ${daysRemaining} days`

  return (
    <div className={`${bgColor} border rounded-xl p-4 flex items-center justify-between animate-pulse-slow`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${isUrgent ? 'bg-red-500/30' : 'bg-orange-500/30'} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        <div>
          <p className={`font-semibold ${textColor}`}>
            {message}
          </p>
          <p className="text-zinc-400 text-sm">
            Subscribe now to keep access to all your programs and client data.
          </p>
        </div>
      </div>
      <Link 
        href="/billing" 
        className={`${buttonColor} text-white px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 whitespace-nowrap`}
      >
        <Zap className="w-4 h-4" />
        Upgrade Now
      </Link>
    </div>
  )
}

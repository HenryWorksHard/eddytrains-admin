'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCheck, Plus, Users, Mail, MoreVertical, Trash2 } from 'lucide-react'

interface Trainer {
  id: string
  email: string
  full_name: string | null
  created_at: string
  client_count?: number
}

interface Invite {
  id: string
  email: string
  created_at: string
  expires_at: string
}

export default function CompanyTrainersPage() {
  const supabase = createClient()
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [maxTrainers, setMaxTrainers] = useState(5)
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetchCompanyAndTrainers()
  }, [])

  async function fetchCompanyAndTrainers() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      setLoading(false)
      return
    }

    setCompanyId(profile.company_id)

    // Get company details
    const { data: company } = await supabase
      .from('organizations')
      .select('max_trainers')
      .eq('id', profile.company_id)
      .single()

    if (company) setMaxTrainers(company.max_trainers || 5)

    // Get trainers in this company
    const { data: trainersData } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .eq('company_id', profile.company_id)
      .eq('role', 'trainer')
      .order('created_at', { ascending: false })

    if (trainersData) {
      const trainersWithClients = await Promise.all(
        trainersData.map(async (trainer) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('trainer_id', trainer.id)
            .eq('role', 'client')

          return { ...trainer, client_count: count || 0 }
        })
      )
      setTrainers(trainersWithClients)
    }

    // Get pending invites
    const { data: invitesData } = await supabase
      .from('trainer_invites')
      .select('id, email, created_at, expires_at')
      .eq('company_id', profile.company_id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    if (invitesData) setInvites(invitesData)

    setLoading(false)
  }

  async function sendInvite() {
    if (!inviteEmail || !companyId) return
    
    if (trainers.length + invites.length >= maxTrainers) {
      alert(`You've reached your trainer limit (${maxTrainers}). Contact support to upgrade.`)
      return
    }

    setInviting(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('trainer_invites').insert({
      company_id: companyId,
      email: inviteEmail,
      invited_by: user?.id,
    })

    if (!error) {
      // TODO: Send actual email invite via API
      setShowInviteModal(false)
      setInviteEmail('')
      fetchCompanyAndTrainers()
    } else {
      alert('Failed to send invite: ' + error.message)
    }

    setInviting(false)
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from('trainer_invites').delete().eq('id', inviteId)
    fetchCompanyAndTrainers()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Trainers</h1>
          <p className="text-zinc-400 mt-1">
            {trainers.length} of {maxTrainers} trainers
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          disabled={trainers.length + invites.length >= maxTrainers}
          className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-xl font-medium hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Invite Trainer
        </button>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-yellow-400 mb-3">Pending Invites</h3>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between bg-zinc-900 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white">{invite.email}</p>
                  <p className="text-xs text-zinc-500">
                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => cancelInvite(invite.id)}
                  className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainers List */}
      {trainers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <UserCheck className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No trainers yet</h3>
          <p className="text-zinc-400 mb-6">Invite trainers to join your company</p>
          <button
            onClick={() => setShowInviteModal(true)}
            className="bg-yellow-400 text-black px-6 py-2 rounded-xl font-medium hover:bg-yellow-300 transition-colors"
          >
            Invite Trainer
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Trainer</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Clients</th>
                <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">Joined</th>
                <th className="text-right text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {trainers.map((trainer) => (
                <tr key={trainer.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{trainer.full_name || 'No name'}</p>
                      <p className="text-sm text-zinc-500">{trainer.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <span className="text-white">{trainer.client_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    {new Date(trainer.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-zinc-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Invite Trainer</h2>
            
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
                placeholder="trainer@example.com"
              />
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 bg-zinc-800 text-white px-4 py-3 rounded-xl font-medium hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendInvite}
                disabled={inviting || !inviteEmail}
                className="flex-1 bg-yellow-400 text-black px-4 py-3 rounded-xl font-medium hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                <Mail className="w-4 h-4 inline mr-2" />
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import { Users, UserPlus, Mail, Trash2, X, MoreVertical, CheckCircle, Clock, Shield, UserCog } from 'lucide-react';

interface Trainer {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'trainer';
  invited_at: string | null;
  joined_at: string | null;
  is_active: boolean;
  profile?: {
    full_name: string;
    email: string;
    profile_picture_url: string | null;
  };
  client_count?: number;
}

interface Invite {
  id: string;
  email: string;
  role: 'admin' | 'trainer';
  created_at: string;
  expires_at: string;
}

export default function TrainersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'trainer'>('trainer');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [maxTrainers, setMaxTrainers] = useState<number>(1);
  
  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'trainer'>('trainer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Get user's profile and organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      router.push('/dashboard');
      return;
    }

    setOrgId(profile.organization_id);

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('max_trainers')
      .eq('id', profile.organization_id)
      .single();

    if (org) {
      setMaxTrainers(org.max_trainers || 1);
    }

    // Get user's role in organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', profile.organization_id)
      .eq('user_id', user.id)
      .single();

    if (membership) {
      setUserRole(membership.role as 'owner' | 'admin' | 'trainer');
    } else {
      // Fallback: check if they're the org owner
      const { data: orgData } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', profile.organization_id)
        .single();
      
      if (orgData?.owner_id === user.id) {
        setUserRole('owner');
      }
    }

    // Get all trainers in organization
    const { data: members } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        role,
        invited_at,
        joined_at,
        is_active
      `)
      .eq('organization_id', profile.organization_id)
      .order('joined_at', { ascending: true });

    if (members) {
      // Get profiles for all members
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture_url')
        .in('id', userIds);

      // Get client counts for each trainer
      const trainersWithData = await Promise.all(
        members.map(async (member) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('trainer_id', member.user_id)
            .eq('role', 'client');

          return {
            ...member,
            profile: profiles?.find(p => p.id === member.user_id),
            client_count: count || 0,
          };
        })
      );

      setTrainers(trainersWithData);
    }

    // Get pending invites
    const { data: pendingInvites } = await supabase
      .from('organization_invites')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    if (pendingInvites) {
      setInvites(pendingInvites);
    }

    setLoading(false);
  }

  const canManageTrainers = userRole === 'owner' || userRole === 'admin';
  const canAddTrainers = canManageTrainers && (maxTrainers === -1 || trainers.length < maxTrainers);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');

    if (!inviteEmail || !orgId) return;

    setInviting(true);

    try {
      const res = await fetch('/api/organization/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId,
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || 'Failed to send invite');
        return;
      }

      // Add to invites list
      setInvites([...invites, data.invite]);
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('trainer');
    } catch (error) {
      setInviteError('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Cancel this invitation?')) return;

    try {
      await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId);

      setInvites(invites.filter(i => i.id !== inviteId));
    } catch (error) {
      console.error('Failed to cancel invite:', error);
    }
  };

  const handleRemoveTrainer = async (trainer: Trainer) => {
    if (trainer.role === 'owner') {
      alert('Cannot remove the organization owner');
      return;
    }

    if (!confirm(`Remove ${trainer.profile?.full_name || trainer.profile?.email}? Their clients will need to be reassigned.`)) {
      return;
    }

    try {
      // Remove from organization_members
      await supabase
        .from('organization_members')
        .delete()
        .eq('id', trainer.id);

      // Update their profile to remove org association
      await supabase
        .from('profiles')
        .update({ organization_id: null })
        .eq('id', trainer.user_id);

      setTrainers(trainers.filter(t => t.id !== trainer.id));
    } catch (error) {
      console.error('Failed to remove trainer:', error);
      alert('Failed to remove trainer');
    }
  };

  const handleChangeRole = async (trainer: Trainer, newRole: 'admin' | 'trainer') => {
    if (trainer.role === 'owner') {
      alert('Cannot change the owner role');
      return;
    }

    try {
      await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', trainer.id);

      setTrainers(trainers.map(t => 
        t.id === trainer.id ? { ...t, role: newRole } : t
      ));
    } catch (error) {
      console.error('Failed to change role:', error);
      alert('Failed to change role');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <span className="px-2 py-1 bg-yellow-400/10 text-yellow-400 rounded text-xs font-medium">Owner</span>;
      case 'admin':
        return <span className="px-2 py-1 bg-blue-400/10 text-blue-400 rounded text-xs font-medium">Admin</span>;
      default:
        return <span className="px-2 py-1 bg-zinc-400/10 text-zinc-400 rounded text-xs font-medium">Trainer</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 p-8 ml-64">
          <div className="animate-pulse text-white">Loading trainers...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-8 ml-64">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Team Members</h1>
              <p className="text-zinc-400">
                {trainers.length} / {maxTrainers === -1 ? '∞' : maxTrainers} trainers
              </p>
            </div>
            {canAddTrainers && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                Invite Trainer
              </button>
            )}
          </div>

          {/* Trainers limit warning */}
          {!canAddTrainers && canManageTrainers && maxTrainers !== -1 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
              <p className="text-yellow-400 text-sm">
                You've reached your trainer limit ({maxTrainers}). Upgrade your plan to add more trainers.
              </p>
            </div>
          )}

          {/* Trainers List */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden mb-8">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="font-semibold text-white">Active Trainers</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {trainers.map((trainer) => (
                <div key={trainer.id} className="p-4 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                    {trainer.profile?.profile_picture_url ? (
                      <img src={trainer.profile.profile_picture_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-zinc-500" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">
                        {trainer.profile?.full_name || 'Unknown'}
                      </p>
                      {getRoleBadge(trainer.role)}
                    </div>
                    <p className="text-zinc-500 text-sm">{trainer.profile?.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="text-right mr-4">
                    <p className="text-white font-medium">{trainer.client_count}</p>
                    <p className="text-zinc-500 text-xs">clients</p>
                  </div>

                  {/* Actions */}
                  {canManageTrainers && trainer.role !== 'owner' && (
                    <div className="flex items-center gap-2">
                      <select
                        value={trainer.role}
                        onChange={(e) => handleChangeRole(trainer, e.target.value as 'admin' | 'trainer')}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white"
                      >
                        <option value="trainer">Trainer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleRemoveTrainer(trainer)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Remove trainer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {trainers.length === 0 && (
                <div className="p-8 text-center text-zinc-500">
                  No trainers yet. Invite your first team member!
                </div>
              )}
            </div>
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  Pending Invitations
                </h2>
              </div>
              <div className="divide-y divide-zinc-800">
                {invites.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white">{invite.email}</p>
                      <p className="text-zinc-500 text-sm">
                        Invited as {invite.role} • Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    {canManageTrainers && (
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Cancel invitation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Invite Trainer</h2>
              <button
                onClick={() => setShowInvite(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="trainer@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'trainer')}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="trainer">Trainer — Can manage their own clients</option>
                  <option value="admin">Admin — Can manage all trainers and clients</option>
                </select>
              </div>

              {inviteError && (
                <p className="text-red-400 text-sm">{inviteError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black rounded-xl font-medium transition-colors"
                >
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import { Users, Building2, DollarSign, TrendingUp, Eye, Search, Plus, X } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  subscription_tier: string;
  subscription_status: string;
  client_limit: number;
  created_at: string;
  profiles?: { email: string; full_name: string }[];
  client_count?: number;
}

interface Stats {
  totalTrainers: number;
  totalClients: number;
  activeSubscriptions: number;
  trialingOrgs: number;
  mrr: number;
}

const TIER_PRICES: Record<string, number> = {
  starter: 39,
  pro: 79,
  studio: 149,
  gym: 299,
};

export default function PlatformPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [showAddTrainer, setShowAddTrainer] = useState(false);
  const [addingTrainer, setAddingTrainer] = useState(false);
  const [newTrainer, setNewTrainer] = useState({
    email: '',
    password: '',
    fullName: '',
    orgName: '',
    orgSlug: '',
  });

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if super_admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }

      setIsSuperAdmin(true);

      // Fetch organizations
      const response = await fetch('/api/organizations');
      const data = await response.json();

      if (data.organizations) {
        // Get client counts for each org
        const orgsWithCounts = await Promise.all(
          data.organizations.map(async (org: Organization) => {
            const { count } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .eq('role', 'client');
            return { ...org, client_count: count || 0 };
          })
        );

        setOrganizations(orgsWithCounts);

        // Calculate stats
        const activeOrgs = orgsWithCounts.filter((o: Organization) => o.subscription_status === 'active');
        const trialingOrgs = orgsWithCounts.filter((o: Organization) => o.subscription_status === 'trialing');
        const totalClients = orgsWithCounts.reduce((sum: number, o: Organization) => sum + (o.client_count || 0), 0);
        const mrr = activeOrgs.reduce((sum: number, o: Organization) => sum + (TIER_PRICES[o.subscription_tier] || 0), 0);

        setStats({
          totalTrainers: orgsWithCounts.length,
          totalClients,
          activeSubscriptions: activeOrgs.length,
          trialingOrgs: trialingOrgs.length,
          mrr,
        });
      }

      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleImpersonate = async (orgId: string) => {
    // Store the impersonation in session storage
    sessionStorage.setItem('impersonating_org', orgId);
    router.push('/dashboard');
    router.refresh();
  };

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTrainer(true);

    try {
      // Call API to create trainer
      const response = await fetch('/api/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrainer),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to create trainer');
        return;
      }

      // Refresh the page to show new trainer
      window.location.reload();
    } catch (error) {
      console.error('Error creating trainer:', error);
      alert('Failed to create trainer');
    } finally {
      setAddingTrainer(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 p-8 ml-64">
          <div className="animate-pulse">Loading...</div>
        </main>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-8 ml-64">
        <div className="max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Platform Management</h1>
              <p className="text-zinc-400">Overview of all trainers and organizations</p>
            </div>
            <button
              onClick={() => setShowAddTrainer(true)}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Trainer
            </button>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-yellow-400" />
                  <span className="text-zinc-400 text-sm">Total Trainers</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalTrainers}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-zinc-400 text-sm">Total Clients</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-zinc-400 text-sm">Paying Trainers</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.activeSubscriptions}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-zinc-400 text-sm">Monthly Revenue</span>
                </div>
                <p className="text-2xl font-bold text-white">${stats.mrr}</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trainers..."
                className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>

          {/* Organizations Table */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 text-zinc-400 font-medium">Organization</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Owner</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Plan</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Status</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Clients</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr key={org.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{org.name}</p>
                        <p className="text-zinc-500 text-sm">/{org.slug}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-zinc-300">{org.profiles?.[0]?.full_name || 'Unknown'}</p>
                      <p className="text-zinc-500 text-sm">{org.profiles?.[0]?.email || ''}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-yellow-400/10 text-yellow-400 rounded text-sm capitalize">
                        {org.subscription_tier}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          org.subscription_status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : org.subscription_status === 'trialing'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-zinc-500/10 text-zinc-400'
                        }`}
                      >
                        {org.subscription_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-white">
                        {org.client_count} / {org.client_limit === -1 ? '∞' : org.client_limit}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleImpersonate(org.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredOrgs.length === 0 && (
              <div className="p-8 text-center text-zinc-500">
                No organizations found
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Trainer Modal */}
      {showAddTrainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Add New Trainer</h2>
              <button
                onClick={() => setShowAddTrainer(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTrainer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newTrainer.fullName}
                  onChange={(e) => setNewTrainer({ ...newTrainer, fullName: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newTrainer.email}
                  onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="trainer@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newTrainer.password}
                  onChange={(e) => setNewTrainer({ ...newTrainer, password: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={newTrainer.orgName}
                  onChange={(e) => setNewTrainer({ ...newTrainer, orgName: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Smith Fitness"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  URL Slug
                </label>
                <div className="flex items-center">
                  <span className="text-zinc-500 mr-2">app.cmpdcollective.com/</span>
                  <input
                    type="text"
                    value={newTrainer.orgSlug}
                    onChange={(e) => setNewTrainer({ ...newTrainer, orgSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="smith-fitness"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTrainer(false)}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTrainer}
                  className="flex-1 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black rounded-xl font-medium transition-colors"
                >
                  {addingTrainer ? 'Creating...' : 'Create Trainer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

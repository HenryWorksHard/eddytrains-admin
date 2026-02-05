'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import { Building2, Palette, Globe, Save, Loader2, Check, AlertCircle } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  subscription_tier: string;
  subscription_status: string;
  client_limit: number;
  trial_ends_at: string | null;
}

export default function OrganizationPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [brandColor, setBrandColor] = useState('#FACC15');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    async function loadOrganization() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        router.push('/dashboard');
        return;
      }

      // Only trainers and super_admins can access
      if (!['trainer', 'super_admin', 'admin'].includes(profile.role)) {
        router.push('/dashboard');
        return;
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (org) {
        setOrganization(org);
        setName(org.name);
        setSlug(org.slug);
        setBrandColor(org.brand_color || '#FACC15');
        setLogoUrl(org.logo_url || '');
      }

      setLoading(false);
    }

    loadOrganization();
  }, [supabase, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name,
          slug,
          brand_color: brandColor,
          logo_url: logoUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization.id);

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setOrganization({ ...organization, name, slug, brand_color: brandColor, logo_url: logoUrl || null });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
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

  if (!organization) {
    return (
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 p-8 ml-64">
          <div className="text-zinc-400">No organization found</div>
        </main>
      </div>
    );
  }

  const trialDaysLeft = organization.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(organization.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-8 ml-64">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-white mb-2">Organization Settings</h1>
          <p className="text-zinc-400 mb-8">Manage your business details and branding</p>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                message.type === 'success'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {message.text}
            </div>
          )}

          {/* Subscription Status Card */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Current Plan</p>
                <p className="text-xl font-bold text-yellow-500 capitalize">{organization.subscription_tier}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-400">Status</p>
                <p className={`font-medium ${
                  organization.subscription_status === 'active' ? 'text-green-400' :
                  organization.subscription_status === 'trialing' ? 'text-blue-400' :
                  'text-yellow-400'
                }`}>
                  {organization.subscription_status === 'trialing' && trialDaysLeft !== null
                    ? `Trial (${trialDaysLeft} days left)`
                    : organization.subscription_status}
                </p>
              </div>
            </div>
            <a
              href="/billing"
              className="mt-4 inline-block text-sm text-yellow-400 hover:text-yellow-300"
            >
              Manage subscription →
            </a>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Business Details */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    URL Slug
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">app.cmpdcollective.com/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(generateSlug(e.target.value))}
                      className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      required
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">This is your unique URL for client access</p>
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Branding
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Brand Color
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-32 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                    <div
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: brandColor, color: '#000' }}
                    >
                      Preview
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Optional. Recommended size: 200x200px</p>
                  {logoUrl && (
                    <div className="mt-3 p-4 bg-zinc-800 rounded-lg inline-block">
                      <img src={logoUrl} alt="Logo preview" className="h-16 w-auto" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-semibold rounded-xl transition-colors"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Plus, RefreshCw, Wrench, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminKaliCategory {
  id: number;
  slug: string;
  name: string;
  enabled: boolean;
}

interface AdminKaliTool {
  id: number;
  slug: string;
  categorySlug: string;
  name: string;
  difficulty: string;
  minLevelNumber: number;
  xpReward: number;
  status: string;
  officialDocsUrl: string;
  githubUrl: string | null;
  enabled: boolean;
  published: boolean;
}

interface AdminKaliMission {
  id: number;
  slug: string;
  title: string;
  missionType: string;
  xpReward: number;
  enabled: boolean;
  published: boolean;
}

export const LearnKaliAdminPanel: React.FC = () => {
  const { apiFetch } = useAuth();
  const [categories, setCategories] = useState<AdminKaliCategory[]>([]);
  const [tools, setTools] = useState<AdminKaliTool[]>([]);
  const [missions, setMissions] = useState<AdminKaliMission[]>([]);
  const [stats, setStats] = useState({ learnersActive: 0, avgMastery: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newTool, setNewTool] = useState({
    name: '',
    categorySlug: 'information-gathering',
    summary: '',
    installCommand: 'sudo apt update && sudo apt install -y ',
    difficulty: 'Beginner',
    minLevelNumber: 1,
    xpReward: 80,
    officialDocsUrl: 'https://www.kali.org/tools/',
    githubUrl: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        categories: AdminKaliCategory[];
        tools: AdminKaliTool[];
        missions: AdminKaliMission[];
        stats: { learnersActive: number; avgMastery: number };
      }>('/api/admin/learn-kali');
      setCategories(res.categories || []);
      setTools(res.tools || []);
      setMissions(res.missions || []);
      setStats(res.stats || { learnersActive: 0, avgMastery: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Learn KALI admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const toggleCategory = async (cat: AdminKaliCategory) => {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/learn-kali/categories/${cat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !cat.enabled }),
      });
      setNotice(`Category "${cat.name}" ${!cat.enabled ? 'enabled' : 'disabled'}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle category.');
    }
  };

  const toggleTool = async (tool: AdminKaliTool) => {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/learn-kali/tools/${tool.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !tool.enabled }),
      });
      setNotice(`Tool "${tool.name}" ${!tool.enabled ? 'enabled' : 'disabled'}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tool.');
    }
  };

  const toggleMission = async (mission: AdminKaliMission) => {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/learn-kali/missions/${mission.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !mission.enabled }),
      });
      setNotice(`Mission "${mission.title}" ${!mission.enabled ? 'enabled' : 'disabled'}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mission.');
    }
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/api/admin/learn-kali/tools', {
        method: 'POST',
        body: JSON.stringify(newTool),
      });
      setNotice(`Added "${newTool.name}" to the Learn KALI tool catalog.`);
      setNewTool({
        name: '',
        categorySlug: 'information-gathering',
        summary: '',
        installCommand: 'sudo apt update && sudo apt install -y ',
        difficulty: 'Beginner',
        minLevelNumber: 1,
        xpReward: 80,
        officialDocsUrl: 'https://www.kali.org/tools/',
        githubUrl: '',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add tool.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Learn KALI Catalog, Categories &amp; Mission Administration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active Operators: {stats.learnersActive} · Avg Tool Mastery: {stats.avgMastery}% ·{' '}
            {tools.length} Tools · {missions.length} Missions
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-500">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-500">
          {error}
        </div>
      )}

      {/* Official Category Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Official Kali Categories ({categories.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => void toggleCategory(cat)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                cat.enabled
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-slate-900 dark:text-slate-100'
                  : 'border-rose-500/30 bg-rose-500/5 text-slate-500'
              }`}
            >
              <span>{cat.name}</span>
              {cat.enabled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Add Verified Kali Tool */}
      <form
        onSubmit={handleAddTool}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Plus className="h-4 w-4 text-emerald-500" />
          Add Verified Kali Tool
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <input
            required
            placeholder="Tool Name (e.g. Nmap)"
            value={newTool.name}
            onChange={(e) => setNewTool((p) => ({ ...p, name: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
          />
          <select
            value={newTool.categorySlug}
            onChange={(e) => setNewTool((p) => ({ ...p, categorySlug: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Install command (apt install ...)"
            value={newTool.installCommand}
            onChange={(e) => setNewTool((p) => ({ ...p, installCommand: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
          />
          <input
            required
            placeholder="Official Documentation URL (https://...)"
            value={newTool.officialDocsUrl}
            onChange={(e) => setNewTool((p) => ({ ...p, officialDocsUrl: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
          />
          <input
            placeholder="Verified GitHub URL (optional)"
            value={newTool.githubUrl}
            onChange={(e) => setNewTool((p) => ({ ...p, githubUrl: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
          />
          <input
            required
            placeholder="Summary description"
            value={newTool.summary}
            onChange={(e) => setNewTool((p) => ({ ...p, summary: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
        >
          <Wrench className="h-3.5 w-3.5" />
          Publish Verified Tool
        </button>
      </form>

      {/* Tool Enable/Disable List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Catalog Tools ({tools.length}) &amp; Missions ({missions.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {tools.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t.categorySlug} · Lv.{t.minLevelNumber}+ · +{t.xpReward} XP
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleTool(t)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                  t.enabled
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-rose-500/15 text-rose-500'
                }`}
              >
                {t.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 grid gap-2 sm:grid-cols-2">
          {missions.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {m.title}
                </p>
                <p className="text-[11px] text-slate-500">
                  {m.missionType.toUpperCase()} · +{m.xpReward} XP
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleMission(m)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                  m.enabled
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-rose-500/15 text-rose-500'
                }`}
              >
                {m.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getSettingsSubpageLabel, NAV_UI_LABELS_DE } from '@/constants/uiLabels';
import { resolveSettingsNavigation } from '@/routes/navigationResolver';
import type { SettingsSubpageId } from '@/settings/types';

export default function SettingsPage() {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const navigationGroups = useMemo(() => resolveSettingsNavigation({ role }), [role]);
  const visiblePages = useMemo(
    () => navigationGroups.flatMap((group) => group.pages),
    [navigationGroups],
  );

  const activePageId = (searchParams.get('tab') as SettingsSubpageId | null) ?? visiblePages[0]?.id ?? 'profile';
  const activePage = visiblePages.find((page) => page.id === activePageId) ?? visiblePages[0];

  const setPage = (id: SettingsSubpageId) => setSearchParams({ tab: id });
  const ActiveComponent = activePage?.component;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{NAV_UI_LABELS_DE.settingsTitle}</h1>
        <p className="page-description">{NAV_UI_LABELS_DE.settingsDescription}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="w-full lg:w-64 shrink-0">
          <div className="stat-card p-2 space-y-3">
            {navigationGroups.map((group) => (
              <div key={group.key} className="space-y-0.5">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.pages.map((page) => {
                  const Icon = page.icon;
                  const active = page.id === activePage?.id;
                  return (
                    <button
                      type="button"
                      key={page.id}
                      onClick={() => setPage(page.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{getSettingsSubpageLabel(page.id) ?? page.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  );
}

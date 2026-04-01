import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { canAccessSettingsPage } from '@/settings/access';
import { SETTINGS_SUBPAGES } from '@/settings/subpages';
import type { SettingsSubpageId } from '@/settings/types';

export default function SettingsPage() {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const visiblePages = useMemo(
    () => SETTINGS_SUBPAGES.filter((page) => canAccessSettingsPage(page, { role })),
    [role],
  );

  const activePageId = (searchParams.get('tab') as SettingsSubpageId | null) ?? visiblePages[0]?.id ?? 'general';
  const activePage = visiblePages.find((page) => page.id === activePageId) ?? visiblePages[0];

  const setPage = (id: SettingsSubpageId) => setSearchParams({ tab: id });
  const ActiveComponent = activePage?.component;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Einstellungen</h1>
        <p className="page-description">Vereins- und Systemeinstellungen verwalten</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="w-full lg:w-64 shrink-0">
          <div className="stat-card p-2 space-y-0.5">
            {visiblePages.map((page) => {
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
                  <span className="truncate">{page.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  );
}

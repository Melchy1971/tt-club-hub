import type { Session } from '@supabase/supabase-js';
import type { AppRole, Permission, AuthUser } from '@/types/auth';
import type { SeasonPhase } from '@/types/domain/season';
import type { NewsRow } from '@/types/domain/news';

export type Id = string;

export interface SeasonFilterState {
  readonly teamId?: Id;
  readonly competition?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface NewsFilterState {
  readonly search?: string;
  readonly seasonPhaseId?: Id;
  readonly publishedOnly?: boolean;
  readonly tags?: readonly string[];
}

export type NewsSortKey = 'published_at' | 'created_at' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface AuthContextContract {
  readonly session: Session | null;
  readonly user: AuthUser | null;
  readonly roles: readonly AppRole[];
  readonly primaryRole: AppRole | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: readonly AppRole[]) => boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface RoleDefinition {
  readonly role: AppRole;
  readonly label: string;
  readonly permissions: readonly Permission[];
}

export interface RoleContextContract {
  readonly roleDefinitions: readonly RoleDefinition[];
  readonly permissionsByRole: Readonly<Record<AppRole, readonly Permission[]>>;
  can: (roles: readonly AppRole[], permission: Permission) => boolean;
  canAny: (roles: readonly AppRole[], permissions: readonly Permission[]) => boolean;
  canAll: (roles: readonly AppRole[], permissions: readonly Permission[]) => boolean;
}

export interface SeasonContextContract {
  readonly activePhase: SeasonPhase | null;
  readonly filters: SeasonFilterState;
  readonly isLoading: boolean;
  setPhase: (phase: SeasonPhase | null) => void;
  setFilters: (next: Partial<SeasonFilterState>) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextContract {
  readonly theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export interface NewsContextContract {
  readonly filters: NewsFilterState;
  readonly sort: { readonly key: NewsSortKey; readonly dir: SortDirection };
  readonly page: number;
  readonly pageSize: number;
  readonly selectedNewsId: Id | null;
  setFilters: (next: Partial<NewsFilterState>) => void;
  setSort: (key: NewsSortKey, dir: SortDirection) => void;
  setPage: (page: number) => void;
  selectNews: (newsId: Id | null) => void;
  clearSelection: () => void;
  /** Optional convenience access to the selected query result. */
  selectedNews?: NewsRow | null;
}

export interface MemberSummaryCache {
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly teamLabel?: string | null;
  readonly updatedAt: string;
}

export interface MemberDataContextContract {
  readonly byId: Readonly<Record<Id, MemberSummaryCache>>;
  getMemberSummary: (memberId: Id) => MemberSummaryCache | null;
  putMemberSummary: (memberId: Id, summary: MemberSummaryCache) => void;
  evictMemberSummary: (memberId: Id) => void;
  clear: () => void;
}

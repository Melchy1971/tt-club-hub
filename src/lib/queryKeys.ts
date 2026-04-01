/**
 * Zentrale TanStack-Query-Key-Factory
 *
 * Konvention: [domain, scope?, ...params]
 *   - domain   = Tabellenname / Feature (z.B. 'members')
 *   - scope    = 'list' | 'detail' | 'stats' | …
 *   - params   = Filterparameter-Objekte oder IDs
 *
 * Jede Factory liefert readonly-Tupel → korrekte Typen für
 * useQuery / useQueryClient.invalidateQueries.
 *
 * Verwendung:
 *   queryClient.invalidateQueries({ queryKey: memberKeys.lists() })
 *   → invalidiert alle Mitglieder-Listen (mit und ohne Filter)
 *
 *   queryClient.invalidateQueries({ queryKey: memberKeys.all })
 *   → invalidiert alles unter 'members' (Listen + Details)
 */

import type { NewsFilter } from '@/types';
import type { MemberFilter } from '@/types/member';
import type { DocumentFilter } from '@/services/documentService';

import type { CommunicationAudience, PublicationStatus } from '@/types/domain/communication';

// ── Members ───────────────────────────────────────────────────

export const memberKeys = {
  all:    ['members'] as const,
  lists:  ()          => [...memberKeys.all, 'list']             as const,
  list:   (f: MemberFilter) => [...memberKeys.lists(), f]        as const,
  detail: (id: string) => [...memberKeys.all, 'detail', id]     as const,
};

// ── Teams ─────────────────────────────────────────────────────

export const teamKeys = {
  all:         ['teams'] as const,
  lists:       ()               => [...teamKeys.all, 'list']               as const,
  list:        (f?: object)     => [...teamKeys.lists(), f ?? {}]          as const,
  detail:      (id: string)     => [...teamKeys.all, 'detail', id]        as const,
  members:     (teamId: string) => [...teamKeys.all, 'members', teamId]   as const,
  assignments: (teamId: string) => [...teamKeys.all, 'assignments', teamId] as const,
};

// ── Seasons ───────────────────────────────────────────────────

export const seasonKeys = {
  all:     ['seasons'] as const,
  lists:   ()            => [...seasonKeys.all, 'list']          as const,
  list:    (f?: object)  => [...seasonKeys.lists(), f ?? {}]     as const,
  detail:  (id: string)  => [...seasonKeys.all, 'detail', id]   as const,
  current: ()            => [...seasonKeys.all, 'current']       as const,
};

// ── Matches / Schedule ────────────────────────────────────────

export const matchKeys = {
  all:          ['matches'] as const,
  lists:        ()               => [...matchKeys.all, 'list']               as const,
  list:         (f?: object)     => [...matchKeys.lists(), f ?? {}]          as const,
  detail:       (id: string)     => [...matchKeys.all, 'detail', id]        as const,
  availability: (matchId: string)=> [...matchKeys.all, 'availability', matchId] as const,
  lineup:       (matchId: string)=> [...matchKeys.all, 'lineup', matchId]   as const,
};

// ── Training ──────────────────────────────────────────────────

export const trainingKeys = {
  all:       ['training'] as const,
  sessions:  ()                => [...trainingKeys.all, 'sessions']          as const,
  session:   (f?: object)      => [...trainingKeys.sessions(), f ?? {}]      as const,
  sessionById: (id: string)    => [...trainingKeys.all, 'session', id]      as const,
  bookings:  ()                => [...trainingKeys.all, 'bookings']          as const,
  booking:   (f?: object)      => [...trainingKeys.bookings(), f ?? {}]      as const,
  bookingById: (id: string)    => [...trainingKeys.all, 'booking', id]      as const,
  waitlist:  (sessionId: string, memberId: string) =>
    [...trainingKeys.all, 'waitlist', sessionId, memberId]                   as const,
  spots:     (sessionId: string) =>
    [...trainingKeys.all, 'spots', sessionId]                                as const,
};


// ── Communication (domain-level Standardisierung) ───────────

export const communicationCacheConfig = {
  public: {
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  },
  internal: {
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  },
} as const;

export const communicationKeys = {
  all: ['communication'] as const,
  news: {
    all: ['communication', 'news'] as const,
    list: (f?: { status?: PublicationStatus; audience?: CommunicationAudience; search?: string }) =>
      ['communication', 'news', 'list', f ?? {}] as const,
    detail: (id: string) => ['communication', 'news', 'detail', id] as const,
  },
  documents: {
    all: ['communication', 'documents'] as const,
    list: (f?: DocumentFilter) => ['communication', 'documents', 'list', f ?? {}] as const,
    detail: (id: string) => ['communication', 'documents', 'detail', id] as const,
  },
  lists: {
    all: ['communication', 'lists'] as const,
    list: (f?: { audience?: CommunicationAudience }) => ['communication', 'lists', 'list', f ?? {}] as const,
    detail: (id: string) => ['communication', 'lists', 'detail', id] as const,
    members: (id: string) => ['communication', 'lists', 'members', id] as const,
  },
  exports: {
    ratings: (f?: { audience: 'public' | 'internal'; generatedAt?: string }) => ['communication', 'exports', 'ratings', f] as const,
  },
};

// ── News ──────────────────────────────────────────────────────

export const newsKeys = {
  all:      ['news'] as const,
  lists:    ()               => [...newsKeys.all, 'list']               as const,
  list:     (f: NewsFilter)  => [...newsKeys.lists(), f]                as const,
  detail:   (id: string)     => [...newsKeys.all, 'detail', id]        as const,
  bySlug:   (slug: string)   => [...newsKeys.all, 'slug', slug]        as const,
  public:   (f?: object)     => [...newsKeys.all, 'public', f ?? {}]   as const,
  internal: (f?: object)     => [...newsKeys.all, 'internal', f ?? {}] as const,
};

// ── Substitutes ───────────────────────────────────────────────

export const substituteKeys = {
  all:    ['substitutes'] as const,
  lists:  ()           => [...substituteKeys.all, 'list']          as const,
  list:   (f?: object) => [...substituteKeys.lists(), f ?? {}]     as const,
  detail: (id: string) => [...substituteKeys.all, 'detail', id]   as const,
};

// ── Documents ─────────────────────────────────────────────────

export const documentKeys = {
  all:        ['documents'] as const,
  lists:      ()                 => [...documentKeys.all, 'list']             as const,
  list:       (f?: DocumentFilter) => [...documentKeys.lists(), f ?? {}]      as const,
  detail:     (id: string)       => [...documentKeys.all, 'detail', id]      as const,
  categories: ()                 => [...documentKeys.all, 'categories']       as const,
};

// ── Communication Lists ───────────────────────────────────────

export const communicationListKeys = {
  all:     ['communicationLists'] as const,
  lists:   ()            => [...communicationListKeys.all, 'list']            as const,
  detail:  (id: string)  => [...communicationListKeys.all, 'detail', id]     as const,
  members: (id: string)  => [...communicationListKeys.all, 'members', id]    as const,
  withCounts: ()         => [...communicationListKeys.all, 'withCounts']      as const,
};

// ── Profile / Info ───────────────────────────────────────────


export const profileInfoKeys = {
  all: ['profile-info'] as const,
  memberViewModel: (userId: string) => [...profileInfoKeys.all, 'member-view-model', userId] as const,
  publicClubInfo: () => [...profileInfoKeys.all, 'public-club-info'] as const,
  developerInfo: () => [...profileInfoKeys.all, 'developer-info'] as const,
  securityCheck: () => [...profileInfoKeys.all, 'security-check'] as const,
};

// ── Club Settings ─────────────────────────────────────────────

export const settingsKeys = {
  all:  ['settings'] as const,
  club: ()           => [...settingsKeys.all, 'club']              as const,
};

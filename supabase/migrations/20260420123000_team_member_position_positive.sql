-- Enforce positive team member positions and migrate legacy 0-positions.

-- 1) Migrate legacy or invalid positions (<= 0) to unique positive positions per team.
WITH non_positive AS (
  SELECT
    tm.id,
    tm.team_id,
    ROW_NUMBER() OVER (PARTITION BY tm.team_id ORDER BY tm.created_at, tm.id) AS rn
  FROM public.team_members tm
  WHERE tm.position <= 0 OR tm.position IS NULL
),
max_positive AS (
  SELECT
    tm.team_id,
    COALESCE(MAX(tm.position), 0) AS max_pos
  FROM public.team_members tm
  WHERE tm.position > 0
  GROUP BY tm.team_id
)
UPDATE public.team_members tm
SET position = COALESCE(mp.max_pos, 0) + np.rn
FROM non_positive np
LEFT JOIN max_positive mp ON mp.team_id = np.team_id
WHERE tm.id = np.id;

-- 2) Remove default 0 so all write paths must provide an explicit position.
ALTER TABLE public.team_members
  ALTER COLUMN position DROP DEFAULT;

-- 3) Tighten check constraint: only positive integers.
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS chk_team_member_position;

ALTER TABLE public.team_members
  ADD CONSTRAINT chk_team_member_position CHECK (position > 0);

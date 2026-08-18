-- ============================================================================
-- MIGRACIÓN v3: Soporte Historial Anterior (Legacy) — Fast Lane Wash Loyalty Card
-- Fecha: 2026-08-17
-- Reemplaza get_public_loyalty_card.
-- Cambios:
--   · Retorna objeto 'legacy' con estadísticas y log de visitas anteriores (loyalty_visits)
--   · Retorna 'lastVisit' en el objeto customer
--   · Prioriza coincidencia exacta del nombre completo cuando hay múltiples candidatos
--   · Soporta clientes que solo tienen historial anterior (loyalty_progress = null)
-- ============================================================================

-- ── 0. EXTENSIÓN UNACCENT ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- ── 1. HELPER: flw_normalize ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flw_normalize(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN lower(trim(regexp_replace(
    unaccent(COALESCE(p_text, '')),
    '\s+', ' ', 'g'
  )));
EXCEPTION
  WHEN undefined_function THEN
    RETURN lower(trim(regexp_replace(COALESCE(p_text, ''), '\s+', ' ', 'g')));
END;
$$;

GRANT EXECUTE ON FUNCTION public.flw_normalize(TEXT) TO anon, authenticated;

-- ── 2. TABLA RATE LIMITING ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_lookup_attempts (
  id           BIGSERIAL   PRIMARY KEY,
  ip           TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_lookup_ip_time
  ON public.loyalty_lookup_attempts (ip, attempted_at DESC);

ALTER TABLE public.loyalty_lookup_attempts ENABLE ROW LEVEL SECURITY;

-- ── 3. RPC PRINCIPAL: get_public_loyalty_card (v3) ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_loyalty_card(
  p_name        TEXT,
  p_last4       TEXT,
  p_client_ip   TEXT DEFAULT 'unknown'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Búsqueda
  v_search_tokens   TEXT[];
  v_token_count     INT;

  -- Candidatos
  v_candidate_count INT;
  v_best_score      INT;
  v_best_count      INT;

  -- Cliente seleccionado
  v_customer        RECORD;

  -- Lealtad v3 (moderno)
  v_progress        RECORD;
  v_available_rewards JSONB;
  v_recent_washes   JSONB;
  v_next_milestone  JSONB;

  -- Lealtad Legacy (historial anterior)
  v_legacy_visits   INT;
  v_legacy_earned   INT;
  v_legacy_used     INT;
  v_legacy_avail    INT;
  v_legacy_in_cycle INT;
  v_legacy_rem      INT;
  v_legacy_log      JSONB;
  v_legacy          JSONB;

  -- Rate limiting
  v_attempt_count   INT;
BEGIN

  -- ════════════════════════════════════════════════════════════════
  -- 1. VALIDACIÓN DE INPUTS
  -- ════════════════════════════════════════════════════════════════

  -- p_last4: exactamente 4 dígitos (0-9)
  IF p_last4 IS NULL OR p_last4 !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- p_name: mínimo 2 caracteres tras trim
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- 2. RATE LIMITING  (ventana de 5 min, máx 10 intentos / IP)
  -- ════════════════════════════════════════════════════════════════

  DELETE FROM public.loyalty_lookup_attempts
   WHERE attempted_at < now() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO v_attempt_count
    FROM public.loyalty_lookup_attempts
   WHERE ip = p_client_ip
     AND attempted_at > now() - INTERVAL '5 minutes';

  IF v_attempt_count >= 10 THEN
    RETURN jsonb_build_object('found', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.loyalty_lookup_attempts (ip, attempted_at)
  VALUES (p_client_ip, now());

  -- ════════════════════════════════════════════════════════════════
  -- 3. NORMALIZAR Y TOKENIZAR LA BÚSQUEDA
  -- ════════════════════════════════════════════════════════════════

  v_search_tokens := array_remove(
    string_to_array(public.flw_normalize(p_name), ' '),
    ''
  );

  SELECT COUNT(*) INTO v_token_count
    FROM unnest(v_search_tokens) t
   WHERE length(t) >= 2;

  IF v_token_count = 0 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_search_tokens := ARRAY(
    SELECT t FROM unnest(v_search_tokens) t WHERE length(t) >= 2
  );

  -- ════════════════════════════════════════════════════════════════
  -- 4. BÚSQUEDA POR TOKENS CON SCORING Y EXACT MATCH BONUS
  -- ════════════════════════════════════════════════════════════════

  SELECT
    MAX(sub.score),
    COUNT(*),
    SUM(CASE WHEN sub.score = (
          SELECT MAX(s2.score)
            FROM (
              SELECT (
                (SELECT COUNT(*)::int
                   FROM unnest(v_search_tokens) tok
                  WHERE tok = ANY(string_to_array(public.flw_normalize(c2.name), ' ')))
                + (CASE WHEN public.flw_normalize(c2.name) = public.flw_normalize(p_name) THEN 10 ELSE 0 END)
              ) AS score
                FROM public.customers c2
               WHERE c2.is_general = false
                 AND RIGHT(REGEXP_REPLACE(COALESCE(c2.phone,''),'\D','','g'),4) = p_last4
            ) s2
           WHERE s2.score > 0
        ) THEN 1 ELSE 0 END
    )
    INTO v_best_score, v_candidate_count, v_best_count
  FROM (
    SELECT
      c.id,
      (
        (SELECT COUNT(*)::int
           FROM unnest(v_search_tokens) tok
          WHERE tok = ANY(string_to_array(public.flw_normalize(c.name), ' ')))
        + (CASE WHEN public.flw_normalize(c.name) = public.flw_normalize(p_name) THEN 10 ELSE 0 END)
      ) AS score
      FROM public.customers c
     WHERE c.is_general = false
       AND RIGHT(REGEXP_REPLACE(COALESCE(c.phone,''),'\D','','g'),4) = p_last4
  ) sub
  WHERE sub.score > 0;

  -- ════════════════════════════════════════════════════════════════
  -- 5. DECIDIR RESULTADO
  -- ════════════════════════════════════════════════════════════════

  IF v_candidate_count IS NULL OR v_candidate_count = 0 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_best_count > 1 THEN
    RETURN jsonb_build_object('found', false, 'error', 'multiple_matches');
  END IF;

  SELECT
    c.id,
    c.name,
    c.plate,
    c.is_general,
    c.loyalty_visits,
    c.loyalty_free_washes_earned,
    c.loyalty_free_washes_used,
    c.loyalty_last_visit
    INTO v_customer
    FROM public.customers c
   WHERE c.is_general = false
     AND RIGHT(REGEXP_REPLACE(COALESCE(c.phone,''),'\D','','g'),4) = p_last4
     AND (
       (SELECT COUNT(*)::int
          FROM unnest(v_search_tokens) tok
         WHERE tok = ANY(string_to_array(public.flw_normalize(c.name), ' ')))
       + (CASE WHEN public.flw_normalize(c.name) = public.flw_normalize(p_name) THEN 10 ELSE 0 END)
     ) = v_best_score
   ORDER BY c.id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- 6. DATOS DEL HISTORIAL ANTERIOR (LEGACY)
  -- ════════════════════════════════════════════════════════════════

  v_legacy_visits   := COALESCE(v_customer.loyalty_visits, 0);
  v_legacy_earned   := COALESCE(v_customer.loyalty_free_washes_earned, 0);
  v_legacy_used     := COALESCE(v_customer.loyalty_free_washes_used, 0);
  v_legacy_avail    := GREATEST(0, v_legacy_earned - v_legacy_used);
  v_legacy_in_cycle := v_legacy_visits % 8;
  v_legacy_rem      := 8 - (v_legacy_visits % 8);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'visitNumber',    lv.visit_number,
      'service',        COALESCE(s.name, 'Servicio'),
      'earnedFreeWash', COALESCE(lv.earned_free_wash, false),
      'date',           to_char(lv.created_at AT TIME ZONE 'America/Managua', 'YYYY-MM-DD"T"HH24:MI:SS')
    ) ORDER BY lv.visit_number DESC, lv.created_at DESC
  ), '[]'::jsonb)
    INTO v_legacy_log
    FROM (
      SELECT lv_sub.*
        FROM public.loyalty_visits lv_sub
       WHERE lv_sub.customer_id = v_customer.id
       ORDER BY lv_sub.visit_number DESC, lv_sub.created_at DESC
       LIMIT 50
    ) lv
    LEFT JOIN public.services s ON s.id = lv.service_id;

  v_legacy := jsonb_build_object(
    'visits',             v_legacy_visits,
    'earned',             v_legacy_earned,
    'used',               v_legacy_used,
    'available',          v_legacy_avail,
    'cycleSize',          8,
    'progressInCycle',    v_legacy_in_cycle,
    'remainingForReward', v_legacy_rem,
    'lastVisit',          v_customer.loyalty_last_visit,
    'visitsLog',          v_legacy_log
  );

  -- ════════════════════════════════════════════════════════════════
  -- 7. DATOS DEL PROGRAMA ACTUAL (MODERNO V3)
  -- ════════════════════════════════════════════════════════════════

  SELECT
    lpr.washes_in_cycle,
    lpr.total_washes,
    lpr.cycle_number,
    lpr.program_id,
    lp.id   AS lp_id,
    lp.name AS lp_name,
    lp.slug AS lp_slug,
    lp.cycle_size,
    lp.rewards
    INTO v_progress
    FROM public.loyalty_progress lpr
    JOIN public.loyalty_programs lp ON lp.id = lpr.program_id
   WHERE lpr.customer_id = v_customer.id
     AND lp.active = true
   ORDER BY lpr.washes_in_cycle DESC
   LIMIT 1;

  -- Cliente sin ningún programa v3 activo → mostrar tarjeta con datos de legacy
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found',        true,
      'customer',     jsonb_build_object(
        'name',      v_customer.name,
        'plate',     v_customer.plate,
        'lastVisit', v_customer.loyalty_last_visit
      ),
      'loyalty',      NULL,
      'recentWashes', '[]'::jsonb,
      'legacy',       v_legacy
    );
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- 8. RECOMPENSAS DISPONIBLES (V3)
  -- ════════════════════════════════════════════════════════════════

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'rewardName', lr.reward_name,
      'rewardSlug', lr.reward_slug,
      'earnedAt',   lr.earned_at
    ) ORDER BY lr.earned_at DESC
  ), '[]'::jsonb)
    INTO v_available_rewards
    FROM public.loyalty_rewards lr
   WHERE lr.customer_id = v_customer.id
     AND lr.program_id  = v_progress.lp_id
     AND lr.status      = 'available';

  -- ════════════════════════════════════════════════════════════════
  -- 9. PRÓXIMA RECOMPENSA (V3)
  -- ════════════════════════════════════════════════════════════════

  SELECT jsonb_build_object(
    'at',         (r.value->>'at')::int,
    'reward',      r.value->>'reward',
    'rewardSlug',  r.value->>'reward_slug'
  )
    INTO v_next_milestone
    FROM jsonb_array_elements(v_progress.rewards) r
   WHERE (r.value->>'at')::int > v_progress.washes_in_cycle
   ORDER BY (r.value->>'at')::int ASC
   LIMIT 1;

  IF v_next_milestone IS NULL THEN
    SELECT jsonb_build_object(
      'at',         (r.value->>'at')::int,
      'reward',      r.value->>'reward',
      'rewardSlug',  r.value->>'reward_slug'
    )
      INTO v_next_milestone
      FROM jsonb_array_elements(v_progress.rewards) r
     ORDER BY (r.value->>'at')::int ASC
     LIMIT 1;
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- 10. HISTORIAL RECIENTE (V3 - últimos 5 lavados)
  -- ════════════════════════════════════════════════════════════════

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date',    to_char(sub.created_at AT TIME ZONE 'America/Managua', 'YYYY-MM-DD'),
      'service', sub.svc_name
    ) ORDER BY sub.created_at DESC
  ), '[]'::jsonb)
    INTO v_recent_washes
    FROM (
      SELECT wl.created_at,
             COALESCE(s.name, 'Servicio') AS svc_name
        FROM public.loyalty_wash_log wl
        LEFT JOIN public.services s ON s.id = wl.service_id
       WHERE wl.customer_id = v_customer.id
         AND wl.program_id  = v_progress.lp_id
       ORDER BY wl.created_at DESC
       LIMIT 5
    ) sub;

  -- ════════════════════════════════════════════════════════════════
  -- 11. CONSTRUIR Y RETORNAR RESPUESTA COMPLETA
  -- ════════════════════════════════════════════════════════════════

  RETURN jsonb_build_object(
    'found',   true,
    'customer', jsonb_build_object(
      'name',      v_customer.name,
      'plate',     v_customer.plate,
      'lastVisit', v_customer.loyalty_last_visit
    ),
    'loyalty', jsonb_build_object(
      'program', jsonb_build_object(
        'name',      v_progress.lp_name,
        'slug',      v_progress.lp_slug,
        'cycleSize', v_progress.cycle_size
      ),
      'current',          v_progress.washes_in_cycle,
      'required',         v_progress.cycle_size,
      'percentage',       ROUND(v_progress.washes_in_cycle::numeric / v_progress.cycle_size * 100),
      'remaining',        v_progress.cycle_size - v_progress.washes_in_cycle,
      'nextMilestoneAt',  (v_next_milestone->>'at')::int,
      'reward',            v_next_milestone->>'reward',
      'rewardSlug',        v_next_milestone->>'rewardSlug',
      'rewardUnlocked',   jsonb_array_length(v_available_rewards) > 0,
      'availableRewards',  v_available_rewards,
      'totalWashes',      v_progress.total_washes,
      'cycleNumber',      v_progress.cycle_number
    ),
    'recentWashes', v_recent_washes,
    'legacy',       v_legacy
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('found', false);

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card(TEXT, TEXT, TEXT) TO authenticated;

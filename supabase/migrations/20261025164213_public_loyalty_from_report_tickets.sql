-- Reportes es la fuente de verdad: una visita por ticket pagado y programa.
-- Requiere la migración base sql/migration_public_loyalty_rpc.sql.
-- No modifica tickets, canjes ni contadores históricos.
BEGIN;

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

  -- Lealtad v3 (moderno) — soporte múltiples programas
  v_progress          RECORD;
  v_ticket_washes     JSONB;
  v_last_visit        TIMESTAMPTZ;
  v_available_rewards JSONB;
  v_recent_washes     JSONB;
  v_next_milestone    JSONB;
  v_milestones        JSONB;
  v_loyalty_programs  JSONB := '[]'::jsonb;  -- array de todos los programas activos
  v_loyalty_program_obj JSONB;

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

  SELECT MAX(t.created_at) INTO v_last_visit
    FROM public.tickets t
   WHERE t.customer_id = v_customer.id
     AND t.status = 'paid'
     AND t.business_line = 'car_wash';

  -- Mirror POS customerVisitCategories: exclude products/extras, recognize
  -- whole words (including accent normalization), deduplicate ticket/program.
  -- Materialize once so totals and recent history use exactly the same rows.
  WITH items AS (
    SELECT t.id AS ticket_id, t.ticket_number, t.created_at,
           ti.id AS item_id, ti.service_id, s.id AS catalog_service_id,
           COALESCE(NULLIF(s.name, ''), ti.service_name_snapshot, 'Servicio') AS service,
           public.flw_normalize(COALESCE(NULLIF(s.name, ''), ti.service_name_snapshot, '')) AS normalized_name
      FROM public.tickets t
      JOIN public.ticket_items ti ON ti.ticket_id = t.id
      LEFT JOIN public.services s ON s.id = ti.service_id
     WHERE t.customer_id = v_customer.id
       AND t.status = 'paid'
       AND t.business_line = 'car_wash'
       AND (ti.item_type IS NULL OR ti.item_type = 'service')
       AND NOT COALESCE(s.is_extra, false)
  ), washes AS (
    SELECT DISTINCT ON (i.ticket_id, lp.id)
           i.ticket_id, i.ticket_number, i.created_at, i.service_id, i.service,
           lp.id AS program_id
      FROM items i
      JOIN public.loyalty_programs lp
        ON lp.active AND lp.slug IN ('premium', 'nitido')
       AND i.normalized_name ~ ('\m' || lp.slug || '\M')
     WHERE i.catalog_service_id IS NOT NULL
        OR i.normalized_name ~ '\mlavado\M'
        OR i.normalized_name IN ('premium', 'nitido', 'breve')
     ORDER BY i.ticket_id, lp.id, i.item_id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.created_at, w.ticket_id), '[]'::jsonb)
    INTO v_ticket_washes FROM washes w;

  -- ════════════════════════════════════════════════════════════════
  -- 6. DATOS DEL HISTORIAL ANTERIOR (LEGACY)
  -- ════════════════════════════════════════════════════════════════

  WITH contributions AS (
    SELECT lv.*,
           GREATEST(1, lv.visit_number - COALESCE(LAG(lv.visit_number) OVER (
             ORDER BY lv.visit_number, lv.created_at, lv.id
           ), 0)) AS services_count
      FROM public.loyalty_visits lv
     WHERE lv.customer_id = v_customer.id
  ), valid_visits AS (
    SELECT lv.id, lv.services_count, t.created_at,
           COALESCE(s.name, 'Servicio') AS service,
           SUM(lv.services_count) OVER (ORDER BY t.created_at, t.id, lv.id) AS visit_number
      FROM contributions lv
      JOIN public.tickets t ON t.id = lv.ticket_id
       AND t.customer_id = v_customer.id AND t.status = 'paid'
       AND t.business_line = 'car_wash'
      LEFT JOIN public.services s ON s.id = lv.service_id
  )
  SELECT COALESCE(SUM(services_count), 0)::int,
         COALESCE(jsonb_agg(jsonb_build_object(
           'visitNumber', visit_number,
           'service', service,
           'earnedFreeWash', (visit_number / 8) > ((visit_number - services_count) / 8),
           'date', to_char(created_at AT TIME ZONE 'America/Managua', 'YYYY-MM-DD"T"HH24:MI:SS')
         ) ORDER BY created_at DESC, id DESC), '[]'::jsonb)
    INTO v_legacy_visits, v_legacy_log
    FROM valid_visits;

  v_legacy_earned   := v_legacy_visits / 8;
  -- Used rewards are audit history; never undo a completed redemption here.
  v_legacy_used     := COALESCE(v_customer.loyalty_free_washes_used, 0);
  v_legacy_avail    := GREATEST(0, v_legacy_earned - v_legacy_used);
  v_legacy_in_cycle := v_legacy_visits % 8;
  v_legacy_rem      := 8 - v_legacy_in_cycle;

  v_legacy := jsonb_build_object(
    'visits',             v_legacy_visits,
    'earned',             v_legacy_earned,
    'used',               v_legacy_used,
    'available',          v_legacy_avail,
    'cycleSize',          8,
    'progressInCycle',    v_legacy_in_cycle,
    'remainingForReward', v_legacy_rem,
    'lastVisit',          v_legacy_log->0->>'date',
    'visitsLog',          v_legacy_log
  );

  -- ════════════════════════════════════════════════════════════════
  -- 7. DATOS DE TODOS LOS PROGRAMAS ACTIVOS (MODERNO V3)
  -- ════════════════════════════════════════════════════════════════

  FOR v_progress IN
    SELECT lp.id AS lp_id, lp.name AS lp_name, lp.slug AS lp_slug,
           lp.cycle_size, lp.rewards,
           COUNT(w.program_id)::int AS total_washes,
           (COUNT(w.program_id) % lp.cycle_size)::int AS washes_in_cycle,
           (COUNT(w.program_id) / lp.cycle_size)::int AS cycle_number
      FROM public.loyalty_programs lp
      LEFT JOIN jsonb_to_recordset(v_ticket_washes) AS w(program_id int)
        ON w.program_id = lp.id
     WHERE lp.active AND lp.slug IN ('premium', 'nitido') AND lp.cycle_size > 0
     GROUP BY lp.id, lp.name, lp.slug, lp.cycle_size, lp.rewards
     ORDER BY lp.slug
  LOOP

    -- ── 8. RECOMPENSAS DISPONIBLES para este programa ──────────────

    -- Rank issued benefit groups per milestone, including redeemed/expired
    -- groups so a deletion cannot make a previously consumed benefit available.
    WITH matched_rewards AS (
      SELECT lr.*, (m.value->>'at')::int AS milestone_at,
             COALESCE(lr.option_group, 'reward:' || lr.id::text) AS benefit_group
        FROM public.loyalty_rewards lr
        JOIN LATERAL jsonb_array_elements(v_progress.rewards) m ON
          m.value->>'reward_slug' = lr.reward_slug OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(m.value->'options', '[]'::jsonb)) opt
             WHERE opt->>'reward_slug' = lr.reward_slug
          )
       WHERE lr.customer_id = v_customer.id AND lr.program_id = v_progress.lp_id
    ), benefit_groups AS (
      SELECT milestone_at, benefit_group, MIN(earned_at) AS earned_at, MIN(id) AS first_id
        FROM matched_rewards GROUP BY milestone_at, benefit_group
    ), ranked_groups AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY milestone_at ORDER BY earned_at, first_id) AS benefit_number
        FROM benefit_groups
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'rewardName', lr.reward_name, 'rewardSlug', lr.reward_slug,
      'earnedAt', lr.earned_at, 'optionGroup', lr.option_group,
      'optionSlug', lr.option_slug, 'selectedOption', lr.selected_option,
      'discountPercent', lr.discount_percent
    ) ORDER BY lr.earned_at DESC, lr.id DESC), '[]'::jsonb)
      INTO v_available_rewards
      FROM matched_rewards lr
      JOIN ranked_groups g USING (milestone_at, benefit_group)
     WHERE lr.status = 'available'
       AND (lr.expires_at IS NULL OR lr.expires_at > now())
       AND g.benefit_number <= v_progress.cycle_number +
           CASE WHEN v_progress.washes_in_cycle >= lr.milestone_at THEN 1 ELSE 0 END
       AND EXISTS (
         SELECT 1 FROM jsonb_to_recordset(v_ticket_washes) AS w(ticket_id bigint, program_id int)
          WHERE w.ticket_id = lr.ticket_id AND w.program_id = lr.program_id
       );

    -- ── 9. PRÓXIMA RECOMPENSA para este programa ───────────────────

    SELECT jsonb_build_object(
      'at',        (r.value->>'at')::int,
      'reward',     COALESCE(r.value->>'reward', r.value->'options'->0->>'reward'),
      'rewardSlug', COALESCE(r.value->>'reward_slug', r.value->'options'->0->>'reward_slug'),
      'type',       COALESCE(r.value->>'type', 'fixed'),
      'options',    COALESCE(r.value->'options', '[]'::jsonb)
    )
      INTO v_next_milestone
      FROM jsonb_array_elements(v_progress.rewards) r
     WHERE (r.value->>'at')::int > v_progress.washes_in_cycle
     ORDER BY (r.value->>'at')::int ASC
     LIMIT 1;

    IF v_next_milestone IS NULL THEN
      SELECT jsonb_build_object(
        'at',        (r.value->>'at')::int,
        'reward',     COALESCE(r.value->>'reward', r.value->'options'->0->>'reward'),
        'rewardSlug', COALESCE(r.value->>'reward_slug', r.value->'options'->0->>'reward_slug'),
        'type',       COALESCE(r.value->>'type', 'fixed'),
        'options',    COALESCE(r.value->'options', '[]'::jsonb)
      )
        INTO v_next_milestone
        FROM jsonb_array_elements(v_progress.rewards) r
       ORDER BY (r.value->>'at')::int ASC
       LIMIT 1;
    END IF;

    -- ── 9b. TODOS LOS MILESTONES para este programa ────────────────

    v_milestones := (
      SELECT jsonb_agg(
        jsonb_build_object(
          'at',         (r.value->>'at')::int,
          'type',       COALESCE(r.value->>'type', 'fixed'),
          'reward',     COALESCE(r.value->>'reward', r.value->'options'->0->>'reward'),
          'reward_slug', COALESCE(r.value->>'reward_slug', r.value->'options'->0->>'reward_slug'),
          'options',    COALESCE(r.value->'options', '[]'::jsonb)
        ) ORDER BY (r.value->>'at')::int
      )
      FROM jsonb_array_elements(v_progress.rewards) r
    );

    -- ── 10. HISTORIAL RECIENTE para este programa ──────────────────

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', to_char(w.created_at AT TIME ZONE 'America/Managua', 'YYYY-MM-DD'),
      'service', w.service,
      'ticketNumber', w.ticket_number
    ) ORDER BY w.created_at DESC, w.ticket_id DESC), '[]'::jsonb)
      INTO v_recent_washes
      FROM (
        SELECT * FROM jsonb_to_recordset(v_ticket_washes)
          AS item(ticket_id bigint, ticket_number text, created_at timestamptz, service text, program_id int)
         WHERE item.program_id = v_progress.lp_id
         ORDER BY item.created_at DESC, item.ticket_id DESC
         LIMIT 5
      ) w;

    -- ── Construir objeto de este programa y agregar al array ───────

    v_loyalty_program_obj := jsonb_build_object(
      'program', jsonb_build_object(
        'name',      v_progress.lp_name,
        'slug',      v_progress.lp_slug,
        'cycleSize', v_progress.cycle_size
      ),
      'current',              v_progress.washes_in_cycle,
      'required',             v_progress.cycle_size,
      'percentage',           ROUND(v_progress.washes_in_cycle::numeric / v_progress.cycle_size * 100),
      'remaining',            v_progress.cycle_size - v_progress.washes_in_cycle,
      'remainingForReward',   GREATEST(0, (v_next_milestone->>'at')::int - v_progress.washes_in_cycle),
      'nextMilestoneAt',      (v_next_milestone->>'at')::int,
      'nextMilestoneType',    COALESCE(v_next_milestone->>'type', 'fixed'),
      'nextMilestoneOptions', COALESCE(v_next_milestone->'options', '[]'::jsonb),
      'reward',               v_next_milestone->>'reward',
      'rewardSlug',           v_next_milestone->>'rewardSlug',
      'rewardUnlocked',       jsonb_array_length(v_available_rewards) > 0,
      'availableRewards',     v_available_rewards,
      'milestones',           COALESCE(v_milestones, '[]'::jsonb),
      'totalWashes',          v_progress.total_washes,
      'cycleNumber',          v_progress.cycle_number,
      'recentWashes',         v_recent_washes
    );

    v_loyalty_programs := v_loyalty_programs || jsonb_build_array(v_loyalty_program_obj);

  END LOOP;

  -- ════════════════════════════════════════════════════════════════
  -- 11. CONSTRUIR Y RETORNAR RESPUESTA COMPLETA
  -- ════════════════════════════════════════════════════════════════

  -- Cliente sin ningún programa v3 activo → mostrar tarjeta con datos de legacy
  IF jsonb_array_length(v_loyalty_programs) = 0 THEN
    RETURN jsonb_build_object(
      'found',          true,
      'customer',       jsonb_build_object(
        'name',      v_customer.name,
        'plate',     v_customer.plate,
        'lastVisit', to_char(v_last_visit AT TIME ZONE 'America/Managua', 'YYYY-MM-DD"T"HH24:MI:SS')
      ),
      'loyalty',        NULL,
      'loyaltyPrograms','[]'::jsonb,
      'recentWashes',   '[]'::jsonb,
      'legacy',         v_legacy
    );
  END IF;

  RETURN jsonb_build_object(
    'found',   true,
    'customer', jsonb_build_object(
      'name',      v_customer.name,
      'plate',     v_customer.plate,
      'lastVisit', to_char(v_last_visit AT TIME ZONE 'America/Managua', 'YYYY-MM-DD"T"HH24:MI:SS')
    ),
    -- 'loyalty' mantiene compatibilidad: primer programa del array
    'loyalty',         v_loyalty_programs->0,
    'loyaltyPrograms', v_loyalty_programs,
    -- recentWashes a nivel raíz = washes del primer programa (compat)
    'recentWashes',   (v_loyalty_programs->0->>'recentWashes')::jsonb,
    'legacy',         v_legacy
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card(TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_loyalty_card(TEXT, TEXT, TEXT) FROM PUBLIC;

COMMIT;

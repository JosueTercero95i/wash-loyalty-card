-- ============================================================================
-- MIGRACIÓN v2: Búsqueda Flexible — Fast Lane Wash Loyalty Card
-- Fecha: 2026-08-10
-- Reemplaza la versión inicial del RPC get_public_loyalty_card.
-- Cambios:
--   · Nueva función helper flw_normalize() (unaccent + lower + trim + spaces)
--   · Búsqueda tokenizada por palabras (no cadena exacta)
--   · Manejo de múltiples coincidencias → 'multiple_matches'
--   · Rate limiting idempotente (CREATE IF NOT EXISTS)
--   · Los últimos 4 dígitos del teléfono son el segundo factor de seguridad
-- ============================================================================

-- ── 0. EXTENSIÓN UNACCENT ─────────────────────────────────────────────────────
-- Permite búsqueda sin tildes: 'perez' coincide con 'Pérez'.
-- Si ya está habilitada, el IF NOT EXISTS la ignora sin error.
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- ── 1. HELPER: flw_normalize ──────────────────────────────────────────────────
-- Normaliza texto para comparación:
--   unaccent (quita tildes) + lower + trim + colapso de espacios múltiples.
-- IMMUTABLE: PostgreSQL puede cachear el resultado para el mismo input.
-- SECURITY INVOKER: no necesita privilegios elevados; es solo texto.
CREATE OR REPLACE FUNCTION public.flw_normalize(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- unaccent() elimina diacríticos: 'Pérez' → 'Perez', 'José' → 'Jose'
  -- lower()   pasa a minúsculas
  -- trim()    elimina espacios al inicio/final
  -- regexp_replace(..., '\s+', ' ', 'g')  colapsa espacios múltiples
  RETURN lower(trim(regexp_replace(
    unaccent(COALESCE(p_text, '')),
    '\s+', ' ', 'g'
  )));
EXCEPTION
  -- Si por alguna razón unaccent no está disponible, fallback sin ella
  WHEN undefined_function THEN
    RETURN lower(trim(regexp_replace(COALESCE(p_text, ''), '\s+', ' ', 'g')));
END;
$$;

-- Permitir que la función sea usable sin necesidad de calificar el esquema
GRANT EXECUTE ON FUNCTION public.flw_normalize(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.flw_normalize IS
  'Normaliza texto para búsqueda flexible: unaccent + lower + trim + colapso de espacios. '
  'Ejemplo: flw_normalize(''  PÉREZ  González '') → ''perez gonzalez''';

-- ── 2. TABLA RATE LIMITING (idempotente) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_lookup_attempts (
  id           BIGSERIAL   PRIMARY KEY,
  ip           TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_lookup_ip_time
  ON public.loyalty_lookup_attempts (ip, attempted_at DESC);

-- Sin políticas RLS → solo accesible desde SECURITY DEFINER
ALTER TABLE public.loyalty_lookup_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.loyalty_lookup_attempts IS
  'Rate limiting para el RPC público. Sin acceso directo anon. Solo SECURITY DEFINER.';

-- ── 3. RPC PRINCIPAL: get_public_loyalty_card (v2) ───────────────────────────
--
-- BÚSQUEDA FLEXIBLE:
--   a) Normalizar p_name con flw_normalize().
--   b) Tokenizar por espacios → array de palabras.
--   c) Filtrar customers: phone_last4 = p_last4 (obligatorio).
--   d) Para cada candidato, calcular match_score = cantidad de tokens del
--      usuario que aparecen como palabras en el nombre normalizado del cliente.
--   e) Descartar candidatos con score = 0.
--   f) Si solo hay 1 candidato con el score máximo → devolver su tarjeta.
--   g) Si hay empate en el score máximo entre varios candidatos → 'multiple_matches'.
--
-- SEGURIDAD:
--   · Los últimos 4 dígitos del teléfono son filtro previo obligatorio.
--   · NUNCA se devuelve phone completo, email, IDs internos ni datos de otros.
--   · Rate limiting: 10 intentos / 5 min / IP.
--   · Respuesta genérica para "no encontrado" — no revela si el nombre existe.
--   · EXCEPTION WHEN OTHERS → respuesta genérica (no expone errores internos).
-- ============================================================================

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
  v_best_count      INT;   -- cuántos candidatos tienen el score máximo

  -- Cliente seleccionado
  v_customer        RECORD;

  -- Lealtad
  v_progress        RECORD;
  v_available_rewards JSONB;
  v_recent_washes   JSONB;
  v_next_milestone  JSONB;

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

  -- Purgar intentos de más de 1 hora para no crecer indefinidamente
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

  -- Normalizar la entrada del usuario con nuestro helper
  -- Ejemplo: '  PÉREZ  González ' → 'perez gonzalez'
  v_search_tokens := array_remove(
    string_to_array(public.flw_normalize(p_name), ' '),
    ''   -- eliminar strings vacíos por si quedaran
  );

  -- Contar tokens válidos (≥ 2 caracteres para evitar ruido)
  SELECT COUNT(*) INTO v_token_count
    FROM unnest(v_search_tokens) t
   WHERE length(t) >= 2;

  IF v_token_count = 0 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Filtrar tokens cortos (< 2 chars) para la búsqueda real
  v_search_tokens := ARRAY(
    SELECT t FROM unnest(v_search_tokens) t WHERE length(t) >= 2
  );

  -- ════════════════════════════════════════════════════════════════
  -- 4. BÚSQUEDA POR TOKENS CON SCORING
  --
  -- Para cada cliente (con phone_last4 correcto), calculamos cuántos
  -- tokens del usuario aparecen como PALABRAS EXACTAS en su nombre
  -- normalizado.
  --
  -- match_score = COUNT de tokens del usuario encontrados en el nombre
  --
  -- Ejemplo:
  --   Cliente:         'juan carlos perez gonzalez'  (normalizado)
  --   Tokens usuario:  ['juan', 'perez']
  --   Score:           2  (ambos encontrados)
  --
  --   Cliente:         'carlos perez'  (normalizado)
  --   Tokens usuario:  ['juan', 'perez']
  --   Score:           1  (solo 'perez' encontrado)
  --
  -- La coincidencia es a nivel de PALABRA COMPLETA (no substring):
  --   'an' NO encuentra 'juan'  — evita falsos positivos
  --   'juan' SÍ encuentra 'juan carlos'
  -- ════════════════════════════════════════════════════════════════

  -- Obtener el score máximo entre todos los candidatos con phone correcto
  SELECT
    MAX(sub.score),   -- mejor score alcanzado
    COUNT(*),         -- total de candidatos con score > 0
    SUM(CASE WHEN sub.score = (
          -- necesitamos el MAX pero no podemos auto-referenciar;
          -- lo calculamos como subquery inline más abajo
          SELECT MAX(s2.score)
            FROM (
              SELECT (
                SELECT COUNT(*)::int
                  FROM unnest(v_search_tokens) tok
                 WHERE tok = ANY(string_to_array(public.flw_normalize(c2.name), ' '))
              ) AS score
                FROM public.customers c2
               WHERE c2.is_general = false
                 AND RIGHT(REGEXP_REPLACE(COALESCE(c2.phone,''),'\D','','g'),4) = p_last4
            ) s2
           WHERE s2.score > 0
        ) THEN 1 ELSE 0 END
    )  -- candidatos en el score máximo
    INTO v_best_score, v_candidate_count, v_best_count
  FROM (
    SELECT
      c.id,
      (
        SELECT COUNT(*)::int
          FROM unnest(v_search_tokens) tok
         WHERE tok = ANY(string_to_array(public.flw_normalize(c.name), ' '))
      ) AS score
      FROM public.customers c
     WHERE c.is_general = false
       AND RIGHT(REGEXP_REPLACE(COALESCE(c.phone,''),'\D','','g'),4) = p_last4
  ) sub
  WHERE sub.score > 0;

  -- ════════════════════════════════════════════════════════════════
  -- 5. DECIDIR RESULTADO
  -- ════════════════════════════════════════════════════════════════

  -- Sin ninguna coincidencia
  IF v_candidate_count IS NULL OR v_candidate_count = 0 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Más de un candidato con el mismo score máximo → ambiguo
  -- Se pide al usuario que ingrese más de su nombre
  IF v_best_count > 1 THEN
    RETURN jsonb_build_object('found', false, 'error', 'multiple_matches');
  END IF;

  -- Exactamente 1 candidato con el score máximo → seleccionarlo
  SELECT c.id, c.name, c.plate, c.is_general
    INTO v_customer
    FROM public.customers c
   WHERE c.is_general = false
     AND RIGHT(REGEXP_REPLACE(COALESCE(c.phone,''),'\D','','g'),4) = p_last4
     AND (
       SELECT COUNT(*)::int
         FROM unnest(v_search_tokens) tok
        WHERE tok = ANY(string_to_array(public.flw_normalize(c.name), ' '))
     ) = v_best_score
   ORDER BY c.id   -- desempate determinístico
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- 6. DATOS DE LEALTAD
  -- ════════════════════════════════════════════════════════════════

  -- Tomar el programa con mayor washes_in_cycle como el "principal"
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

  -- Cliente sin ningún programa activo → mostrar que existe pero sin historial
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found',       true,
      'customer',    jsonb_build_object('name', v_customer.name, 'plate', v_customer.plate),
      'loyalty',     NULL,
      'recentWashes', '[]'::jsonb
    );
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- 7. RECOMPENSAS DISPONIBLES
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
  -- 8. PRÓXIMA RECOMPENSA
  -- ════════════════════════════════════════════════════════════════

  -- El menor "at" que sea mayor que washes_in_cycle actual
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

  -- Si ya superó todos los hitos → próxima es la menor del siguiente ciclo
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
  -- 9. HISTORIAL RECIENTE (últimos 5 lavados del programa)
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
  -- 10. CONSTRUIR Y RETORNAR RESPUESTA
  -- ════════════════════════════════════════════════════════════════

  RETURN jsonb_build_object(
    'found',   true,
    'customer', jsonb_build_object(
      'name',  v_customer.name,
      'plate', v_customer.plate
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
    'recentWashes', v_recent_washes
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Nunca exponer detalles del error interno al cliente público
    RETURN jsonb_build_object('found', false);

END;
$$;

-- ── 4. GRANTS ─────────────────────────────────────────────────────────────────
-- Permitir al rol anon (web pública sin auth) ejecutar el RPC
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card(TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_public_loyalty_card IS
  'RPC público v2 — búsqueda flexible por tokens de nombre + phone last 4. '
  'SECURITY DEFINER. Rate limiting incluido. '
  'Retorna: found=true con tarjeta | found=false con error=multiple_matches | found=false.';

-- ── 5. VERIFICACIÓN RÁPIDA (opcional — comentar antes de ejecutar en prod) ───
-- SELECT public.flw_normalize('  PÉREZ  González ');
-- → 'perez gonzalez'
--
-- SELECT public.flw_normalize('José María López');
-- → 'jose maria lopez'
--
-- SELECT public.get_public_loyalty_card('juan', '4821', '127.0.0.1');
-- → { "found": false }   (si no existe ese cliente) o tarjeta si existe

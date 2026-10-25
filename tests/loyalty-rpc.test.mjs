import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

let db;
let lookupNumber = 0;
const program = (card, slug = 'nitido') => card.loyaltyPrograms.find(p => p.program.slug === slug);
async function card(name = 'Cliente Prueba', last4 = '1234') {
  const { rows } = await db.query('SELECT public.get_public_loyalty_card($1, $2, $3) AS card',
    [name, last4, `test-${lookupNumber++}`]);
  return rows[0].card;
}
async function addWash(id, service = 2, customer = 1) {
  await db.query(`INSERT INTO tickets VALUES ($1::bigint, $2, 'T-' || $1::text, 'paid', 'car_wash',
    '2026-01-01'::timestamptz + $1::int * interval '1 day')`, [id, customer]);
  await db.query(`INSERT INTO ticket_items(id, ticket_id, service_id) VALUES ($1, $1, $2)`, [id, service]);
}
async function addReward(id, ticket, overrides = {}) {
  const r = { slug: 'breve_gratis', group: null, status: 'available', ...overrides };
  await db.query(`INSERT INTO loyalty_rewards(id, customer_id, program_id, ticket_id, reward_name,
    reward_slug, option_group, status, earned_at) VALUES ($1, 1, 2, $2, 'Premio', $3, $4, $5,
    '2026-01-01'::timestamptz + $1::int * interval '1 day')`, [id, ticket, r.slug, r.group, r.status]);
}

before(async () => {
  db = new PGlite({ extensions: { unaccent } });
  // Table/column contract from the POS migrations; never connect to production.
  await db.exec(`
    SET timezone = 'UTC';
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE customers(id bigint PRIMARY KEY, name text, phone text, plate text,
      is_general boolean DEFAULT false, loyalty_visits int DEFAULT 99,
      loyalty_free_washes_earned int DEFAULT 10, loyalty_free_washes_used int DEFAULT 0,
      loyalty_last_visit timestamptz DEFAULT '2020-01-01');
    CREATE TABLE tickets(id bigint PRIMARY KEY, customer_id bigint REFERENCES customers,
      ticket_number text, status text, business_line text, created_at timestamptz);
    CREATE TABLE services(id bigint PRIMARY KEY, name text, is_extra boolean DEFAULT false);
    CREATE TABLE ticket_items(id bigint PRIMARY KEY, ticket_id bigint REFERENCES tickets ON DELETE CASCADE,
      service_id bigint REFERENCES services, item_type text DEFAULT 'service', service_name_snapshot text);
    CREATE TABLE loyalty_programs(id int PRIMARY KEY, name text, slug text, cycle_size int,
      rewards jsonb, active boolean DEFAULT true);
    CREATE TABLE loyalty_progress(id int PRIMARY KEY, customer_id bigint, program_id int,
      total_washes int, washes_in_cycle int, cycle_number int);
    CREATE TABLE loyalty_rewards(id int PRIMARY KEY, customer_id bigint, program_id int,
      ticket_id bigint REFERENCES tickets ON DELETE SET NULL, reward_name text, reward_slug text,
      status text DEFAULT 'available', earned_at timestamptz DEFAULT now(), expires_at timestamptz,
      option_group text, option_slug text, selected_option text, discount_percent int);
    CREATE TABLE loyalty_wash_log(id int PRIMARY KEY, customer_id bigint, program_id int,
      ticket_id bigint REFERENCES tickets ON DELETE SET NULL, service_id bigint, created_at timestamptz);
    CREATE TABLE loyalty_visits(id int PRIMARY KEY, customer_id bigint,
      ticket_id bigint REFERENCES tickets ON DELETE SET NULL, service_id bigint,
      visit_number int, earned_free_wash boolean DEFAULT false, created_at timestamptz DEFAULT now());
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
    INSERT INTO services VALUES (1, 'Servicio Premium', false), (2, 'Lavado Rápido – Nítido', false),
      (3, 'Limpieza de asientos', true), (4, 'Pasteado Premium', true), (5, 'Lavado Breve', false);
    INSERT INTO loyalty_programs VALUES
      (1, 'Premium', 'premium', 9, '[{"at":5,"reward":"Premio Premium","reward_slug":"nitido_gratis"},{"at":9,"reward":"Cerámico","reward_slug":"ceramic_wax_gratis"}]', true),
      (2, 'Nítido', 'nitido', 9, '[{"at":5,"type":"choice","options":[{"reward":"Breve gratis","reward_slug":"breve_gratis","discount_percent":100},{"reward":"Descuento","reward_slug":"breve_40pct_nitido","discount_percent":40}]},{"at":9,"type":"fixed","options":[{"reward":"Pasteado","reward_slug":"pasteado_gratis"}]}]', true);
  `);
  await db.exec(await readFile(new URL('../sql/migration_public_loyalty_rpc.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261025164213_public_loyalty_from_report_tickets.sql', import.meta.url), 'utf8'));
});
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE customers, tickets, ticket_items, loyalty_rewards, loyalty_progress,
    loyalty_wash_log, loyalty_visits, loyalty_lookup_attempts CASCADE;
    INSERT INTO customers(id, name, phone) VALUES (1, 'Cliente Prueba', '88881234'), (2, 'Otra Persona', '88885678');
    INSERT INTO loyalty_progress VALUES (1, 1, 2, 99, 0, 11);
    INSERT INTO loyalty_wash_log VALUES (1, 1, 2, NULL, 2, '2025-01-01');`);
});

test('Reports case: 5 Nítido + 2 Premium; stale progress and missing wash logs are ignored', async () => {
  for (let i = 1; i <= 7; i++) await addWash(i, [2, 1, 2, 1, 2, 2, 2][i - 1]);
  const result = await card();
  assert.equal(program(result).totalWashes, 5);
  assert.equal(program(result, 'premium').totalWashes, 2);
  assert.equal(program(result).recentWashes.length, 5);
  assert.equal(program(result).recentWashes[0].ticketNumber, 'T-7');
  assert.equal(result.customer.lastVisit, '2026-01-07T18:00:00');
  assert.equal(result.loyalty.totalWashes, 5);
});

test('deleting a ticket reduces visits, history and latest visit without updating stored progress', async () => {
  for (let i = 1; i <= 5; i++) await addWash(i);
  await db.exec('DELETE FROM tickets WHERE id = 5');
  const p = program(await card());
  assert.equal(p.totalWashes, 4);
  assert.equal(p.current, 4);
  assert.equal(p.remainingForReward, 1);
  assert.equal(p.recentWashes.length, 4);
  assert.equal(p.recentWashes[0].ticketNumber, 'T-4');
  assert.equal((await card()).customer.lastVisit, '2026-01-04T18:00:00');
});

test('three washes need two for reward #5, six for cycle #9', async () => {
  for (let i = 1; i <= 3; i++) await addWash(i);
  const p = program(await card());
  assert.equal(p.remainingForReward, 2);
  assert.equal(p.remaining, 6);
  assert.equal(p.nextMilestoneAt, 5);
});

test('programs are independent and every ticket counts once per program, excluding extras and products', async () => {
  await addWash(1);
  await db.exec(`INSERT INTO ticket_items VALUES
    (2, 1, 2, 'service', NULL), (3, 1, 3, 'service', NULL),
    (4, 1, 4, 'service', NULL), (5, 1, 1, 'product', NULL)`);
  assert.equal(program(await card()).totalWashes, 1);
  assert.equal(program(await card(), 'premium').totalWashes, 0);
  await db.exec("INSERT INTO ticket_items VALUES (6, 1, 1, 'service', NULL)");
  assert.equal(program(await card(), 'premium').totalWashes, 1);
});

test('deleted, unpaid, other-customer and barbershop tickets never contribute', async () => {
  await addWash(1); await addWash(2); await addWash(3); await addWash(4, 2, 2); await addWash(5);
  await db.exec("DELETE FROM tickets WHERE id=1; UPDATE tickets SET status='void' WHERE id=2; UPDATE tickets SET business_line='barbershop' WHERE id=3;");
  assert.equal(program(await card()).totalWashes, 1);
  assert.deepEqual(program(await card()).recentWashes.map(w => w.ticketNumber), ['T-5']);
});

test('editing a service or customer moves the visit to the correct program/customer', async () => {
  await addWash(1);
  await db.exec('UPDATE ticket_items SET service_id=1 WHERE ticket_id=1');
  assert.equal(program(await card()).totalWashes, 0);
  assert.equal(program(await card(), 'premium').totalWashes, 1);
  await db.exec('UPDATE tickets SET customer_id=2 WHERE id=1');
  assert.equal(program(await card(), 'premium').totalWashes, 0);
  assert.equal(program(await card('Otra Persona', '5678'), 'premium').totalWashes, 1);
});

test('snapshot fallback normalizes accents and rejects product-like names without a catalog wash', async () => {
  for (let i = 1; i <= 4; i++) await addWash(i, null);
  await db.exec(`UPDATE ticket_items SET service_name_snapshot = CASE id
    WHEN 1 THEN 'Lavado NÍTIDO' WHEN 2 THEN 'Premium' WHEN 3 THEN 'Cera premium'
    WHEN 4 THEN 'Lavado premiumplus' END`);
  assert.equal(program(await card()).totalWashes, 1);
  assert.equal(program(await card(), 'premium').totalWashes, 1);
});

test('cycle boundary deletion rolls cycle 2 back to cycle 1', async () => {
  for (let i = 1; i <= 9; i++) await addWash(i);
  let p = program(await card());
  assert.equal(p.current, 0); assert.equal(p.cycleNumber, 1); assert.equal(p.remainingForReward, 5);
  await db.exec('DELETE FROM tickets WHERE id=1');
  p = program(await card());
  assert.equal(p.current, 8); assert.equal(p.cycleNumber, 0); assert.equal(p.remainingForReward, 1);
});

test('available choice reward disappears if an earlier ticket is deleted below the milestone', async () => {
  for (let i = 1; i <= 5; i++) await addWash(i);
  await addReward(1, 5, { group: 'nitido_5w_c0' });
  await addReward(2, 5, { group: 'nitido_5w_c0', slug: 'breve_40pct_nitido' });
  assert.equal(program(await card()).availableRewards.length, 2);
  await db.exec('DELETE FROM tickets WHERE id=1');
  assert.equal(program(await card()).rewardUnlocked, false);
  assert.equal(program(await card()).availableRewards.length, 0);
});

test('reward whose originating ticket is deleted is hidden even when FK becomes null', async () => {
  for (let i = 1; i <= 6; i++) await addWash(i);
  await addReward(1, 5);
  await db.exec('DELETE FROM tickets WHERE id=5');
  assert.equal(program(await card()).totalWashes, 5);
  assert.equal(program(await card()).rewardUnlocked, false);
});

test('prior redeemed groups consume entitlement; deleting below the next milestone hides the next benefit', async () => {
  for (let i = 1; i <= 14; i++) await addWash(i);
  await addReward(1, 5, { group: 'nitido_5w_c0', status: 'redeemed' });
  await addReward(2, 14, { group: 'nitido_5w_c1' });
  assert.equal(program(await card()).availableRewards.length, 1);
  await db.exec('DELETE FROM tickets WHERE id=1');
  assert.equal(program(await card()).availableRewards.length, 0);
  const { rows } = await db.query('SELECT status FROM loyalty_rewards WHERE id=1');
  assert.equal(rows[0].status, 'redeemed');
});

test('totals are not limited by the five recent washes or API pagination', async () => {
  await db.exec(`INSERT INTO tickets SELECT n,1,'T-'||n,'paid','car_wash',
    '2020-01-01'::timestamptz + n * interval '1 day' FROM generate_series(1,1005) n;
    INSERT INTO ticket_items(id,ticket_id,service_id) SELECT n,n,2 FROM generate_series(1,1005) n;`);
  const p = program(await card());
  assert.equal(p.totalWashes, 1005);
  assert.equal(p.recentWashes.length, 5);
  assert.equal(p.recentWashes[0].ticketNumber, 'T-1005');
});

test('zero tickets returns zero progress, no phantom history and no latest visit', async () => {
  const result = await card();
  assert.equal(result.found, true);
  assert.equal(program(result).totalWashes, 0);
  assert.equal(result.customer.lastVisit, null);
  assert.deepEqual(program(result).recentWashes, []);
  assert.equal(result.legacy.visits, 0);
});

test('legacy history drops deleted tickets while retaining original service weights', async () => {
  for (let i = 1; i <= 3; i++) await addWash(i);
  await db.exec(`INSERT INTO loyalty_visits(id,customer_id,ticket_id,service_id,visit_number)
    VALUES (1,1,1,2,2), (2,1,2,2,3), (3,1,3,2,4); DELETE FROM tickets WHERE id=1;`);
  const result = await card();
  assert.equal(result.legacy.visits, 2);
  assert.equal(result.legacy.visitsLog.length, 2);
  assert.equal(result.legacy.visitsLog[0].visitNumber, 2);
});

test('anon can only use the existing name/phone lookup; tables remain private', async () => {
  await addWash(1);
  await db.exec('SET ROLE anon');
  try {
    assert.equal((await card()).found, true);
    assert.equal((await card('Cliente Prueba', '0000')).found, false);
    assert.equal((await card('Cliente Prueba', '12')).found, false);
    await assert.rejects(db.query('SELECT * FROM tickets'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM customers'), /permission denied/);
  } finally { await db.exec('RESET ROLE'); }
});

test('lookup rate limiting is retained', async () => {
  for (let i = 0; i < 10; i++) {
    await db.query("SELECT public.get_public_loyalty_card('Cliente Prueba','1234','same-ip')");
  }
  const { rows } = await db.query("SELECT public.get_public_loyalty_card('Cliente Prueba','1234','same-ip') AS card");
  assert.equal(rows[0].card.error, 'rate_limited');
});

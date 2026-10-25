import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server, LoyaltyCard;
before(async () => {
  server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
  });
  ({ default: LoyaltyCard } = await server.ssrLoadModule('/src/components/LoyaltyCard.tsx'));
});
after(async () => { await server?.close(); });

function fixture(current) {
  const next = current < 5 ? 5 : 9;
  const loyalty = {
    program: { name: 'Nítido', slug: 'nitido', cycleSize: 9 },
    current, required: 9, remaining: 9 - current, percentage: Math.round(current / 9 * 100),
    nextMilestoneAt: next, nextMilestoneType: 'fixed', reward: 'Premio', rewardSlug: 'premio',
    rewardUnlocked: false, availableRewards: [], milestones: [{ at: 5 }, { at: 9 }],
    totalWashes: current, cycleNumber: 0,
    recentWashes: [{ date: '2026-10-25', service: 'Lavado Nítido', ticketNumber: 'T-PRUEBA' }],
  };
  return { found: true, customer: { name: 'Cliente Prueba', plate: null },
    loyalty, loyaltyPrograms: [loyalty], recentWashes: [], legacy: null };
}

test('rendered card separates remaining cycle washes from the next reward', () => {
  const html = renderToStaticMarkup(createElement(LoyaltyCard, { data: fixture(3), onReset() {} }));
  assert.match(html, /¡Solo te faltan <strong>2<\/strong>/);
  assert.doesNotMatch(html, /Te faltan.*<strong[^>]*>6<\/strong>/);
  assert.match(html, /T-PRUEBA/);
});

test('after deletion below milestone five the rendered message uses the new progress', () => {
  const html = renderToStaticMarkup(createElement(LoyaltyCard, { data: fixture(4), onReset() {} }));
  assert.match(html, /¡Solo te faltan <strong>1<\/strong> lavado!/);
});

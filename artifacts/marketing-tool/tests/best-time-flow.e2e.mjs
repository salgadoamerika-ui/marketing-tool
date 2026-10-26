import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = path.resolve(appDirectory, '../../..');
const monthIndexes = new Map(Array.from({ length: 12 }, (_, index) => [
  new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2026, index, 1)),
  index,
]));

test('service mode create/edit stores dates, survives reload, isolates businesses and leaves posts unchanged', { timeout: 90000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const source = {
    id: 'mode-sample', businessId: 'mosaic', project: 'Insurance', title: 'Mode settings sample',
    date: '2026-09-10', contentType: 'Insight', platforms: ['Instagram'],
    distribution: 'organic', schedulingStatus: 'published', performance: { views: 100, saves: 10, bookings: 5 },
  };
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'mode test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    const readServices = () => evaluate("JSON.parse(localStorage.getItem('marketing-tool.services') ?? '[]')");
    const assertLabels = async () => assert.doesNotMatch(await evaluate('document.body.innerText'), /evergreen/i);
    const fill = async (run, selector, value) => run(`(() => {
      const input = document.querySelector(${jsString(selector)});
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${jsString(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const fillDates = async (start, end) => {
      await evaluate(`(() => {
        const inputs = document.querySelectorAll('.sm-form input[type="date"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        [${jsString(start)}, ${jsString(end)}].forEach((value, index) => {
          setter.call(inputs[index], value);
          inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
          inputs[index].dispatchEvent(new Event('change', { bubbles: true }));
        });
      })()`);
    };
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify([source]))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after seed');
    assert.equal((await readServices()).length, 15);
    await clickButtonText(evaluate, 'Manage services');
    const visualStyles = await evaluate(`(() => {
      const dialog = document.querySelector('.sm-dialog');
      const heading = document.querySelector('.sm-title');
      const button = document.querySelector('.manage-services');
      return {
        dialogWidth: parseFloat(getComputedStyle(dialog).width),
        dialogRadius: getComputedStyle(dialog).borderRadius,
        headingFont: getComputedStyle(heading).fontFamily,
        buttonRadius: getComputedStyle(button).borderRadius,
      };
    })()`);
    assert.ok(visualStyles.dialogWidth <= 650);
    assert.equal(visualStyles.dialogRadius, '20px');
    assert.match(visualStyles.headingFont, /Fraunces/);
    assert.equal(visualStyles.buttonRadius, '999px', 'The text button should be a pill rather than an oversized circle.');
    await click(evaluate, 'button[aria-label="Edit Insurance"]');
    assert.equal(await evaluate("document.querySelectorAll('.sm-form input[type=\"date\"]').length"), 0);
    const choiceText = await evaluate("document.querySelector('.sm-form').innerText");
    assert.match(choiceText, /Something you offer ongoing — no end date\./);
    assert.match(choiceText, /A push toward a deadline\./);
    await click(evaluate, '.sm-form input[value="campaign"]');
    await clickButtonText(evaluate, 'Save');
    assert.match(await evaluate("document.querySelector('.sm-error').innerText"), /start date and a deadline/);
    assert.equal((await readServices()).find((s) => s.id === 'mosaic:Insurance').mode, 'evergreen');
    await fillDates('2026-09-01', '2026-10-31');
    await clickButtonText(evaluate, 'Save');
    await waitFor(async () => (await readServices()).find((s) => s.id === 'mosaic:Insurance')?.mode === 'campaign', 'saved campaign');
    assert.equal((await readServices()).find((s) => s.id === 'northline:Insurance').mode, 'evergreen');
    await assertLabels();
    await click(evaluate, '.sm-header button');
    await openPost(evaluate, source);
    assert.match(await evaluate("document.querySelector('.post-detail-list').innerText"), /Mode\nCampaign/i);
    assert.match(await evaluate("document.querySelector('.post-detail-list').innerText"), /Deadline/i);
    assert.deepEqual(
      await evaluate("[...document.querySelectorAll('.post-detail-actions button')].map((button) => button.textContent.trim())"),
      ['Mark done', 'Skip', 'Delete post'],
    );
    assert.doesNotMatch(await evaluate("document.querySelector('.post-detail-modal').innerText"), /Keep post|Suggest next posts/);
    await browser.resize(360, 760);
    const actionLayout = await evaluate(`(() => {
      const actions = document.querySelector('.post-detail-actions');
      const buttons = [...actions.querySelectorAll('button')].map((button) => button.getBoundingClientRect());
      return {
        rowTops: buttons.map((rect) => Math.round(rect.top)),
        rightWithinModal: Math.max(...buttons.map((rect) => rect.right))
          <= document.querySelector('.post-detail-modal').getBoundingClientRect().right,
      };
    })()`);
    assert.equal(new Set(actionLayout.rowTops).size, 1, 'All three actions stay on a single row on narrow screens.');
    assert.equal(actionLayout.rightWithinModal, true, 'The actions stay within the popup.');
    await click(evaluate, '.post-modal-header .modal-close');
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'reload after campaign edit');
    await clickButtonText(evaluate, 'Manage services');
    await click(evaluate, 'button[aria-label="Edit Insurance"]');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.sm-form input[type=\"date\"]')].map(input => input.value)"), ['2026-09-01', '2026-10-31']);
    await click(evaluate, '.sm-form input[value="evergreen"]');
    await clickButtonText(evaluate, 'Save');
    const ongoing = (await readServices()).find((s) => s.id === 'mosaic:Insurance');
    assert.equal(ongoing.mode, 'evergreen');
    assert.equal('startDate' in ongoing, false);
    assert.equal('endDate' in ongoing, false);

    await clickButtonText(evaluate, 'Add service');
    await fill(evaluate, '.sm-form input[type="text"]', 'Winter intake');
    await click(evaluate, '.sm-platform-fieldset .platform-option:nth-child(1)');
    await click(evaluate, '.sm-platform-fieldset .platform-option:nth-child(3)');
    await click(evaluate, '.sm-form input[value="campaign"]');
    await fillDates('2026-11-01', '2026-12-01');
    await clickButtonText(evaluate, 'Save');
    const added = (await readServices()).find((s) => s.name === 'Winter intake');
    assert.equal(added.mode, 'campaign');
    assert.equal(added.businessId, 'mosaic');
    assert.equal(added.endDate, '2026-12-01');
    assert.deepEqual(added.platforms, ['Instagram']);
    assert.ok(added.tone);
    assert.equal(await evaluate("document.querySelector('.sm-confirmation h3')?.textContent.trim()"), 'Winter intake is live');
    assert.match(await evaluate("document.querySelector('.sm-confirmation-copy')?.textContent"), /calendar color.*airtime balance.*performance learning/i);
    assert.match(await evaluate("document.querySelector('.sm-confirmation-platforms')?.textContent"), /Instagram/);
    await waitFor(
      () => evaluate("[...document.querySelectorAll('.monthly-airtime-name')].some((item) => item.textContent.trim() === 'Winter intake')"),
      'new service airtime row',
    );
    assert.equal(
      await evaluate("[...document.querySelectorAll('.legend-item')].find((item) => item.textContent.trim() === 'Winter intake')?.querySelector('.legend-swatch')?.className"),
      `legend-swatch event-${added.tone}`,
      'The service gets its own calendar color.',
    );
    await clickButtonText(evaluate, 'Add service');
    await fill(evaluate, '.sm-form input[type="text"]', 'insurance');
    await clickButtonText(evaluate, 'Save');
    assert.match(await evaluate("document.querySelector('.sm-error').innerText"), /already used/);
    await clickButtonText(evaluate, 'Cancel');
    await assertLabels();
    await click(evaluate, '.sm-header button');
    await clickButtonText(evaluate, 'Add post');
    assert.ok(await evaluate("[...document.querySelector('.post-form select').options].some(option => option.value === 'Winter intake')"));
    await evaluate(`(() => {
      const serviceSelect = document.querySelector('.post-form select');
      serviceSelect.value = 'Winter intake';
      serviceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    assert.deepEqual(
      await evaluate("[...document.querySelectorAll('.post-form .platform-option.selected')].map((item) => item.textContent.trim())"),
      ['Instagram'],
      'The service platform setup is used as the default for its posts.',
    );
    assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts'))"), [source]);
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('business tabs isolate posts, insights, services and airtime; new workspaces persist independently', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const mosaicPost = {
    id: 'workspace-mosaic-post', businessId: 'mosaic', project: 'Insurance',
    title: 'Mosaic-only workspace post', date: '2026-09-19', contentType: 'Insight',
    platforms: ['Instagram'], distribution: 'organic', schedulingStatus: 'published',
  };
  const northlinePost = {
    id: 'workspace-northline-post', businessId: 'northline', project: 'Insurance',
    title: 'Northline-only workspace post', date: '2026-09-19', contentType: 'Insight',
    platforms: ['Instagram'], distribution: 'organic', schedulingStatus: 'published',
  };
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'business workspace test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    const readServices = () => evaluate("JSON.parse(localStorage.getItem('marketing-tool.services') ?? '[]')");
    const airtimeNames = () => evaluate(
      "[...document.querySelectorAll('.monthly-airtime-name')].map((item) => item.textContent.trim())",
    );

    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify([mosaicPost, northlinePost]))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'business calendar after seed');
    assert.match(await evaluate('document.body.innerText'), /Mosaic-only workspace post/);
    assert.doesNotMatch(await evaluate('document.body.innerText'), /Northline-only workspace post/);

    await clickButtonText(evaluate, 'Manage services');
    await clickButtonText(evaluate, 'Add service');
    await setField(evaluate, '.sm-form input[type="text"]', 'Mosaic custom service');
    await clickButtonText(evaluate, 'Save');
    await waitFor(async () => (await readServices()).some((service) => service.name === 'Mosaic custom service'), 'Mosaic service save');
    await click(evaluate, '.sm-header button');

    await click(evaluate, 'button[aria-label="Open saved post: Mosaic-only workspace post"]');
    await clickButtonText(evaluate, 'Mark done');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-popup'))"), 'Mosaic insight');
    await click(evaluate, '.post-modal-header .modal-close');
    await evaluate("if (document.scrollingElement) document.scrollingElement.scrollTop = 0");
    await waitFor(() => evaluate('window.scrollY === 0'), 'calendar tabs back in view');
    await browser.clickVisible('.business-tabs .business-tab:nth-child(2)');
    await waitFor(
      () => evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim() === 'Northline Financial'"),
      'Northline tab switch',
    );
    assert.doesNotMatch(await evaluate('document.body.innerText'), /Mosaic-only workspace post/);
    assert.match(await evaluate('document.body.innerText'), /Northline-only workspace post/);
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-popup'))"), false);
    assert.equal((await airtimeNames()).includes('Mosaic custom service'), false);

    await clickButtonText(evaluate, 'Manage services');
    await clickButtonText(evaluate, 'Add service');
    await setField(evaluate, '.sm-form input[type="text"]', 'Northline custom service');
    await clickButtonText(evaluate, 'Save');
    await waitFor(async () => (await readServices()).some((service) => service.name === 'Northline custom service'), 'Northline service save');
    assert.equal((await readServices()).find((service) => service.name === 'Northline custom service').businessId, 'northline');
    await click(evaluate, '.sm-header button');
    assert.ok((await airtimeNames()).includes('Northline custom service'));

    await browser.clickVisible('button[aria-label="Add a business"]');
    await waitFor(() => evaluate("Boolean(document.querySelector('.business-dialog'))"), 'new business form');
    await setField(evaluate, '#business-name', 'Atlas Studio');
    await browser.clickVisible('label[for="business-accent-sage"]');
    await setField(evaluate, '#business-service-name', 'Atlas onboarding');
    await evaluate("document.querySelector('.business-dialog').scrollTop = document.querySelector('.business-dialog').scrollHeight");
    await browser.clickVisible('.business-mode-option input[value="campaign"]');
    await setField(evaluate, '#business-campaign-deadline', '2026-12-20');
    await evaluate("document.querySelector('.business-dialog').scrollTop = document.querySelector('.business-dialog').scrollHeight");
    await browser.clickVisible('label[for="business-platform-0"]');
    await evaluate("document.querySelector('.business-dialog').scrollTop = document.querySelector('.business-dialog').scrollHeight");
    await browser.clickVisible('.business-setup-form button[type="submit"]');
    await waitFor(
      () => evaluate("document.querySelector('.business-dialog h2')?.textContent.trim() === 'Atlas Studio is ready'"),
      'business setup confirmation',
    );
    assert.equal(
      await evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim()"),
      'Northline Financial',
      'The new business becomes active only after the confirmation step.',
    );
    assert.match(await evaluate("document.querySelector('.business-dialog').innerText"), /Its own calendar and business tab/);
    assert.match(await evaluate("document.querySelector('.business-dialog').innerText"), /Its own airtime balance across its services/);
    assert.match(await evaluate("document.querySelector('.business-dialog').innerText"), /An independent posting rhythm and check-in/);
    assert.match(await evaluate("document.querySelector('.business-dialog').innerText"), /Separate performance tracking, learning, and suggestions/);
    const atlasId = await evaluate(
      "JSON.parse(localStorage.getItem('marketing-tool.businesses')).find((business) => business.name === 'Atlas Studio').id",
    );
    const atlasBusiness = await evaluate(
      `JSON.parse(localStorage.getItem('marketing-tool.businesses')).find((business) => business.id === ${jsString(atlasId)})`,
    );
    assert.equal(atlasBusiness.accent, 'sage');
    assert.deepEqual(atlasBusiness.platforms, ['Instagram', 'TikTok']);
    const atlasFirstService = (await readServices()).find((service) => service.businessId === atlasId);
    assert.equal(atlasFirstService.name, 'Atlas onboarding');
    assert.equal(atlasFirstService.mode, 'campaign');
    assert.equal(atlasFirstService.endDate, '2026-12-20');
    assert.deepEqual(atlasFirstService.platforms, ['Instagram', 'TikTok']);
    assert.equal(atlasFirstService.tone, 'sage');
    assert.match(
      await evaluate("document.querySelector('.business-created-service')?.textContent"),
      /Campaign · deadline Dec 20, 2026/,
    );
    assert.match(await evaluate("document.querySelector('.business-created-platforms')?.textContent"), /Instagram · TikTok/);

    await browser.clickVisible('.business-open-button');
    await waitFor(
      () => evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim() === 'Atlas Studio'"),
      'new workspace activation',
    );
    assert.equal(await evaluate("document.querySelectorAll('.event-chip-button').length"), 0);
    assert.deepEqual(await airtimeNames(), ['Atlas onboarding']);

    await clickButtonText(evaluate, 'Manage services');
    assert.match(await evaluate("document.querySelector('.sm-list').innerText"), /Atlas onboarding/);
    await clickButtonText(evaluate, 'Add service');
    await setField(evaluate, '.sm-form input[type="text"]', 'Atlas follow-up');
    await clickButtonText(evaluate, 'Save');
    await waitFor(async () => (await readServices()).some((service) => service.name === 'Atlas follow-up'), 'Atlas service save');
    assert.equal((await readServices()).find((service) => service.name === 'Atlas follow-up').businessId, atlasId);
    await click(evaluate, '.sm-header button');
    assert.deepEqual(await airtimeNames(), ['Atlas onboarding', 'Atlas follow-up']);

    await click(evaluate, 'button.add-post');
    await waitFor(() => evaluate("Boolean(document.querySelector('.post-form'))"), 'post form with business platform defaults');
    assert.deepEqual(
      await evaluate("[...document.querySelectorAll('.platform-option.selected')].map((item) => item.textContent.trim())"),
      ['Instagram', 'TikTok'],
      'New posts start with only this business’s selected platforms.',
    );

    await browser.reload();
    await waitFor(
      () => evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim() === 'Atlas Studio'"),
      'saved workspace after reload',
    );
    assert.equal(await evaluate("localStorage.getItem('marketing-tool.active-business-id')"), atlasId);
    assert.deepEqual(
      await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts'))"),
      [{ ...mosaicPost, isCompleted: true }, northlinePost],
      'Completion remains saved while the new business starts without posts.',
    );
    assert.deepEqual(await airtimeNames(), ['Atlas onboarding', 'Atlas follow-up']);
    assert.equal(await evaluate("document.querySelectorAll('.event-chip-button').length"), 0);

    await browser.clickVisible('.business-tabs .business-tab:nth-child(1)');
    await waitFor(
      () => evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim() === 'Mosaic Legal'"),
      'Mosaic workspace after reload',
    );
    assert.match(await evaluate('document.body.innerText'), /Mosaic-only workspace post/);
    assert.doesNotMatch(await evaluate('document.body.innerText'), /Northline-only workspace post/);
    assert.ok((await airtimeNames()).includes('Northline custom service') === false);
    assert.ok((await airtimeNames()).includes('Atlas onboarding') === false);
    assert.ok((await airtimeNames()).includes('Mosaic custom service'));
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('an approved planned post moves to the newly suggested date only after Add', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const dateAfter = (date, days) => {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const today = new Date().toISOString().slice(0, 10);
  const futureMonth = new Date(`${dateAfter(today, 400)}T12:00:00`);
  futureMonth.setMonth(futureMonth.getMonth() + 1, 0);
  const sourceDate = futureMonth.toISOString().slice(0, 10);
  const suggestedDate = dateAfter(sourceDate, 7);
  const priorDate = dateAfter(sourceDate, 3);
  const source = {
    id: 'move-date-source', businessId: 'mosaic', project: 'Insurance', title: 'Move-date source',
    date: sourceDate, contentType: 'Insight', platforms: ['Instagram'], distribution: 'organic',
  };
  const prior = {
    ...source, id: 'move-date-approved', title: 'Earlier approved booking post', contentType: 'Book now',
    date: priorDate, schedulingStatus: 'approved-suggestion', sourcePostId: 'previous-source',
  };
  const readPosts = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'date-move test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'date-move calendar');
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify([source, prior]))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'seeded date-move calendar');
    await openPost(evaluate, source);
    await clickButtonText(evaluate, 'Mark done');
    await waitFor(
      () => evaluate("document.querySelector('.action-insight-popup')?.textContent.includes('Suggested update to a planned post')"),
      'proposed move in the suggestion popup',
    );
    const popup = await evaluate("document.querySelector('.action-insight-popup').innerText");
    assert.match(popup, /Earlier approved booking post/);
    assert.match(popup, /Apply suggested changes/);
    assert.match(popup, new RegExp(new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(`${suggestedDate}T12:00:00`))));
    assert.equal((await readPosts(evaluate)).find((post) => post.id === prior.id).date, priorDate,
      'Opening the popup must not move the approved post.');

    await browser.resize(390, 640);
    await evaluate("document.querySelector('.action-insight-content').scrollTop = document.querySelector('.action-insight-content').scrollHeight");
    await browser.clickVisible('.action-insight-close');
    assert.equal((await readPosts(evaluate)).find((post) => post.id === prior.id).date, priorDate,
      'Closing a scrolled popup must not apply a move.');
    await evaluate(`(() => {
      const saved = JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]');
      const sourcePost = saved.find((post) => post.id === ${jsString(source.id)});
      delete sourcePost.isCompleted;
      localStorage.setItem('marketing-tool.user-posts', JSON.stringify(saved));
    })()`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after resetting completion');
    await openPost(evaluate, source);
    await clickButtonText(evaluate, 'Mark done');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-add'))"), 'reopened move popup');
    await browser.clickVisible('.action-insight-add');
    await waitFor(async () => (await readPosts(evaluate)).find((post) => post.id === prior.id)?.date === suggestedDate,
      'approved post moved after Add');
    let saved = await readPosts(evaluate);
    assert.equal(saved.filter((post) => post.id === prior.id).length, 1, 'The original post is updated, not duplicated.');
    assert.equal(saved.find((post) => post.id === prior.id).contentType, 'Book now');
    assert.equal(saved.some((post) => post.id === prior.id && post.date === priorDate), false);
    assert.equal(await evaluate("Boolean(document.querySelector('[aria-labelledby=\"selected-post-title\"]'))"), false);
    assert.equal(await evaluate("document.querySelector('.month-nav-label').textContent.trim()"),
      new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${suggestedDate}T12:00:00`)),
      'Applying a suggestion must show its calendar month.');
    const movedTitle = saved.find((post) => post.id === prior.id).title;
    assert.equal(await evaluate(`(() => {
      const event = [...document.querySelectorAll('button.event-chip-button')]
        .find((button) => button.textContent.includes(${jsString(movedTitle)}));
      return event?.closest('.day-cell')?.querySelector('.day-number')?.textContent.trim();
    })()`), String(Number(suggestedDate.slice(-2))), 'The moved post is rendered on its new day.');

    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'date-move reload');
    saved = await readPosts(evaluate);
    assert.equal(saved.find((post) => post.id === prior.id).date, suggestedDate,
      'The new placement persists after reload.');
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('Campaign Add keeps completed posts and builds approved closing posts up to the deadline', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const dateAfter = (date, days) => {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + days);
    return value.toISOString().slice(0, 10);
  };
  let today;
  let campaign;
  let source;
  let completed;
  let pastApproved;
  let futurePosts;
  let startingPosts;
  const readPosts = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'Campaign approval test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'Campaign calendar');
    today = await evaluate(`(() => {
      const day = new Date();
      return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
    })()`);
    campaign = { startDate: dateAfter(today, -20), endDate: dateAfter(today, 10) };
    source = {
      id: 'campaign-history-source', businessId: 'mosaic', project: 'Insurance',
      title: 'Final-week announcement', date: today, contentType: 'Announcement',
      platforms: ['Instagram'], distribution: 'organic',
    };
    completed = {
      ...source, id: 'campaign-completed-post', title: 'Completed trust post', contentType: 'Testimonial',
      date: dateAfter(today, -2), schedulingStatus: 'published',
      performance: { views: 640, saves: 31, bookings: 8 },
    };
    pastApproved = {
      ...source, id: 'campaign-past-approved', title: 'Earlier approved post', contentType: 'Inside look',
      date: dateAfter(today, -1), schedulingStatus: 'approved-suggestion', sourcePostId: source.id,
    };
    futurePosts = [
      {
        ...source, id: 'campaign-future-one', title: 'Future booking post', contentType: 'Book now',
        date: dateAfter(today, 4), schedulingStatus: 'approved-suggestion', sourcePostId: source.id,
      },
      {
        ...source, id: 'campaign-future-two', title: 'Future experience post', contentType: 'Inside look',
        date: dateAfter(today, 6), schedulingStatus: 'approved-suggestion', sourcePostId: source.id,
      },
    ];
    startingPosts = [completed, pastApproved, source, ...futurePosts];
    const services = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.services') ?? '[]')");
    const insurance = services.find((item) => item.businessId === source.businessId && item.name === source.project);
    assert.ok(insurance, 'The test calendar should contain the Insurance service.');
    const campaignService = { ...insurance, mode: 'campaign', ...campaign };
    const savedServices = [...services.filter((item) => item.id !== insurance.id), campaignService];
    await evaluate(`localStorage.setItem('marketing-tool.services', ${jsString(JSON.stringify(savedServices))});
      localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify(startingPosts))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'seeded Campaign calendar');

    await openPost(evaluate, source);
    await clickButtonText(evaluate, 'Mark done');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-add'))"), 'closing suggestions');
    const initial = await readPosts(evaluate);
    assert.deepEqual(initial, startingPosts.map((post) =>
      post.id === source.id ? { ...post, isCompleted: true } : post),
    'Completing the source post must mark it done without adding a suggestion.');
    await browser.clickVisible('.action-insight-add');
    await waitFor(async () => {
      const saved = await readPosts(evaluate);
      return saved.find((post) => post.id === futurePosts[0].id)?.date === dateAfter(today, 2)
        && saved.find((post) => post.id === futurePosts[1].id)?.date < futurePosts[1].date
        && saved.some((post) => post.contentType === 'Last chance' && post.sourcePostId === source.id);
    }, 'Campaign suggestions applied without losing earlier posts');

    let saved = await readPosts(evaluate);
    for (const history of [completed, pastApproved]) {
      const kept = saved.filter((post) => post.id === history.id);
      assert.equal(kept.length, 1, `${history.id} must not be deleted or duplicated.`);
      assert.deepEqual(
        { title: kept[0].title, contentType: kept[0].contentType, date: kept[0].date,
          schedulingStatus: kept[0].schedulingStatus, performance: kept[0].performance },
        { title: history.title, contentType: history.contentType, date: history.date,
          schedulingStatus: history.schedulingStatus, performance: history.performance },
        `${history.id} must keep its completed or past details.`,
      );
    }
    for (const future of futurePosts) {
      assert.equal(saved.filter((post) => post.id === future.id).length, 1,
        'An approved future post should move in place rather than duplicate.');
    }
    let approvedCampaignPosts = saved.filter((post) => post.businessId === source.businessId
      && post.project === source.project && post.schedulingStatus === 'approved-suggestion' && post.date >= today);
    assert.ok(approvedCampaignPosts.length >= 3);
    assert.ok(approvedCampaignPosts.every((post) => post.date <= campaign.endDate),
      'Campaign suggestions must stop at the deadline.');

    const lastChance = saved.find((post) => post.sourcePostId === source.id && post.contentType === 'Last chance');
    assert.ok(lastChance);
    await openPost(evaluate, lastChance);
    await clickButtonText(evaluate, 'Mark done');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-add'))"), 'remaining deadline dates');
    await browser.clickVisible('.action-insight-add');
    await waitFor(async () => (await readPosts(evaluate)).filter((post) => post.businessId === source.businessId
      && post.project === source.project && post.schedulingStatus === 'approved-suggestion' && post.date >= today)
      .length > approvedCampaignPosts.length,
    'additional Campaign posts added through the deadline');
    saved = await readPosts(evaluate);
    approvedCampaignPosts = saved.filter((post) => post.businessId === source.businessId
      && post.project === source.project && post.schedulingStatus === 'approved-suggestion' && post.date >= today);
    assert.ok(approvedCampaignPosts.every((post) => post.date <= campaign.endDate));
    assert.equal(saved.filter((post) => post.id === completed.id).length, 1);
    assert.equal(saved.filter((post) => post.id === pastApproved.id).length, 1);
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('season month settings stay in the Month at a glance bubble and persist independently for every service', { timeout: 90000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const services = ['Fall programs', 'Tax planning', 'Divorce', 'Immigration', 'Insurance'];
  const key = (business, service) => JSON.stringify([business, service]);
  const readSeasons = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.service-seasons') ?? '{}')");
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'season selection test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    assert.equal(await evaluate("document.querySelectorAll('.monthly-airtime-row').length"), 5);
    assert.equal(await evaluate("document.querySelectorAll('.monthly-airtime-row [aria-label^=\"Set \"]').length"), 5);
    assert.equal(await evaluate("Boolean([...document.querySelectorAll('.monthly-airtime-row button')].every(button => button.closest('.monthly-airtime')) && document.querySelector('.insight-card.tint .monthly-airtime'))"), true);

    const selectedMonths = [1, 2, 3, 4, 9];
    for (let index = 0; index < services.length; index += 1) {
      const service = services[index];
      await click(evaluate, `[aria-label="Set ${service} in-season months"]`);
      assert.equal(await evaluate("document.querySelectorAll('.season-month-dialog .airtime-month-toggle').length"), 12);
      await clickButtonText(evaluate, ['January', 'February', 'March', 'April', 'September'][index]);
      await clickButtonText(evaluate, 'Save');
      assert.deepEqual((await readSeasons(evaluate))[key('mosaic', service)], [selectedMonths[index]]);
    }
    assert.equal(await evaluate("document.querySelectorAll('.monthly-airtime-season').length"), 1, 'The selected calendar month is marked in season.');
    await selectBusiness(evaluate, 'Northline Financial');
    assert.equal(await evaluate("document.querySelectorAll('.monthly-airtime-row').length"), 5);
    await click(evaluate, '[aria-label="Set Insurance in-season months"]');
    assert.equal(await evaluate("Boolean(document.querySelector('.season-month-dialog .airtime-month-toggle[aria-pressed=\"true\"]'))"), false);
    await clickButtonText(evaluate, 'August');
    await clickButtonText(evaluate, 'Save');
    assert.deepEqual((await readSeasons(evaluate))[key('northline', 'Insurance')], [8]);
    assert.deepEqual((await readSeasons(evaluate))[key('mosaic', 'Insurance')], [9]);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after saving service seasons');
    assert.deepEqual(await readSeasons(evaluate), {
      [key('mosaic', 'Fall programs')]: [1],
      [key('mosaic', 'Tax planning')]: [2],
      [key('mosaic', 'Divorce')]: [3],
      [key('mosaic', 'Immigration')]: [4],
      [key('mosaic', 'Insurance')]: [9],
      [key('northline', 'Insurance')]: [8],
    });
    assert.equal(
      await evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim()"),
      'Northline Financial',
      'The selected business workspace is restored after reload.',
    );
    await click(evaluate, 'button[aria-label="Previous month"]');
    assert.equal(await evaluate("document.querySelectorAll('.monthly-airtime-season').length"), 1, 'The active month-season indicator returns after reload.');
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('Week view shares posts, stacks days, shifts seven days and keeps businesses isolated', { timeout: 90000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const base = {
    businessId: 'mosaic', project: 'Insurance', contentType: 'Insight',
    platforms: ['Instagram'], postedTime: '11:00', distribution: 'organic',
    schedulingStatus: 'published',
  };
  const posts = [
    { ...base, id: 'week-mon-1', title: 'Monday one', date: '2026-08-31' },
    { ...base, id: 'week-mon-2', title: 'Monday two', date: '2026-08-31' },
    { ...base, id: 'week-suggestion', title: 'Sunday suggestion', date: '2026-09-06', schedulingStatus: 'approved-suggestion' },
    { ...base, id: 'week-next', title: 'Following week', date: '2026-09-07' },
    { ...base, id: 'week-last-week', title: 'Post needing last week results', date: '2026-08-30' },
    { ...base, id: 'week-last-week-second', title: 'Another previous-week post', date: '2026-08-29', project: 'Fall programs', contentType: 'Announcement', platforms: ['Facebook'] },
    { ...base, id: 'week-prior-other', title: 'Other business previous-week post', date: '2026-08-29', businessId: 'northline' },
    { ...base, id: 'week-other', title: 'Other business only', date: '2026-08-31', businessId: 'northline' },
  ];
  const selector = (id) => `[data-testid="${id}"]`;
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'week test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await browser.resize(1440, 1000);
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify(posts))})`);
    await browser.reload();
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate("Boolean(document.querySelector('.week-calendar'))"), 'Week layout');
    assert.equal(await evaluate("Boolean(document.querySelector('.calendar-grid'))"), false);
    assert.equal(await evaluate("Boolean(document.querySelector('.sidebar'))"), false, 'Monthly balance and legends stay out of Week view');
    assert.match(await evaluate(`document.querySelector(${jsString(selector('text-week-range'))}).textContent`), /Aug 31.*Sep 6, 2026/);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-testid^=\"column-week-day-\"]')].map(el => el.dataset.testid)"),
      ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'].map(date => `column-week-day-${date}`));
    assert.match(await evaluate(`document.querySelector(${jsString(selector('text-week-progress'))}).textContent`), /0 of 3 moves done this week/);
    assert.equal(await evaluate(`document.querySelector(${jsString(selector('column-week-day-2026-08-31'))}).querySelectorAll('.week-post').length`), 2);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector(${jsString(selector('card-week-post-week-suggestion'))})).borderStyle`), 'dotted');
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-week-post-week-other'))}))`), false);
    await evaluate(`document.querySelector(${jsString(selector('label-completion-week-suggestion'))}).scrollIntoView({block:'center', inline:'center'})`);
    await browser.clickVisible(selector('label-completion-week-suggestion'));
    await waitFor(() => evaluate(`JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post => post.id === 'week-suggestion')?.isCompleted === true`), 'saved completion state');
    assert.match(await evaluate(`document.querySelector(${jsString(selector('text-week-progress'))}).textContent`), /1 of 3 moves done this week/);
    assert.equal(await evaluate(`document.querySelector(${jsString(selector('card-week-post-week-suggestion'))}).classList.contains('week-post-completed')`), true);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector(${jsString(selector('card-week-post-week-suggestion'))}).querySelector('.week-post-title')).textDecorationLine`), 'line-through');
    await resolveInsight(evaluate, 'skip');
    await browser.clickVisible(selector('button-next-week'));
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(selector('card-week-post-week-next'))}))`), 'following week post');
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-week-post-week-mon-1'))}))`), false);
    assert.match(
      await evaluate(`(() => {
        const total = document.querySelectorAll('.week-calendar .week-post-completion').length;
        return document.querySelector(${jsString(selector('text-week-progress'))}).textContent + '|' + total;
      })()`),
      /0 of \d+ moves done this week\.\|\d+/,
      'Progress recalculates for the newly displayed week',
    );
    await browser.clickVisible(selector('button-previous-week'));
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(selector('card-week-post-week-mon-1'))}))`), 'previous week post');
    await evaluate(`document.querySelector(${jsString(selector('button-add-post-2026-09-01'))}).scrollIntoView({block:'center', inline:'center'})`);
    await browser.clickVisible(selector('button-add-post-2026-09-01'));
    await waitFor(() => evaluate("Boolean(document.querySelector('input[aria-label=\"Post date\"]'))"), 'existing Add Post form');
    assert.equal(await evaluate("document.querySelector('input[aria-label=\"Post date\"]').value"), '2026-09-01');
    await clickButtonText(evaluate, 'Cancel');
    await evaluate("window.scrollTo(0,0); document.querySelector('[data-testid=\"calendar-week-scroll\"]').scrollLeft = 0");
    await browser.clickVisible(selector('button-upload-insights'));
    const picker = selector('select-weekly-insights-post');
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(picker)}))`), 'previous-week post picker');
    assert.equal(await evaluate("Boolean(document.querySelector('.weekly-insights-modal .post-performance'))"), false, 'Choose a post before the results form appears');
    assert.deepEqual(await evaluate(`Array.from(document.querySelector(${jsString(picker)}).options).map(option => option.value)`),
      ['', 'week-last-week', 'week-last-week-second'], 'Only the active business’s previous-week posts are offered');
    assert.match(await evaluate(`document.querySelector(${jsString(picker)}).textContent`), /Insurance · Insight · Instagram · Aug 30/);
    assert.match(await evaluate(`document.querySelector(${jsString(picker)}).textContent`), /Fall programs · Announcement · Facebook · Aug 29/);
    await setField(evaluate, picker, 'week-last-week');
    await waitFor(() => evaluate("Boolean(document.querySelector('.weekly-insights-modal .post-performance input[type=\"number\"]'))"), 'existing results form for the chosen post');
    const metricInput = (index) => `.weekly-insights-modal .post-performance-fields label:nth-of-type(${index}) input`;
    await setField(evaluate, metricInput(1), '331');
    await setField(evaluate, metricInput(2), '14');
    await setField(evaluate, metricInput(3), '2');
    await browser.clickVisible('.weekly-insights-modal .post-performance button[type="submit"]');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post => post.id === 'week-last-week')?.performance?.views === 331"), 'results saved on the selected post');
    await setField(evaluate, picker, 'week-last-week-second');
    await waitFor(() => evaluate(`document.querySelector(${jsString(metricInput(1))})?.value === ''`), 'fresh form for the next chosen post');
    await setField(evaluate, metricInput(1), '77');
    await setField(evaluate, metricInput(2), '4');
    await setField(evaluate, metricInput(3), '1');
    await browser.clickVisible('.weekly-insights-modal .post-performance button[type="submit"]');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post => post.id === 'week-last-week-second')?.performance?.views === 77"), 'second post results saved without closing the flow');
    await browser.clickVisible('button[aria-label="Close weekly insights"]');
    await browser.reload();
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate(`document.querySelector(${jsString(selector('checkbox-done-week-suggestion'))})?.checked === true`), 'completion after refresh');
    await browser.clickVisible(selector('button-calendar-month'));
    await waitFor(() => evaluate("Boolean(document.querySelector('.calendar-grid'))"), 'Month view after Week');
    assert.equal(await evaluate("Boolean(document.querySelector('.event-chip-completed'))"), true, 'Month view reflects the same completed post');
    await browser.clickVisible('button[aria-label="Previous month"]');
    const monthlyResultPost = '.event-chip-button[aria-label^="Open saved post: Post needing last week results"]';
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(monthlyResultPost)}))`), 'saved previous-week post in Month');
    await evaluate(`document.querySelector(${jsString(monthlyResultPost)}).scrollIntoView({block:'center'})`);
    await browser.clickVisible(monthlyResultPost);
    await waitFor(() => evaluate("document.querySelector('#selected-post-title')?.textContent === 'Post needing last week results'"), 'Month results form');
    assert.equal(await evaluate("document.querySelector('.post-performance-fields label:nth-of-type(1) input').value"), '331', 'Month reads the exact results saved from Week');
    await setField(evaluate, '.post-performance-fields label:nth-of-type(1) input', '444');
    await evaluate("document.querySelector('.post-performance button[type=\"submit\"]').scrollIntoView({block:'center'})");
    await browser.clickVisible('.post-performance button[type="submit"]');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post => post.id === 'week-last-week')?.performance?.views === 444"), 'Month updates the same post performance');
    await evaluate("document.querySelector('button[aria-label=\"Close saved post details\"]').scrollIntoView({block:'center'})");
    await browser.clickVisible('button[aria-label="Close saved post details"]');
    await evaluate('window.scrollTo(0,0)');
    await browser.clickVisible('button[aria-label="Next month"]');
    await browser.clickVisible(selector('button-calendar-week'));
    await browser.clickVisible(selector('button-upload-insights'));
    await setField(evaluate, picker, 'week-last-week');
    await waitFor(() => evaluate(`document.querySelector(${jsString(metricInput(1))})?.value === '444'`), 'Week reads the exact results updated in Month');
    await browser.clickVisible('button[aria-label="Close weekly insights"]');
    await browser.clickVisible(selector('button-calendar-month'));
    await selectBusiness(evaluate, 'Northline Financial');
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate("Boolean(document.querySelector('.week-calendar'))"), 'Northline Week view');
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-week-post-week-mon-1'))}))`), false);
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-week-post-week-other'))}))`), true);
    await browser.resize(390, 844);
    const sticky = await evaluate(`(() => {
      const scroll = document.querySelector('[data-testid="calendar-week-scroll"]');
      const card = document.querySelector('[data-testid="card-week-checkin"]');
      const before = card.getBoundingClientRect().left;
      scroll.scrollLeft = 300;
      return { overflow: scroll.scrollWidth > scroll.clientWidth, before, after: card.getBoundingClientRect().left };
    })()`);
    assert.equal(sticky.overflow, true);
    assert.ok(Math.abs(sticky.before - sticky.after) < 1, 'Check-in stays pinned while days scroll');
    await browser.resize(1440, 1000);
    await evaluate('window.scrollTo(0,0)');
    await browser.clickVisible(selector('button-calendar-month'));
    await waitFor(() => evaluate("Boolean(document.querySelector('.calendar-grid'))"), 'Month layout restored');
    assert.match(await evaluate("document.querySelector('.sidebar').textContent"), /This month at a glance/);
    assert.match(await evaluate("document.querySelector('.sidebar').textContent"), /Content types/);
    assert.deepEqual(
      await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts'))"),
      posts.map((post) => post.id === 'week-suggestion' ? { ...post, isCompleted: true }
        : post.id === 'week-last-week' ? { ...post, performance: { views: 444, saves: 14, bookings: 2 } }
          : post.id === 'week-last-week-second' ? { ...post, performance: { views: 77, saves: 4, bookings: 1 } }
            : post),
      'Completion and results persist only on the intended posts, in the existing post storage',
    );
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('mid-campaign check-ins appear only for active paid runs at their viewed midpoint and open results', { timeout: 90000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const selector = (id) => `[data-testid="${id}"]`;
  const shiftDate = (value, amount) => {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  };
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'mid-campaign test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await browser.resize(1440, 1000);
    await evaluate('localStorage.clear()');
    await browser.reload();
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate("Boolean(document.querySelector('.week-calendar'))"), 'empty Week view');
    assert.equal(await evaluate("document.querySelectorAll('.week-mid-campaign-card').length"), 0);
    assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=\"card-week-checkin\"]'))"), true, 'The weekly check-in remains visible by itself');

    const dates = await evaluate(`(() => {
      const key = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      const shift = (value, amount) => {
        const date = new Date(value + 'T12:00:00');
        date.setDate(date.getDate() + amount);
        return key(date);
      };
      const today = key(new Date());
      const monday = new Date();
      monday.setHours(12, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const firstWeek = new Date(2026, 8, 1, 12);
      firstWeek.setDate(firstWeek.getDate() - ((firstWeek.getDay() + 6) % 7));
      const utcDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
      const dayDifference = utcDay(monday) - utcDay(firstWeek);
      return { today, weekStart: key(monday), weeksFromStart: Math.trunc(dayDifference / 7), expiredEnd: shift(key(monday), 2) };
    })()`);
    const postBase = {
      businessId: 'mosaic', project: 'Insurance', contentType: 'Insight',
      platforms: ['Instagram'], distribution: 'paid', schedulingStatus: 'published',
    };
    const makePaid = (id, title, offset, runLength, budget = 120) => ({
      ...postBase, id, title, date: shiftDate(dates.today, offset), runLength, budget,
    });
    const noBudgetPost = makePaid('mid-no-budget', 'Paid post without a budget', -7, 14);
    delete noBudgetPost.budget;
    const campaigns = [
      makePaid('mid-active-one', 'Paid midpoint one', -7, 14),
      makePaid('mid-active-two', 'Paid midpoint two', -4, 9),
      makePaid('mid-future', 'Paid run whose midpoint is next week', -1, 20),
      noBudgetPost,
      { ...makePaid('mid-organic', 'Organic post is not an ad', -7, 14), distribution: 'organic' },
      { ...makePaid('mid-other-business', 'Another business campaign', -7, 14), businessId: 'northline' },
      {
        ...postBase, id: 'mid-ended', title: 'Campaign already ended',
        date: shiftDate(dates.weekStart, -2), runLength: 4, budget: 80,
      },
    ];
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify(campaigns))})`);
    await browser.reload();
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate("Boolean(document.querySelector('.week-calendar'))"), 'Week view with paid campaigns');
    for (let step = 0; step < Math.abs(dates.weeksFromStart); step += 1) {
      await browser.clickVisible(dates.weeksFromStart > 0 ? selector('button-next-week') : selector('button-previous-week'));
    }
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(selector(`column-week-day-${dates.weekStart}`))}))`), 'current week navigation');
    assert.equal(await evaluate("document.querySelectorAll('.week-mid-campaign-card').length"), 2);
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-mid-campaign-mid-active-one'))}))`), true);
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-mid-campaign-mid-active-two'))}))`), true);
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-mid-campaign-mid-future'))}))`), false);
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-mid-campaign-mid-no-budget'))}))`), false);
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-mid-campaign-mid-organic'))}))`), false);
    assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-mid-campaign-mid-other-business'))}))`), false);
    if (dates.today >= dates.expiredEnd) {
      assert.equal(await evaluate(`Boolean(document.querySelector(${jsString(selector('card-mid-campaign-mid-ended'))}))`), false);
    }
    assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=\"card-week-checkin\"]'))"), true, 'Mid-campaign cards never replace the weekly check-in');
    await browser.clickVisible(selector('button-upload-campaign-mid-active-one'));
    await waitFor(() => evaluate("document.querySelector('#selected-post-title')?.textContent === 'Paid midpoint one'"), 'existing results flow for the campaign');
    assert.equal(await evaluate("Boolean(document.querySelector('.post-performance input[type=\"number\"]'))"), true);
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('Skip retains shared records, offers one organic alternative, and leaves Mark done working', { timeout: 90000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const selector = (id) => `[data-testid="${id}"]`;
  const base = { businessId: 'mosaic', platforms: ['Instagram'], schedulingStatus: 'approved-suggestion' };
  const posts = [
    { ...base, id: 'skip-story', project: 'Insurance', contentType: 'Testimonial',
      title: 'A client story to skip', date: '2026-09-02', distribution: 'organic' },
    { ...base, id: 'skip-paid', project: 'Tax planning', contentType: 'Announcement',
      title: 'A paid post to skip', date: '2026-09-04', distribution: 'paid', budget: 100, runLength: 7 },
  ];
  const monthSelector = '.event-chip-button[aria-label^="Open saved post: A client story to skip"]';
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'Skip verification server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await browser.resize(1440, 1000);
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify(posts))})`);
    await browser.reload();
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(selector('button-skip-skip-story'))}))`), 'Week skip control');
    const progressBefore = await evaluate(`document.querySelector(${jsString(selector('text-week-progress'))}).textContent`);
    await evaluate(`document.querySelector(${jsString(selector('button-skip-skip-story'))}).scrollIntoView({block:'center',inline:'center'})`);
    await browser.clickVisible(selector('button-skip-skip-story'));
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post=>post.id==='skip-story')?.status==='skipped'"), 'Skip saved');
    assert.equal(await evaluate(`document.querySelector(${jsString(selector('text-week-progress'))}).textContent`), progressBefore, 'Skipping is not completion and does not remove a move');
    assert.equal(await evaluate("document.querySelectorAll('.action-insight-proposal').length"), 1);
    assert.match(await evaluate("document.querySelector('.action-insight-popup').innerText"), /quick proof post is lighter/);
    await browser.clickVisible('.action-insight-skip');
    await browser.reload();
    await waitFor(() => evaluate(`document.querySelector(${jsString(monthSelector)})?.classList.contains('event-chip-skipped')`), 'Skip persists in Month after refresh');
    await evaluate(`document.querySelector(${jsString(monthSelector)}).scrollIntoView({block:'center'})`);
    await browser.clickVisible(monthSelector);
    await evaluate(`document.querySelector('button[aria-label="Undo skip post"]').scrollIntoView({block:'center'})`);
    await browser.clickVisible('button[aria-label="Undo skip post"]');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post=>post.id==='skip-story')?.status===undefined"), 'Undo restores planned status');
    await evaluate(`document.querySelector(${jsString(monthSelector)}).scrollIntoView({block:'center'})`);
    await browser.clickVisible(monthSelector);
    await evaluate(`document.querySelector('button[aria-label="Mark post done"]').scrollIntoView({block:'center'})`);
    await browser.clickVisible('button[aria-label="Mark post done"]');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post=>post.id==='skip-story')?.isCompleted===true"), 'Mark done still works after Skip');
    await browser.clickVisible('.action-insight-skip');
    await evaluate(`document.querySelector('button[aria-label="Close saved post details"]').scrollIntoView({block:'center'})`);
    await browser.clickVisible('button[aria-label="Close saved post details"]');
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate(`document.querySelector(${jsString(selector('checkbox-done-skip-story'))})?.checked`), 'Month done state shared in Week');
    assert.match(await evaluate(`document.querySelector(${jsString(selector('text-week-progress'))}).textContent`), /^1 of/);
    await evaluate(`document.querySelector(${jsString(selector('button-skip-skip-paid'))}).scrollIntoView({block:'center',inline:'center'})`);
    await browser.clickVisible(selector('button-skip-skip-paid'));
    await waitFor(() => evaluate("document.querySelectorAll('.action-insight-proposal').length===1"), 'one paid alternative');
    assert.match(await evaluate("document.querySelector('.action-insight-popup').innerText"), /No boost\? Try an organic repost/);
    await browser.clickVisible('.action-insight-add');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).some(post=>post.sourcePostId==='skip-paid')"), 'alternative approved');
    const records = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts'))");
    assert.equal(records.find((post) => post.id === 'skip-paid').status, 'skipped');
    const alternative = records.find((post) => post.sourcePostId === 'skip-paid');
    assert.equal(alternative.distribution, 'organic');
    assert.equal(alternative.budget, undefined);
    assert.equal(alternative.runLength, undefined);
    assert.equal(alternative.suggestionKind, 'skip-alternative');
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('.business-tabs'))"), 'calendar refreshed');
    await evaluate("window.scrollTo(0,0)");
    await browser.clickVisible('.business-tabs .business-tab:nth-child(2)');
    assert.doesNotMatch(await evaluate('document.body.innerText'), /A client story to skip|A paid post to skip/);
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('completion keeps the sequence suggestion and measured insight independent in both calendar views', { timeout: 90000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const selector = (id) => `[data-testid="${id}"]`;
  const base = {
    businessId: 'mosaic', project: 'Insurance', contentType: 'Announcement',
    platforms: ['Instagram'], distribution: 'organic', schedulingStatus: 'published',
  };
  const posts = [
    { ...base, id: 'reach-history-one', title: 'Historic one', date: '2026-08-05', performance: { views: 100 } },
    { ...base, id: 'reach-history-two', title: 'Historic two', date: '2026-08-12', performance: { views: 100 } },
    { ...base, id: 'reach-history-three', title: 'Historic three', date: '2026-08-19', performance: { views: 100 } },
    { ...base, id: 'done-month-target', title: 'Month completion target', date: '2026-09-02', performance: { views: 1000 } },
    {
      ...base, id: 'done-week-target', project: 'Fall programs', title: 'Week completion target',
      date: '2026-09-04', contentType: 'Insight',
    },
  ];
  const monthPostSelector = '.event-chip-button[aria-label^="Open saved post: Month completion target"]';
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'completion verification server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await browser.resize(1440, 1000);
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify(posts))})`);
    await browser.reload();
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(selector('column-week-day-2026-09-04'))}))`), 'Week view with unmeasured and measured posts');
    await evaluate(`document.querySelector(${jsString(selector('label-completion-done-week-target'))}).scrollIntoView({block:'center',inline:'center'})`);
    await browser.clickVisible(selector('label-completion-done-week-target'));
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post => post.id === 'done-week-target')?.isCompleted === true"), 'Week completion persisted');
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-add'))"), true, 'The content sequence recommendation appears without requiring performance history');
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-performance'))"), false, 'No trend claim appears below the three-post gate');
    await browser.clickVisible('.action-insight-skip');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-popup')) === false"), 'unmeasured sequence suggestion dismissed');

    await browser.clickVisible(selector('button-calendar-month'));
    await waitFor(() => evaluate("Boolean(document.querySelector('.calendar-grid'))"), 'Month view');
    await waitFor(() => evaluate(`Boolean(document.querySelector(${jsString(monthPostSelector)}))`), 'Month completion target');
    await evaluate(`document.querySelector(${jsString(monthPostSelector)}).scrollIntoView({block:'center'})`);
    await browser.clickVisible(monthPostSelector);
    await waitFor(() => evaluate("document.querySelector('#selected-post-title')?.textContent === 'Month completion target'"), 'Month post details');
    await evaluate(`document.querySelector('button[aria-label="Mark post done"]').scrollIntoView({block:'center'})`);
    await browser.clickVisible('button[aria-label="Mark post done"]');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post => post.id === 'done-month-target')?.isCompleted === true"), 'Month completion persisted');
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-add'))"), true, 'The Month completion launches content-sequence suggestions');
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-performance'))"), true,
      `The measured performance insight appears at the three-post view gate: ${await evaluate("JSON.stringify({posts:JSON.parse(localStorage.getItem('marketing-tool.user-posts')).map(({id,project,performance,isCompleted})=>({id,project,performance,isCompleted})),popup:document.querySelector('.action-insight-popup')?.innerText})")}`);
    assert.match(await evaluate("document.querySelector('.action-insight-performance').textContent"), /One post stood out for reach/);

    await evaluate(`document.querySelector('button[aria-label="Close saved post details"]').scrollIntoView({block:'center'})`);
    await browser.clickVisible('button[aria-label="Close saved post details"]');
    await browser.clickVisible('.action-insight-add');
    await waitFor(() => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).some(post => post.sourcePostId === 'done-month-target')"), 'approved next move added to the calendar');
    const addedPost = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts')).find(post => post.sourcePostId === 'done-month-target')");
    await waitFor(() => evaluate(`Array.from(document.querySelectorAll('.event-chip-button')).some(button => button.textContent.includes(${jsString(addedPost.title)}))`), 'approved suggestion visible in Month');
    assert.equal(await evaluate("document.querySelector('.action-insight-popup h2')?.textContent"), 'One post stood out for reach', 'Adding the next move leaves the independent performance insight visible');
    await browser.clickVisible('button[aria-label="Dismiss insight"]');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-popup')) === false"), 'performance insight dismissed');
    await browser.clickVisible('button[aria-label="Previous month"]');
    await browser.clickVisible(selector('button-calendar-week'));
    await waitFor(() => evaluate(`document.querySelector(${jsString(selector('checkbox-done-done-month-target'))})?.checked === true`), 'Month completion shared into Week');
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function startProcess(command, args, options) {
  const child = spawn(command, args, { ...options, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  return { child, getOutput: () => output };
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }

  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2500),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

async function waitFor(check, description, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

async function startCdpPage(url) {
  const executable = [
    process.env.CHROMIUM_PATH,
    '/repl/tools/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].find((candidate) => candidate && existsSync(candidate));
  assert.ok(executable, 'Set CHROMIUM_PATH to a Chromium executable to run this browser test.');

  const profileDirectory = mkdtempSync(path.join(tmpdir(), 'marketing-tool-best-time-'));
  const { child, getOutput } = startProcess(executable, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDirectory}`,
    url,
  ], { cwd: workspaceDirectory });

  try {
    const activePortFile = path.join(profileDirectory, 'DevToolsActivePort');
    const port = await waitFor(() => {
      if (child.exitCode !== null) {
        throw new Error(`Chromium exited early: ${getOutput()}`);
      }
      try {
        return Number(readFileSync(activePortFile, 'utf8').split('\n')[0]);
      } catch {
        return false;
      }
    }, 'Chromium remote debugging port');
    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) return false;
      const targets = await response.json();
      return targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    }, 'Chromium page target');
    const socketUrl = new URL(target.webSocketDebuggerUrl);
    socketUrl.hostname = '127.0.0.1';
    const socket = new WebSocket(socketUrl);
    const pending = new Map();
    const eventWaiters = new Map();
    let nextId = 0;

    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Could not connect to Chromium DevTools.')), { once: true });
      socket.addEventListener('close', () => reject(new Error('Chromium DevTools closed before connecting.')), { once: true });
    });
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (!message.id) {
        const waiters = eventWaiters.get(message.method);
        if (waiters?.length) waiters.shift()();
        return;
      }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });

    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chromium DevTools command timed out: ${method}`));
      }, 10000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const waitForEvent = (method) => new Promise((resolve) => {
      const waiters = eventWaiters.get(method) ?? [];
      waiters.push(resolve);
      eventWaiters.set(method, waiters);
    });
    const evaluate = async (expression) => {
      const response = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (response.exceptionDetails) {
        const details = response.exceptionDetails.exception?.description;
        throw new Error(details ?? response.exceptionDetails.text ?? 'Browser evaluation failed.');
      }
      return response.result?.value;
    };
    const enterCalendar = async () => {
      const point = await waitFor(() => evaluate(`(() => {
        const button = document.querySelector('[data-testid="button-step-in"]');
        if (!button || button.disabled) return false;
        const bounds = button.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + bounds.height / 2;
        return button.contains(document.elementFromPoint(x, y)) ? { x, y } : false;
      })()`), 'visible Step in control');
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      await waitFor(() => evaluate("!document.querySelector('.welcome-screen') && !document.querySelector('.welcome-app-content')?.inert"),
        'calendar ready after welcome');
    };

    await send('Page.enable');
    await send('Runtime.enable');
    // Existing-flow tests explicitly own their business/service fixtures now.
    // No test may depend on the app silently creating sample workspaces/events.
    const fixtureBusinesses = [
      { id: 'mosaic', name: 'Mosaic Legal', accent: 'rose', platforms: ['Facebook', 'Instagram', 'TikTok'] },
      { id: 'northline', name: 'Northline Financial', accent: 'sage', platforms: ['Facebook', 'Instagram', 'TikTok'] },
      { id: 'harbor', name: 'Harbor Coverage', accent: 'amber', platforms: ['Facebook', 'Instagram', 'TikTok'] },
    ];
    const fixtureServices = fixtureBusinesses.flatMap(({ id }) =>
      ['Fall programs', 'Tax planning', 'Divorce', 'Immigration', 'Insurance'].map((name) => ({
        id: `${id}:${name}`, businessId: id, name, mode: 'evergreen',
      })));
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      if (sessionStorage.getItem('test-workspace-ready')) return;
      localStorage.setItem('marketing-tool.businesses', ${jsString(JSON.stringify(fixtureBusinesses))});
      localStorage.setItem('marketing-tool.services', ${jsString(JSON.stringify(fixtureServices))});
      localStorage.setItem('marketing-tool.first-run-setup', 'skipped');
      sessionStorage.setItem('test-workspace-ready', 'true');
    })()` });
    await send('Page.navigate', { url });
    await waitFor(
      () => evaluate("Boolean(document.querySelector('button.add-post'))"),
      'marketing calendar to render',
    );
    await enterCalendar();

    return {
      child,
      profileDirectory,
      socket,
      evaluate,
      resize: (width, height) => send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: false,
      }),
      clickVisible: async (selector) => {
        const point = await evaluate(`(() => {
          const element = document.querySelector(${jsString(selector)});
          if (!element) throw new Error('Missing clickable control: ' + ${jsString(selector)});
          const bounds = element.getBoundingClientRect();
          const x = bounds.left + bounds.width / 2;
          const y = bounds.top + bounds.height / 2;
          if (!bounds.width || !bounds.height || x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) {
            throw new Error('Control is outside the viewport: ' + ${jsString(selector)}
              + ' (center ' + x + ',' + y + '; size ' + bounds.width + 'x' + bounds.height
              + '; viewport ' + innerWidth + 'x' + innerHeight + '; scroll ' + scrollX + ',' + scrollY + ')');
          }
          if (!element.contains(document.elementFromPoint(x, y))) {
            throw new Error('Another element blocks the control: ' + ${jsString(selector)});
          }
          return { x, y };
        })()`);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      },
      reload: async () => {
        const marker = `reload-${Date.now()}-${Math.random()}`;
        await evaluate(`document.documentElement.dataset.testReloadMarker = ${jsString(marker)}`);
        const loaded = waitForEvent('Page.loadEventFired');
        await send('Page.reload', { ignoreCache: true });
        await loaded;
        await waitFor(() => evaluate(`document.documentElement.dataset.testReloadMarker !== ${jsString(marker)}
          && Boolean(document.querySelector('button.add-post'))`), 'new calendar document after reload');
        await enterCalendar();
      },
      close: async () => {
        socket.close();
        await stopProcess(child);
        rmSync(profileDirectory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await stopProcess(child);
    rmSync(profileDirectory, { recursive: true, force: true });
    throw new Error(`${error.message}\n${getOutput()}`);
  }
}

function jsString(value) {
  return JSON.stringify(value);
}

async function setField(evaluate, selector, value) {
  const expression = `(() => {
    const element = document.querySelector(${jsString(selector)});
    if (!element) throw new Error('Missing form control: ' + ${jsString(selector)});
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    if (!setter) throw new Error('Form control has no native value setter.');
    setter.call(element, ${jsString(value)});
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    if (element.tagName !== 'SELECT') {
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  })()`;
  await evaluate(expression);
}

async function click(evaluate, selector) {
  const expression = `(() => {
    const element = document.querySelector(${jsString(selector)});
    if (!element) {
      throw new Error('Missing button: ' + ${jsString(selector)}
        + ' at ' + location.href + ' with page text: ' + document.body.innerText.slice(0, 300));
    }
    element.click();
    return true;
  })()`;
  await evaluate(expression);
}

async function clickButtonText(evaluate, exactText) {
  const expression = `(() => {
    const button = [...document.querySelectorAll('button')]
      .find((element) => element.textContent.trim() === ${jsString(exactText)});
    if (!button) throw new Error('Missing button with text: ' + ${jsString(exactText)});
    button.click();
    return true;
  })()`;
  await evaluate(expression);
}

async function selectBusiness(evaluate, name) {
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button.business-tab')]
      .find((element) => element.textContent.trim() === ${jsString(name)});
    if (!button) throw new Error('Missing business tab: ' + ${jsString(name)});
    button.click();
    return true;
  })()`);
  await waitFor(
    () => evaluate(`document.querySelector('.calendar-toolbar .toolbar-note')?.textContent?.includes(${jsString(name)})`),
    `${name} workspace to become active`,
  );
}

async function dismissInsight(evaluate) {
  await evaluate("document.querySelector('button.action-insight-skip')?.click() ?? true");
}

async function resolveInsight(evaluate, action = 'skip') {
  await waitFor(
    () => evaluate("Boolean(document.querySelector('.action-insight-popup'))"),
    'post insight popup',
  );
  await click(evaluate, action === 'add' ? '.action-insight-add' : '.action-insight-skip');
  await waitFor(
    () => evaluate("!document.querySelector('.action-insight-popup')"),
    'post insight popup to close',
  );
}

async function ensureMonth(evaluate, date) {
  const target = new Date(`${date}T12:00:00`);
  const targetMonth = `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(target)} ${target.getFullYear()}`;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const currentLabel = await evaluate("document.querySelector('.month-nav-label')?.textContent?.trim() ?? ''");
    if (currentLabel === targetMonth) return;
    const match = /^(\w+) (\d{4})$/.exec(currentLabel);
    assert.ok(match, `Unexpected calendar month label: ${currentLabel}`);
    const currentMonth = monthIndexes.get(match[1]);
    const targetMonthIndex = target.getFullYear() * 12 + target.getMonth();
    const currentMonthIndex = Number(match[2]) * 12 + currentMonth;
    const button = targetMonthIndex > currentMonthIndex
      ? 'button[aria-label="Next month"]'
      : 'button[aria-label="Previous month"]';
    await click(evaluate, button);
  }
  assert.fail(`Could not navigate to ${targetMonth}.`);
}

async function createPost(evaluate, post, insightAction = 'skip') {
  await click(evaluate, 'button.add-post');
  await waitFor(() => evaluate("Boolean(document.querySelector('.post-form'))"), 'new post form');
  await setField(evaluate, '.post-form .form-grid label:nth-of-type(1) select', post.service);
  await setField(evaluate, '.post-form .form-grid label:nth-of-type(2) select', 'Insight');
  await setField(evaluate, '.post-form input[type="text"]', post.title);
  await setField(evaluate, '.post-form input[type="date"]', post.date);
  await evaluate(`(() => {
    const option = [...document.querySelectorAll('.platform-option')]
      .find((label) => label.textContent.trim() === 'Facebook');
    if (!option) throw new Error('Facebook platform option was not rendered.');
    const checkbox = option.querySelector('input[type="checkbox"]');
    if (!checkbox.checked) checkbox.click();
    return true;
  })()`);
  await click(evaluate, '.post-form-actions .save-post-button');
  await waitFor(() => evaluate("!document.querySelector('.post-form')"), 'post to be added to the calendar');
  await resolveInsight(evaluate, insightAction);
  if (insightAction === 'skip') {
    const createdSuggestion = await evaluate(`(() => {
      const posts = JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]');
      const source = posts.find((item) => item.title === ${jsString(post.title)});
      return posts.some((item) =>
        item.sourcePostId === source?.id
        && item.schedulingStatus === 'approved-suggestion'
      );
    })()`);
    assert.equal(createdSuggestion, false, `Skipping the insight should not schedule a suggestion for ${post.title}.`);
  }
}

async function openPost(evaluate, post) {
  await ensureMonth(evaluate, post.date);
  await evaluate(`(() => {
    const event = [...document.querySelectorAll('button.event-chip-button')]
      .find((button) => button.textContent.includes(${jsString(post.title)})
        && button.closest('.day-cell')?.querySelector('.day-number')?.textContent.trim() === ${jsString(String(Number(post.date.slice(-2))))});
    if (!event) throw new Error('Saved calendar post not found: ' + ${jsString(post.title)});
    event.click();
    return true;
  })()`);
  await waitFor(
    () => evaluate("Boolean(document.querySelector('[aria-labelledby=\"selected-post-title\"]'))"),
    `details for ${post.title}`,
  );
}

async function readRecommendation(evaluate) {
  return evaluate("document.querySelector('[aria-label=\"Best time recommendation\"] .post-best-time-label')?.textContent?.trim() ?? ''");
}

async function saveResults(evaluate, post, { keepOpen = false } = {}) {
  await evaluate(`(() => {
    const form = document.querySelector('.post-performance');
    if (!form) throw new Error('Post results form is missing.');
    const inputs = [...form.querySelectorAll('.post-performance-fields input[type=\"number\"]')];
    if (inputs.length !== 3) throw new Error('Expected views, saves, and bookings fields.');
    const setValue = (element, value) => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
      setter.call(element, String(value));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setValue(inputs[0], ${jsString(post.views ?? '')});
    setValue(inputs[1], ${jsString(post.saves ?? 0)});
    setValue(inputs[2], ${jsString(post.bookings ?? 0)});
    const time = form.querySelector('input[type=\"time\"]');
    if (!time) throw new Error('Actual posting time field is missing.');
    setValue(time, ${jsString(post.postedTime ?? '')});
    form.querySelector('button[type=\"submit\"]').click();
    return true;
  })()`);
  await waitFor(
    () => evaluate("Boolean(document.querySelector('.post-performance-saved'))"),
    `confirmation and conversion assessment after saving ${post.title}`,
  );
  if (!keepOpen) {
    await click(evaluate, '.post-modal-header .modal-close');
    await dismissInsight(evaluate);
  }
  const persistedPost = await waitFor(async () => {
    const posts = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
    return posts.find((item) =>
      item.title === post.title
      && item.postedTime === (post.postedTime || undefined)
      && item.performance?.views === post.views
    );
  }, `saved metrics and posting time for ${post.title}`);
  assert.equal(persistedPost.performance.views, post.views);
  return persistedPost;
}

async function assertCalendarMode(evaluate, post, mode) {
  await click(evaluate, '.post-modal-header .modal-close');
  await dismissInsight(evaluate);
  await ensureMonth(evaluate, post.date);
  const hasModeBadge = await evaluate(`(() => {
    const event = [...document.querySelectorAll('button.event-chip-button')]
      .find((button) => button.textContent.includes(${jsString(post.title)}));
    return Boolean(event?.querySelector('.event-best-time-${mode}'));
  })()`);
  assert.equal(hasModeBadge, true, `${post.title} should have a ${mode} timing badge in the calendar.`);
}

async function assertNoCalendarMode(evaluate, post) {
  await click(evaluate, '.post-modal-header .modal-close');
  await ensureMonth(evaluate, post.date);
  const hasModeBadge = await evaluate(`(() => {
    const event = [...document.querySelectorAll('button.event-chip-button')]
      .find((button) => button.textContent.includes(${jsString(post.title)}));
    return Boolean(event?.querySelector('.event-best-time'));
  })()`);
  assert.equal(hasModeBadge, false, `${post.title} should not show a timing badge.`);
}

async function findApprovedSuggestion(evaluate, sourcePost) {
  const suggestion = await evaluate(`(() => {
    const posts = JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]');
    const source = posts.find((item) => item.title === ${jsString(sourcePost.title)});
    return posts.find((item) =>
      item.sourcePostId === source?.id
      && item.schedulingStatus === 'approved-suggestion'
    ) ?? null;
  })()`);
  assert.ok(suggestion, `An approved suggestion should be saved for ${sourcePost.title}.`);
  return { title: suggestion.title, date: suggestion.date };
}

const learnedPosts = [
  { service: 'Tax planning', date: '2026-10-06', postedTime: '09:00', views: 600, title: 'Tax timing sample 1' },
  { service: 'Tax planning', date: '2026-10-13', postedTime: '10:30', views: 500, title: 'Tax timing sample 2' },
  { service: 'Tax planning', date: '2026-10-01', postedTime: '18:00', views: 400, title: 'Tax timing sample 3' },
  { service: 'Tax planning', date: '2026-10-08', postedTime: '19:00', views: 300, title: 'Tax timing sample 4' },
];
const isolatedServicePosts = [
  { service: 'Insurance', date: '2026-10-01', postedTime: '18:00', views: 900, title: 'Insurance timing sample 1' },
  { service: 'Insurance', date: '2026-10-08', postedTime: '19:00', views: 1000, title: 'Insurance timing sample 2' },
  { service: 'Insurance', date: '2026-10-15', postedTime: '20:30', views: 1100, title: 'Insurance timing sample 3' },
];
const secondBusinessPosts = [
  { service: 'Tax planning', date: '2026-10-05', postedTime: '18:00', views: 1100, title: 'Northline timing sample 1' },
  { service: 'Tax planning', date: '2026-10-12', postedTime: '19:00', views: 1000, title: 'Northline timing sample 2' },
  { service: 'Tax planning', date: '2026-10-19', postedTime: '20:30', views: 900, title: 'Northline timing sample 3' },
];

test('learned timing stays business- and service-specific through saved results and reload', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory,
    env: { ...process.env, PORT: String(port) },
  });
  let browser;

  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) {
        throw new Error(`Marketing tool dev server exited early:\n${server.getOutput()}`);
      }
      try {
        return (await fetch(origin)).ok;
      } catch {
        return false;
      }
    }, 'marketing tool dev server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await evaluate('localStorage.clear()');
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'fresh calendar after clearing storage');

    let taxPlanningSuggestion;
    for (const [index, post] of learnedPosts.entries()) {
      await createPost(evaluate, post, index === 0 ? 'add' : 'skip');
      if (index === 0) taxPlanningSuggestion = await findApprovedSuggestion(evaluate, post);

      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), '', 'Manually entered posts should not receive scheduling advice.');
      await saveResults(evaluate, post);

      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), '', 'Manual performance data should not make the post itself schedulable.');
      await assertNoCalendarMode(evaluate, post);

      await openPost(evaluate, taxPlanningSuggestion);
      const expected = index < 2
        ? 'Best time · suggested'
        : 'Best time · from your results: Tuesday mornings';
      await waitFor(async () => (await readRecommendation(evaluate)) === expected, `${post.title} timing suggestion to update`);
      assert.equal(await readRecommendation(evaluate), expected);
      await assertCalendarMode(evaluate, taxPlanningSuggestion, index < 2 ? 'suggested' : 'learned');
    }

    const correctedPost = { ...learnedPosts[1], views: 250 };
    await openPost(evaluate, learnedPosts[1]);
    await saveResults(evaluate, correctedPost);
    await openPost(evaluate, taxPlanningSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Thursday evenings');
    await assertCalendarMode(evaluate, taxPlanningSuggestion, 'learned');
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after correcting saved results');
    await openPost(evaluate, learnedPosts[0]);
    assert.equal(await readRecommendation(evaluate), '');
    await assertNoCalendarMode(evaluate, learnedPosts[0]);
    await openPost(evaluate, taxPlanningSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Thursday evenings');
    await assertCalendarMode(evaluate, taxPlanningSuggestion, 'learned');

    await openPost(evaluate, learnedPosts[3]);
    await saveResults(evaluate, { ...learnedPosts[3], postedTime: undefined });
    await openPost(evaluate, taxPlanningSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · suggested');
    await assertCalendarMode(evaluate, taxPlanningSuggestion, 'suggested');

    await selectBusiness(evaluate, 'Northline Financial');
    let northlineSuggestion;
    for (const [index, post] of secondBusinessPosts.entries()) {
      await createPost(evaluate, post, index === 0 ? 'add' : 'skip');
      if (index === 0) northlineSuggestion = await findApprovedSuggestion(evaluate, post);
      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), '');
      await saveResults(evaluate, post);
      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), '');
      await assertNoCalendarMode(evaluate, post);
      await openPost(evaluate, northlineSuggestion);
      const expected = index < 2
        ? 'Best time · suggested'
        : 'Best time · from your results: Monday evenings';
      await waitFor(async () => (await readRecommendation(evaluate)) === expected, `${post.title} timing suggestion to update`);
      assert.equal(await readRecommendation(evaluate), expected);
      await assertCalendarMode(evaluate, northlineSuggestion, index < 2 ? 'suggested' : 'learned');
    }

    await selectBusiness(evaluate, 'Mosaic Legal');
    let insuranceSuggestion;
    for (const [index, post] of isolatedServicePosts.entries()) {
      await createPost(evaluate, post, index === 0 ? 'add' : 'skip');
      if (index === 0) insuranceSuggestion = await findApprovedSuggestion(evaluate, post);
      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), '');
      await saveResults(evaluate, post);
      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), '');
      await assertNoCalendarMode(evaluate, post);
      await openPost(evaluate, insuranceSuggestion);
      const expected = index < 2
        ? 'Best time · suggested'
        : 'Best time · from your results: Thursday evenings';
      await waitFor(async () => (await readRecommendation(evaluate)) === expected, `${post.title} timing suggestion to update`);
      assert.equal(await readRecommendation(evaluate), expected);
      await assertCalendarMode(evaluate, insuranceSuggestion, index < 2 ? 'suggested' : 'learned');
    }

    await selectBusiness(evaluate, 'Mosaic Legal');
    await openPost(evaluate, learnedPosts[2]);
    assert.equal(await readRecommendation(evaluate), '');
    await assertNoCalendarMode(evaluate, learnedPosts[2]);
    await selectBusiness(evaluate, 'Northline Financial');
    await openPost(evaluate, northlineSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Monday evenings');
    await assertCalendarMode(evaluate, northlineSuggestion, 'learned');
    await selectBusiness(evaluate, 'Mosaic Legal');
    await openPost(evaluate, insuranceSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Thursday evenings');
    await assertCalendarMode(evaluate, insuranceSuggestion, 'learned');

    const approvedBeforeRefresh = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]').filter(post => post.schedulingStatus === 'approved-suggestion').map(post => post.id).sort()");
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after reload');
    const allMeasuredPosts = [...learnedPosts, ...secondBusinessPosts, ...isolatedServicePosts];
    const measuredTitles = new Set(allMeasuredPosts.map((post) => post.title));
    const savedCount = await waitFor(async () => {
      const posts = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
      const savedMeasuredPosts = posts.filter((post) => measuredTitles.has(post.title));
      const allResultsSaved = savedMeasuredPosts.every((post) =>
        Number.isSafeInteger(post.performance?.views)
        && post.schedulingStatus === 'published'
      );
      return savedMeasuredPosts.length === allMeasuredPosts.length && allResultsSaved
        ? savedMeasuredPosts.length
        : false;
    }, 'all measured posts and corrected results to persist');
    assert.equal(savedCount, allMeasuredPosts.length);
    const approvedSuggestionsPersisted = await evaluate(`(() => {
      const posts = JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]');
      return posts.filter((post) => post.schedulingStatus === 'approved-suggestion').map(post => post.id).sort();
    })()`);
    assert.ok(approvedBeforeRefresh.length > 0);
    assert.deepEqual(approvedSuggestionsPersisted, approvedBeforeRefresh, 'Approved suggestions should retain their identities and status after refresh.');
    const persistedCorrections = await evaluate(`(() => {
      const titles = ${jsString([learnedPosts[1].title, learnedPosts[3].title])};
      const posts = JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]');
      return Object.fromEntries(posts
        .filter((post) => titles.includes(post.title))
        .map(({ title, performance, postedTime }) => [
          title,
          { views: performance?.views, postedTime: postedTime ?? null },
        ]));
    })()`);
    assert.deepEqual(persistedCorrections, {
      [learnedPosts[1].title]: { views: 250, postedTime: '10:30' },
      [learnedPosts[3].title]: { views: 300, postedTime: null },
    });
    const persistedBusinessAssignments = await evaluate(`(() => {
      const titles = ${jsString([...measuredTitles])};
      const posts = JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]');
      return Object.fromEntries(posts
        .filter((post) => titles.includes(post.title))
        .map(({ title, businessId }) => [title, businessId]));
    })()`);
    assert.deepEqual(persistedBusinessAssignments, Object.fromEntries([
      ...learnedPosts.map((post) => [post.title, 'mosaic']),
      ...secondBusinessPosts.map((post) => [post.title, 'northline']),
      ...isolatedServicePosts.map((post) => [post.title, 'mosaic']),
    ]));

    await openPost(evaluate, learnedPosts[2]);
    assert.equal(await readRecommendation(evaluate), '');
    await assertNoCalendarMode(evaluate, learnedPosts[2]);
    await openPost(evaluate, taxPlanningSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · suggested');
    await assertCalendarMode(evaluate, taxPlanningSuggestion, 'suggested');

    await selectBusiness(evaluate, 'Northline Financial');
    await openPost(evaluate, northlineSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Monday evenings');
    await assertCalendarMode(evaluate, northlineSuggestion, 'learned');
    await selectBusiness(evaluate, 'Mosaic Legal');
    await openPost(evaluate, insuranceSuggestion);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Thursday evenings');
    await assertCalendarMode(evaluate, insuranceSuggestion, 'learned');
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('flat-post policy stays invisible while normal approvals retry, refresh and pace the service monthly', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const measured = (id, day, views) => ({
    id, businessId: 'mosaic', project: 'Insurance', contentType: 'Insight',
    title: `Coverage detail ${id}`, date: `2026-09-${day}`, platforms: ['Instagram'],
    distribution: 'organic', schedulingStatus: 'published',
    ...(views === undefined ? {} : { performance: { views, saves: 10, bookings: 5 } }),
  });
  const posts = [
    measured('first', '01', 100), measured('second', '02', 100),
    measured('third', '03', undefined), measured('fourth', '04', undefined),
  ];
  const readPosts = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
  const assertInvisible = async (evaluate) => {
    assert.doesNotMatch(await evaluate("document.body.innerText"), /strike|streak|ladder|scoreboard/i);
  };
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'flat-post test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify(posts))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'flat-post calendar');

    await openPost(evaluate, posts[2]);
    await saveResults(evaluate, { ...posts[2], views: 50, saves: 10, bookings: 5 }, { keepOpen: true });
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-popup'))"), false, 'First weak result has no new intervention.');
    await assertInvisible(evaluate);
    await click(evaluate, '.post-modal-header .modal-close');

    await openPost(evaluate, posts[3]);
    await saveResults(evaluate, { ...posts[3], views: 40, saves: 10, bookings: 5 }, { keepOpen: true });
    await waitFor(() => evaluate("document.querySelector('.action-insight-popup')?.textContent.includes('timing may have been off')"), 'retry suggestion');
    assert.equal((await readPosts(evaluate)).length, 4, 'No suggestion is added silently.');
    await assertInvisible(evaluate);
    await click(evaluate, '.action-insight-add');
    const retry = await waitFor(async () => (await readPosts(evaluate)).find((post) => post.suggestionKind === 'repost'), 'approved repost');
    assert.equal(retry.title, posts[3].title);
    assert.equal(retry.contentType, posts[3].contentType);
    assert.equal(retry.sourcePostId, posts[3].id);

    // The repost has now run; enter its result as the next service post.
    await evaluate(`(() => {
      const saved = JSON.parse(localStorage.getItem('marketing-tool.user-posts'));
      saved.find((post) => post.id === ${jsString(retry.id)}).date = '2026-09-05';
      localStorage.setItem('marketing-tool.user-posts', JSON.stringify(saved));
    })()`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'repost after reload');
    const ranRetry = { ...retry, date: '2026-09-05' };
    await openPost(evaluate, ranRetry);
    await saveResults(evaluate, { ...ranRetry, views: 30, saves: 10, bookings: 5 }, { keepOpen: true });
    await waitFor(() => evaluate("document.querySelector('.action-insight-popup')?.textContent.includes('change the opening or format')"), 'fresh approach');
    await assertInvisible(evaluate);
    await click(evaluate, '.action-insight-skip');
    assert.equal((await readPosts(evaluate)).length, 5);
    await click(evaluate, '.post-modal-header .modal-close');

    const nextPost = { service: 'Insurance', title: 'Coverage detail next', date: '2026-09-06' };
    await createPost(evaluate, nextPost, 'skip');
    await openPost(evaluate, nextPost);
    await saveResults(evaluate, { ...nextPost, views: 20, saves: 10, bookings: 5 }, { keepOpen: true });
    await waitFor(() => evaluate("document.querySelector('.action-insight-popup')?.textContent.includes('practical check-in')"), 'maintenance suggestion');
    await assertInvisible(evaluate);
    await click(evaluate, '.action-insight-add');
    const monthly = await waitFor(async () => (await readPosts(evaluate)).find((post) => post.suggestionKind === 'maintenance'), 'approved monthly check-in');
    assert.equal(monthly.date, '2026-10-06', 'Monthly pacing uses saved Insurance posts only, not a built-in October demo event.');
    assert.equal((await readPosts(evaluate)).length, 7);

    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'monthly approval after reload');
    await openPost(evaluate, nextPost);
    await saveResults(evaluate, { ...nextPost, views: 20, saves: 10, bookings: 5 }, { keepOpen: true });
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-add'))"), false, 'Resaving cannot duplicate the monthly post.');
    assert.equal((await readPosts(evaluate)).length, 7);
    await assertInvisible(evaluate);
    await click(evaluate, '.action-insight-skip');
    await saveResults(evaluate, { ...nextPost, views: 100, saves: 10, bookings: 5 }, { keepOpen: true });
    assert.equal(await evaluate("Boolean(document.querySelector('.action-insight-popup'))"), false, 'Recovery resets the internal policy without announcing a counter.');
    assert.equal((await readPosts(evaluate)).length, 7, 'Recovery keeps previously approved calendar posts.');
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('service trend marks only newest measured post, offers trust then referral, clears on recovery and resets', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const measured = (id, day, performance) => ({
    id, businessId: 'mosaic', project: 'Insurance', contentType: 'Insight',
    title: `Conversion check ${id}`, date: `2026-09-${day}`, platforms: ['Instagram'],
    distribution: 'organic', schedulingStatus: 'published', performance,
  });
  const posts = [
    measured('first', '03', { views: 300, saves: 10, bookings: 1 }),
    measured('second', '06', { views: 300, saves: 10, bookings: 1 }),
    measured('third', '08', undefined),
  ];
  const readPosts = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'conversion test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify(posts))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'conversion test calendar');

    await openPost(evaluate, posts[0]);
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-panel'))"), false, 'Nothing appears before the three-post gate.');
    assert.equal(await evaluate("document.querySelectorAll('.event-conversion-gap').length"), 0);
    await click(evaluate, '.post-modal-header .modal-close');

    await openPost(evaluate, posts[2]);
    await saveResults(evaluate, { ...posts[2], views: 300, saves: 10, bookings: 1 }, { keepOpen: true });
    await waitFor(() => evaluate("Boolean(document.querySelector('.conversion-gap-detected'))"), 'gap after third result');
    assert.match(await evaluate("document.querySelector('.conversion-gap-panel').textContent"), /Your numbers · last 3 posts/);
    assert.match(await evaluate("document.querySelector('.conversion-gap-message').textContent"), /Something in the booking path isn’t working yet/);
    assert.equal(await evaluate("document.querySelectorAll('.event-conversion-gap').length"), 1);
    assert.match(await evaluate("document.querySelector('.event-conversion-gap').closest('button').textContent"), /Conversion check third/);
    assert.equal((await readPosts(evaluate)).length, 3, 'Detection must not silently add a calendar post.');
    await clickButtonText(evaluate, 'Skip suggestion');
    assert.equal((await readPosts(evaluate)).length, 3, 'Skip must not create a follow-up.');
    await click(evaluate, '.post-modal-header .modal-close');

    await openPost(evaluate, posts[2]);
    await click(evaluate, '.conversion-gap-actions .save-post-button');
    let trust = await waitFor(async () => (await readPosts(evaluate)).find((post) => post.suggestionKind === 'trust'), 'approved testimonial');
    assert.equal(trust.contentType, 'Testimonial');
    assert.equal(trust.sourcePostId, 'third');
    assert.equal(trust.schedulingStatus, 'approved-suggestion');
    await openPost(evaluate, trust);
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-actions'))"), false, 'Offer waits for testimonial results.');
    await saveResults(evaluate, { ...trust, views: 300, saves: 10, bookings: 1 }, { keepOpen: true });
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-actions'))"), false, 'Future trust post cannot unlock an offer even with results.');
    await click(evaluate, '.post-modal-header .modal-close');
    // Simulate the approved trust post having run by rescheduling it to today.
    const today = new Date().toISOString().slice(0, 10);
    await evaluate(`(() => {
      const saved = JSON.parse(localStorage.getItem('marketing-tool.user-posts'));
      saved.find((post) => post.suggestionKind === 'trust').date = ${jsString(today)};
      localStorage.setItem('marketing-tool.user-posts', JSON.stringify(saved));
    })()`);
    trust = { ...trust, date: today };
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after trust runs');
    await openPost(evaluate, trust);
    await waitFor(() => evaluate("document.querySelector('.conversion-gap-panel')?.textContent.includes('didn’t bring in more bookings')"), 'offer after weak testimonial');
    await click(evaluate, '.conversion-gap-actions .save-post-button');
    const offer = await waitFor(async () => (await readPosts(evaluate)).find((post) => post.suggestionKind === 'offer'), 'approved referral offer');
    assert.equal(offer.sourcePostId, 'third');
    assert.equal((await readPosts(evaluate)).length, 5);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after reload');
    await openPost(evaluate, offer);
    await saveResults(evaluate, { ...offer, views: 300, saves: 10, bookings: 0 }, { keepOpen: true });
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-actions'))"), false, 'No duplicate or third conversion stage.');
    assert.equal((await readPosts(evaluate)).length, 5);
    assert.equal(await evaluate("document.querySelectorAll('.event-conversion-gap').length"), 1);
    await saveResults(evaluate, { ...offer, views: 300, saves: 10, bookings: 30 }, { keepOpen: true });
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-panel'))"), false, 'Recovery removes the summary.');
    assert.equal(await evaluate("document.querySelectorAll('.event-conversion-gap').length"), 0, 'Recovery clears every marker.');
    await click(evaluate, '.post-modal-header .modal-close');
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'recovered calendar after reload');
    await openPost(evaluate, offer);
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-panel'))"), false, 'Recovery persists across reload.');
    await click(evaluate, '.post-modal-header .modal-close');
    const nextPosts = [1, 2, 3].map((offset) => ({
      ...measured(`next${offset}`, '09', { views: 300, saves: 10, bookings: 1 }),
      date: new Date(new Date(`${offer.date}T12:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10),
    }));
    const recoveredPosts = await readPosts(evaluate);
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify([...recoveredPosts, ...nextPosts]))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'new episode calendar');
    await openPost(evaluate, nextPosts[2]);
    assert.match(await evaluate("document.querySelector('.conversion-gap-panel').textContent"), /Step 1 · Build trust/);
    assert.doesNotMatch(await evaluate("document.querySelector('.conversion-gap-panel').textContent"), /Step 2/);
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('content types and platforms can be managed independently for every business', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const source = {
    id: 'catalog-mosaic-post',
    businessId: 'mosaic',
    project: 'Insurance',
    title: 'Mosaic legacy announcement',
    date: '2026-10-06',
    contentType: 'Announcement',
    platforms: ['Facebook', 'Instagram', 'TikTok'],
    distribution: 'organic',
    schedulingStatus: 'published',
  };
  const otherBusinessPost = {
    id: 'catalog-northline-post',
    businessId: 'northline',
    project: 'Insurance',
    title: 'Northline proof post',
    date: '2026-10-06',
    contentType: 'Proof',
    platforms: ['Facebook', 'Instagram'],
    distribution: 'organic',
    schedulingStatus: 'published',
  };
  const readPosts = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
  const readServices = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.services') ?? '[]')");
  const readSettings = (evaluate) => evaluate("JSON.parse(localStorage.getItem('marketing-tool.business-content-settings') ?? '{}')");

  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'content catalog test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'content catalog calendar');
    const today = await evaluate(`(() => {
      const date = new Date();
      return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    })()`);
    source.date = today;
    otherBusinessPost.date = today;
    const defaultCatalog = {
      contentTypes: ['Announcement', 'Insight', 'Inside look', 'Proof', 'Testimonial', 'Pricing', 'Book now', 'Last chance', 'Recap', 'Promo', 'Fresh angle'],
      platformOptions: ['Facebook', 'Instagram', 'TikTok'],
      selectedPlatforms: ['Facebook', 'Instagram', 'TikTok'],
      contentTypeAliases: {},
    };
    const savedService = {
      id: 'mosaic:Catalog service',
      businessId: 'mosaic',
      name: 'Catalog service',
      mode: 'evergreen',
      tone: 'sage',
      platforms: ['Facebook', 'Instagram', 'TikTok'],
    };
    await evaluate(`(() => {
      localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify([source, otherBusinessPost]))});
      localStorage.setItem('marketing-tool.services', ${jsString(JSON.stringify([savedService]))});
      localStorage.setItem('marketing-tool.business-content-settings', ${jsString(JSON.stringify({
        mosaic: defaultCatalog,
        northline: { ...defaultCatalog, selectedPlatforms: ['Facebook', 'Instagram'] },
      }))});
    })()`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'catalog data after a new calendar document');

    await browser.clickVisible('.manage-content');
    await waitFor(() => evaluate("Boolean(document.querySelector('.bcm-dialog'))"), 'content manager');
    const contentRows = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.bcm-section[aria-label="Content types"] .bcm-item')];
      return {
        count: rows.length,
        everyRowHasEdit: rows.every((row) => row.querySelector('button[aria-label^="Edit content type "]')),
        everyRowHasDelete: rows.every((row) => row.querySelector('button[aria-label^="Delete content type "]')),
      };
    })()`);
    assert.deepEqual(contentRows, { count: 11, everyRowHasEdit: true, everyRowHasDelete: true });
    assert.equal(await evaluate(`(() => [...document.querySelectorAll('.bcm-section[aria-label="Platforms"] .bcm-item')]
      .every((row) => row.querySelector('button[aria-label^="Edit platform "]')
        && row.querySelector('button[aria-label^="Delete platform "]')))()`), true,
    'Every default platform has visible edit and delete controls.');

    await browser.clickVisible('.bcm-section[aria-label="Content types"] .bcm-add');
    await setField(evaluate, '.bcm-section[aria-label="Content types"] .bcm-add-form input', 'Case study');
    await browser.clickVisible('.bcm-section[aria-label="Content types"] .bcm-add-form button[type="submit"]');
    await waitFor(async () => (await readSettings(evaluate)).mosaic.contentTypes.includes('Case study'), 'new content type');
    await evaluate("document.querySelector('.bcm-body').scrollTop = 190");
    await browser.clickVisible('button[aria-label="Edit content type Proof"]');
    await setField(evaluate, 'input[aria-label="Rename content type Proof"]', 'Evidence');
    await browser.clickVisible('.bcm-section[aria-label="Content types"] .bcm-item button.bcm-save');
    await waitFor(async () => (await readSettings(evaluate)).mosaic.contentTypes.includes('Evidence'), 'renamed content type');
    assert.equal((await readSettings(evaluate)).mosaic.contentTypes.includes('Proof'), false);

    await evaluate("document.querySelector('.bcm-body').scrollTop = 0");
    await browser.clickVisible('button[aria-label="Delete content type Announcement"]');
    await waitFor(async () => !(await readSettings(evaluate)).mosaic.contentTypes.includes('Announcement'), 'deleted content type');
    let savedPosts = await readPosts(evaluate);
    assert.equal(savedPosts.find((post) => post.id === source.id).contentType, '',
      'Deleting a content type removes the stale label from saved posts in the active business.');
    assert.deepEqual(savedPosts.find((post) => post.id === otherBusinessPost.id).contentType, 'Proof',
      'Content types remain untouched in the other business.');

    await evaluate("document.querySelector('.bcm-body').scrollTop = 0");
    await browser.clickVisible('.bcm-section[aria-label="Platforms"] .bcm-add');
    await setField(evaluate, '.bcm-section[aria-label="Platforms"] .bcm-add-form input', 'LinkedIn');
    await browser.clickVisible('.bcm-section[aria-label="Platforms"] .bcm-add-form button[type="submit"]');
    await waitFor(async () => (await readSettings(evaluate)).mosaic.platformOptions.includes('LinkedIn'), 'new platform');
    await browser.clickVisible('button[aria-label="Edit platform TikTok"]');
    await setField(evaluate, 'input[aria-label="Rename platform TikTok"]', 'Threads');
    await browser.clickVisible('.bcm-section[aria-label="Platforms"] .bcm-item button.bcm-save');
    await waitFor(async () => (await readSettings(evaluate)).mosaic.platformOptions.includes('Threads'), 'renamed platform');
    await browser.clickVisible('button[aria-label="Delete platform Facebook"]');
    await waitFor(async () => !(await readSettings(evaluate)).mosaic.platformOptions.includes('Facebook'), 'deleted platform');

    savedPosts = await readPosts(evaluate);
    const updatedMosaicPost = savedPosts.find((post) => post.id === source.id);
    assert.deepEqual(updatedMosaicPost.platforms, ['Instagram', 'Threads']);
    assert.deepEqual(savedPosts.find((post) => post.id === otherBusinessPost.id).platforms, ['Facebook', 'Instagram']);
    const services = await readServices(evaluate);
    assert.deepEqual(services.find((service) => service.id === savedService.id).platforms, ['Instagram', 'Threads']);
    await browser.clickVisible('button[aria-label="Close content manager"]');

    await browser.clickVisible('.business-tabs .business-tab:nth-child(2)');
    await waitFor(() => evaluate("document.querySelector('.calendar-toolbar .toolbar-note')?.textContent.includes('Northline Financial')"),
      'other business switch');
    await browser.clickVisible('.manage-content');
    await waitFor(() => evaluate("Boolean(document.querySelector('.bcm-dialog'))"), 'other business content manager');
    const northlineSettings = (await readSettings(evaluate)).northline;
    assert.ok(northlineSettings.contentTypes.includes('Announcement'));
    assert.ok(northlineSettings.contentTypes.includes('Proof'));
    assert.ok(northlineSettings.platformOptions.includes('Facebook'));
    assert.equal(northlineSettings.platformOptions.includes('LinkedIn'), false);
    assert.equal(northlineSettings.platformOptions.includes('Threads'), false);
    assert.equal(await evaluate("document.querySelector('.bcm-section[aria-label=\"Content types\"] .bcm-item-name')?.textContent"), 'Announcement');
    await browser.clickVisible('button[aria-label="Close content manager"]');
    await browser.clickVisible('.business-tabs .business-tab:nth-child(1)');
    await waitFor(() => evaluate("document.querySelector('.calendar-toolbar .toolbar-note')?.textContent.includes('Mosaic Legal')"),
      'return to edited business');

    await browser.clickVisible('button.add-post');
    await waitFor(() => evaluate("Boolean(document.querySelector('.post-form'))"), 'post form with edited catalogs');
    const dropdownState = await evaluate(`(() => ({
      contentTypes: [...document.querySelectorAll('.post-form .form-grid label:nth-of-type(2) option')].map((option) => option.value),
      platforms: [...document.querySelectorAll('.post-form .platform-option')].map((item) => item.textContent.trim()),
      selectedPlatforms: [...document.querySelectorAll('.post-form .platform-option.selected')].map((item) => item.textContent.trim()),
    }))()`);
    assert.ok(dropdownState.contentTypes.includes('Case study'));
    assert.ok(dropdownState.contentTypes.includes('Evidence'));
    assert.equal(dropdownState.contentTypes.includes('Announcement'), false);
    assert.equal(dropdownState.platforms.includes('Facebook'), false);
    assert.ok(dropdownState.platforms.includes('LinkedIn'));
    assert.ok(dropdownState.platforms.includes('Threads'));
    assert.deepEqual(dropdownState.selectedPlatforms, ['Instagram', 'Threads']);

    await setField(evaluate, '.post-form .form-grid label:nth-of-type(1) select', 'Insurance');
    await setField(evaluate, '.post-form .form-grid label:nth-of-type(2) select', 'Case study');
    await setField(evaluate, '.post-form input[type="text"]', 'Content type color check');
    await setField(evaluate, '.post-form input[type="date"]', today);
    await evaluate("document.querySelector('.post-modal').scrollTop = document.querySelector('.post-modal').scrollHeight");
    await browser.clickVisible('.post-form-actions .save-post-button');
    await waitFor(async () => (await readPosts(evaluate)).some((post) => post.title === 'Content type color check'), 'post using a custom content type');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-popup'))"), 'post suggestion after save');
    await browser.clickVisible('.action-insight-skip');
    const colorEvent = await evaluate(`(() => {
      const event = [...document.querySelectorAll('.event-chip-button')]
        .find((button) => button.textContent.includes('Content type color check'));
      return {
        className: event?.className ?? '',
        hue: event?.style.getPropertyValue('--content-type-hue') ?? '',
      };
    })()`);
    assert.match(colorEvent.className, /event-content-type/);
    assert.match(colorEvent.hue, /^\d+$/);

    await evaluate(`(() => {
      document.querySelector('button.event-chip-button[aria-label^="Open saved post: Mosaic legacy announcement"]')
        ?.scrollIntoView({ block: 'center', inline: 'nearest' });
    })()`);
    await browser.clickVisible('button.event-chip-button[aria-label^="Open saved post: Mosaic legacy announcement"]');
    await waitFor(() => evaluate("Boolean(document.querySelector('[aria-labelledby=\"selected-post-title\"]'))"),
      'legacy post details after content type deletion');
    await evaluate("document.querySelector('.post-modal').scrollTop = document.querySelector('.post-modal').scrollHeight");
    await browser.clickVisible('button[aria-label="Mark post done"]');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-popup'))"), 'suggestions after deleting a required type');
    assert.doesNotMatch(await evaluate("document.querySelector('.action-insight-popup').innerText"), /Announcement/,
      'Suggestions skip content types that have been deleted.');
    await browser.clickVisible('.action-insight-skip');

    await browser.reload();
    await waitFor(() => evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim() === 'Mosaic Legal'"),
      'active business restored after catalog reload');
    assert.deepEqual((await readSettings(evaluate)).mosaic.platformOptions, ['Instagram', 'Threads', 'LinkedIn']);
    assert.ok((await readSettings(evaluate)).northline.platformOptions.includes('Facebook'));
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});

test('notification center records insights and approved plan changes per business', { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = startProcess('pnpm', ['--filter', '@workspace/marketing-tool', 'run', 'dev'], {
    cwd: workspaceDirectory, env: { ...process.env, PORT: String(port) },
  });
  let browser;
  const source = {
    id: 'notification-source',
    businessId: 'mosaic',
    project: 'Insurance',
    title: 'Notification source post',
    date: '2026-09-24',
    contentType: 'Announcement',
    platforms: ['Instagram'],
    distribution: 'organic',
    schedulingStatus: 'published',
  };
  const readNotifications = (evaluate) => evaluate(
    "JSON.parse(localStorage.getItem('marketing-tool.notifications') ?? '[]')",
  );
  try {
    await waitFor(async () => {
      if (server.child.exitCode !== null) throw new Error(server.getOutput());
      try { return (await fetch(origin)).ok; } catch { return false; }
    }, 'notification center test server');
    browser = await startCdpPage(origin);
    const { evaluate } = browser;
    await browser.resize(1280, 900);
    await evaluate(`localStorage.setItem('marketing-tool.user-posts', ${jsString(JSON.stringify([source]))})`);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('.business-tabs'))"), 'calendar with notification source');

    await openPost(evaluate, source);
    await clickButtonText(evaluate, 'Mark done');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-popup'))"), 'insight popup to archive');
    await waitFor(async () => (await readNotifications(evaluate)).some((item) => item.kind === 'insight'),
      'surfaced insight notification');
    await browser.clickVisible('button[aria-label="Dismiss insight"]');
    await waitFor(async () => (await readNotifications(evaluate)).some((item) =>
      item.kind === 'dismissed-banner' && item.action?.kind === 'reopen-insight'),
    'dismissed insight saved for reopening');

    await browser.clickVisible('.notification-bell');
    await waitFor(() => evaluate("Boolean(document.querySelector('.notification-panel'))"), 'notification panel');
    assert.equal(await evaluate("Boolean(document.querySelector('.notification-count'))"), false,
      'Opening the panel marks active-business notifications as read.');
    assert.match(await evaluate("document.querySelector('.notification-panel').innerText"), /Insight saved for later/);
    await browser.clickVisible('.notification-action');
    await waitFor(() => evaluate("Boolean(document.querySelector('.action-insight-popup'))"), 'insight reopened from notification');
    assert.match(await evaluate("document.querySelector('.action-insight-popup').innerText"), /Why this next step/i);
    assert.equal(await evaluate("Boolean(document.querySelector('.notification-panel'))"), false,
      'Selecting an action closes the panel.');

    await browser.clickVisible('.action-insight-add');
    await waitFor(async () => (await readNotifications(evaluate)).some((item) =>
      item.kind === 'plan-change' && item.action?.kind === 'calendar-post'),
    'approved suggestion notification');
    const planNotice = (await readNotifications(evaluate)).find((item) => item.kind === 'plan-change');
    assert.match(planNotice.title, /suggestion added|plan updated/i);
    assert.match(planNotice.subtitle, /Airtime balance updated/);

    await browser.clickVisible('.notification-bell');
    await waitFor(() => evaluate("Boolean(document.querySelector('.notification-panel'))"), 'plan notification panel');
    const viewAction = await evaluate(`(() => {
      const planItem = [...document.querySelectorAll('.notification-item')]
        .find((item) => item.innerText.includes(${jsString(planNotice.title)}));
      return planItem?.querySelector('.notification-action')?.textContent.trim();
    })()`);
    assert.equal(viewAction, 'View on calendar');
    const suggestedPostTitle = await evaluate(`JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')
      .find((post) => post.id === ${jsString(planNotice.action.postId)})?.title`);
    await browser.clickVisible('.calendar-title');
    await waitFor(() => evaluate("Boolean(document.querySelector('.notification-panel')) === false"), 'outside click closes the notification panel');
    await browser.clickVisible('.notification-bell');
    await browser.clickVisible(`[data-testid="notification-action-${planNotice.id}"]`);
    await waitFor(() => evaluate("Boolean(document.querySelector('.post-detail-modal'))"), 'post opened from calendar notification');
    assert.match(await evaluate("document.querySelector('.post-detail-modal').innerText"), new RegExp(suggestedPostTitle));
    await browser.clickVisible('.post-modal-header .modal-close');

    await browser.clickVisible('.notification-bell');
    await waitFor(() => evaluate("Boolean(document.querySelector('.notification-panel'))"), 'notifications before workspace switch');
    await browser.clickVisible('.business-tabs .business-tab:nth-child(2)');
    await waitFor(
      () => evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim() === 'Northline Financial'"),
      'switch to separate business notifications',
    );
    await browser.clickVisible('.notification-bell');
    await waitFor(() => evaluate("Boolean(document.querySelector('.notification-panel'))"), 'Northline notification panel');
    assert.match(await evaluate("document.querySelector('.notification-panel').innerText"), /Nothing here yet/);
    assert.equal(await evaluate("Boolean(document.querySelector('.notification-count'))"), false);
    await browser.clickVisible('.business-tabs .business-tab:nth-child(1)');
    await waitFor(
      () => evaluate("document.querySelector('.business-tab[aria-pressed=\"true\"]')?.textContent.trim() === 'Mosaic Legal'"),
      'return to business with stored notifications',
    );
    await browser.clickVisible('.notification-bell');
    await waitFor(() => evaluate("Boolean(document.querySelector('.notification-panel'))"), 'Mosaic notifications after returning');
    assert.match(await evaluate("document.querySelector('.notification-panel').innerText"), /Insight saved for later/);
    assert.match(await evaluate("document.querySelector('.notification-panel').innerText"), /New suggestion added|Plan updated/);
    await browser.clickVisible(`[data-testid="dismiss-notification-${planNotice.id}"]`);
    await waitFor(async () => !(await readNotifications(evaluate)).some((item) => item.id === planNotice.id),
      'individual plan notification dismissed');
    assert.ok((await readNotifications(evaluate)).some((item) => item.id !== planNotice.id),
      'Dismissing one item leaves other notifications intact.');

    await browser.clickVisible('.notification-clear-all');
    await waitFor(async () => (await readNotifications(evaluate)).every((item) => item.businessId !== 'mosaic'),
      'clear all removes only active-business notifications');
    assert.match(await evaluate("document.querySelector('.notification-panel').innerText"), /Nothing here yet/);
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});
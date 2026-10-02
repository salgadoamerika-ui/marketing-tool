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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url });
    await waitFor(
      () => evaluate("Boolean(document.querySelector('button.add-post'))"),
      'marketing calendar to render',
    );

    return {
      child,
      profileDirectory,
      socket,
      evaluate,
      reload: async () => {
        const loaded = waitForEvent('Page.loadEventFired');
        await send('Page.reload', { ignoreCache: true });
        await loaded;
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
      .find((button) => button.textContent.includes(${jsString(post.title)}));
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
  if (!keepOpen) await clickButtonText(evaluate, 'Keep post');
  await dismissInsight(evaluate);
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
  await clickButtonText(evaluate, 'Keep post');
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
  await clickButtonText(evaluate, 'Keep post');
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
      && item.contentType === 'Book now'
    ) ?? null;
  })()`);
  assert.ok(suggestion, `An approved booking suggestion should be saved for ${sourcePost.title}.`);
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
      return posts.filter((post) => post.schedulingStatus === 'approved-suggestion').length;
    })()`);
    assert.ok(approvedSuggestionsPersisted >= 6, 'Approved suggestions should retain their status after refresh.');
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

test('saving results reveals conversion gaps, respects Skip, and adds trust then offer only on approval', { timeout: 120000 }, async () => {
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
    measured('first', '03', { views: 100, saves: 10, bookings: 0 }),
    measured('second', '06', { views: 100, saves: 10, bookings: 4 }),
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
    assert.match(await evaluate("document.querySelector('.conversion-gap-panel').textContent"), /2\/3 measured posts/);
    await clickButtonText(evaluate, 'Keep post');

    await openPost(evaluate, posts[2]);
    await saveResults(evaluate, { ...posts[2], views: 100, saves: 10, bookings: 4 }, { keepOpen: true });
    await waitFor(() => evaluate("Boolean(document.querySelector('.conversion-gap-detected'))"), 'gap after third result');
    assert.match(await evaluate("document.querySelector('.conversion-gap-panel').textContent"), /Conversion check first/);
    assert.equal((await readPosts(evaluate)).length, 3, 'Detection must not silently add a calendar post.');
    await clickButtonText(evaluate, 'Skip suggestion');
    assert.equal((await readPosts(evaluate)).length, 3, 'Skip must not create a follow-up.');
    await clickButtonText(evaluate, 'Keep post');

    await openPost(evaluate, posts[0]);
    await click(evaluate, '.conversion-gap-actions .save-post-button');
    const trust = await waitFor(async () => (await readPosts(evaluate)).find((post) => post.suggestionKind === 'trust'), 'approved testimonial');
    assert.equal(trust.contentType, 'Testimonial');
    assert.equal(trust.sourcePostId, 'first');
    assert.equal(trust.schedulingStatus, 'approved-suggestion');
    await openPost(evaluate, trust);
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-actions'))"), false, 'Offer waits for testimonial results.');
    await saveResults(evaluate, { ...trust, views: 100, saves: 10, bookings: 0 }, { keepOpen: true });
    await waitFor(() => evaluate("document.querySelector('.conversion-gap-panel').textContent.includes('lower-barrier referral offer')"), 'offer after weak testimonial');
    await click(evaluate, '.conversion-gap-actions .save-post-button');
    const offer = await waitFor(async () => (await readPosts(evaluate)).find((post) => post.suggestionKind === 'offer'), 'approved referral offer');
    assert.equal(offer.sourcePostId, 'first');
    assert.equal((await readPosts(evaluate)).length, 5);
    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after reload');
    await openPost(evaluate, offer);
    await saveResults(evaluate, { ...offer, views: 100, saves: 10, bookings: 0 }, { keepOpen: true });
    assert.equal(await evaluate("Boolean(document.querySelector('.conversion-gap-actions'))"), false, 'No duplicate or third conversion stage.');
    assert.equal((await readPosts(evaluate)).length, 5);
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});
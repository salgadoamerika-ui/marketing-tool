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

async function dismissInsight(evaluate) {
  await evaluate("document.querySelector('button.action-insight-skip')?.click() ?? true");
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

async function createPost(evaluate, post) {
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
  await dismissInsight(evaluate);
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
    () => evaluate("Boolean(document.querySelector('[aria-label=\"Best time recommendation\"]'))"),
    `details for ${post.title}`,
  );
}

async function readRecommendation(evaluate) {
  return evaluate("document.querySelector('[aria-label=\"Best time recommendation\"] .post-best-time-label')?.textContent?.trim() ?? ''");
}

async function saveResults(evaluate, post) {
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
    setValue(inputs[0], ${jsString(post.views)});
    setValue(inputs[1], '0');
    setValue(inputs[2], '0');
    const time = form.querySelector('input[type=\"time\"]');
    if (!time) throw new Error('Actual posting time field is missing.');
    setValue(time, ${jsString(post.postedTime)});
    form.querySelector('button[type=\"submit\"]').click();
    return true;
  })()`);
  await waitFor(
    () => evaluate("!document.querySelector('[aria-labelledby=\"selected-post-title\"]')"),
    `post details to close after saving ${post.title}`,
  );
  await dismissInsight(evaluate);
  const persistedPost = await waitFor(async () => {
    const posts = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
    return posts.find((item) => item.title === post.title && item.postedTime === post.postedTime);
  }, `saved metrics and posting time for ${post.title}`);
  assert.equal(persistedPost.performance.views, post.views);
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

const learnedPosts = [
  { service: 'Tax planning', date: '2026-10-06', postedTime: '09:00', views: 600, title: 'Tax timing sample 1' },
  { service: 'Tax planning', date: '2026-10-13', postedTime: '10:30', views: 500, title: 'Tax timing sample 2' },
  { service: 'Tax planning', date: '2026-10-20', postedTime: '11:45', views: 400, title: 'Tax timing sample 3' },
];
const isolatedServicePosts = [
  { service: 'Insurance', date: '2026-10-01', postedTime: '18:00', views: 900, title: 'Insurance timing sample 1' },
  { service: 'Insurance', date: '2026-10-08', postedTime: '19:00', views: 1000, title: 'Insurance timing sample 2' },
  { service: 'Insurance', date: '2026-10-15', postedTime: '20:30', views: 1100, title: 'Insurance timing sample 3' },
];

test('learned timing updates through saved results, stays service-specific, and survives reload', { timeout: 120000 }, async () => {
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

    for (const [index, post] of learnedPosts.entries()) {
      await createPost(evaluate, post);
      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), 'Best time · suggested');
      await saveResults(evaluate, post);
      await openPost(evaluate, post);
      const expected = index < 2
        ? 'Best time · suggested'
        : 'Best time · from your results: Tuesday mornings';
      await waitFor(async () => (await readRecommendation(evaluate)) === expected, `${post.title} recommendation to update`);
      assert.equal(await readRecommendation(evaluate), expected);
      await assertCalendarMode(evaluate, post, index < 2 ? 'suggested' : 'learned');
    }

    for (const [index, post] of isolatedServicePosts.entries()) {
      await createPost(evaluate, post);
      await openPost(evaluate, post);
      assert.equal(await readRecommendation(evaluate), 'Best time · suggested');
      await saveResults(evaluate, post);
      await openPost(evaluate, post);
      const expected = index < 2
        ? 'Best time · suggested'
        : 'Best time · from your results: Thursday evenings';
      await waitFor(async () => (await readRecommendation(evaluate)) === expected, `${post.title} recommendation to update`);
      assert.equal(await readRecommendation(evaluate), expected);
      await assertCalendarMode(evaluate, post, index < 2 ? 'suggested' : 'learned');
    }

    await openPost(evaluate, learnedPosts[2]);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Tuesday mornings');
    await clickButtonText(evaluate, 'Keep post');

    await browser.reload();
    await waitFor(() => evaluate("Boolean(document.querySelector('button.add-post'))"), 'calendar after reload');
    const measuredTitles = new Set([...learnedPosts, ...isolatedServicePosts].map((post) => post.title));
    const savedCount = await waitFor(async () => {
      const posts = await evaluate("JSON.parse(localStorage.getItem('marketing-tool.user-posts') ?? '[]')");
      const savedMeasuredPosts = posts.filter((post) => measuredTitles.has(post.title));
      const allResultsSaved = savedMeasuredPosts.every((post) =>
        Number.isSafeInteger(post.performance?.views) && typeof post.postedTime === 'string'
      );
      return savedMeasuredPosts.length === 6 && allResultsSaved ? savedMeasuredPosts.length : false;
    }, 'all six measured posts and results to persist');
    assert.equal(savedCount, 6);

    await openPost(evaluate, learnedPosts[2]);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Tuesday mornings');
    await clickButtonText(evaluate, 'Keep post');
    await openPost(evaluate, isolatedServicePosts[2]);
    assert.equal(await readRecommendation(evaluate), 'Best time · from your results: Thursday evenings');
  } finally {
    if (browser) await browser.close();
    await stopProcess(server.child);
  }
});
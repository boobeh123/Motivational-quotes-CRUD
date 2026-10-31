const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseBatch, createInspiration } = require('../middleware/inspire');

const zen = (q, a) => ({ q, a, c: String(q.length), h: `<blockquote>${q}</blockquote>` });
const BATCH = [zen('First quote', 'Author One'), zen('Second quote', 'Author Two')];

// A fake fetch: answers with the replies given, one per call, and counts calls
const fakeFetch = (...replies) => {
    const calls = [];
    const fetchFn = async (url, options) => {
        calls.push({ url, options });
        const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
        if (reply instanceof Error) {
            throw reply;
        }
        return { ok: reply.status === 200, status: reply.status, json: async () => reply.body };
    };
    return { fetchFn, calls };
};
const ok = (body) => ({ status: 200, body });

test('parseBatch keeps quote and author text, and drops the rest', () => {
    assert.deepEqual(parseBatch(BATCH), [
        { quote: 'First quote', author: 'Author One' },
        { quote: 'Second quote', author: 'Author Two' },
    ]);
    assert.deepEqual(parseBatch([zen('  Spaced  ', ' Someone ')]), [{ quote: 'Spaced', author: 'Someone' }]);
    // Their "too many requests" notice comes as a quote by zenquotes.io
    assert.deepEqual(parseBatch([zen('Too many requests. Obtain an auth key for unlimited access.', 'zenquotes.io')]), []);
    assert.deepEqual(parseBatch([{ q: 5, a: 'X' }, { q: 'Y' }, { q: '', a: 'Z' }, null]), []);
    assert.deepEqual(parseBatch({ error: 'nope' }), []);
});

test('fetches one batch and serves from it for an hour', async () => {
    let clock = 0;
    const { fetchFn, calls } = fakeFetch(ok(BATCH), ok([zen('Third quote', 'Author Three')]));
    const inspire = createInspiration({ fetchFn, now: () => clock, random: () => 0.99, url: 'https://zen.test/api/quotes' });
    assert.deepEqual(await inspire(), { quote: 'Second quote', author: 'Author Two' });
    clock += 59 * 60 * 1000;
    await inspire();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://zen.test/api/quotes');
    assert.ok(calls[0].options.signal, 'the fetch has a timeout signal');
    // An hour later, a new batch
    clock += 2 * 60 * 1000;
    assert.deepEqual(await inspire(), { quote: 'Third quote', author: 'Author Three' });
    assert.equal(calls.length, 2);
});

test('requests that arrive together share one fetch', async () => {
    const { fetchFn, calls } = fakeFetch(ok(BATCH));
    const inspire = createInspiration({ fetchFn, now: () => 0, random: () => 0 });
    const quotes = await Promise.all([inspire(), inspire(), inspire()]);
    assert.equal(calls.length, 1);
    assert.deepEqual(quotes.map((q) => q.quote), ['First quote', 'First quote', 'First quote']);
});

test('with no batch yet, a failure throws, and the next try waits a minute', async () => {
    let clock = 0;
    const { fetchFn, calls } = fakeFetch(new Error('network down'), ok(BATCH));
    const inspire = createInspiration({ fetchFn, now: () => clock, random: () => 0 });
    await assert.rejects(inspire(), /network down/);
    clock += 30 * 1000;
    await assert.rejects(inspire(), /No ZenQuotes batch yet/);
    assert.equal(calls.length, 1, 'no second call within the minute');
    clock += 31 * 1000;
    assert.equal((await inspire()).quote, 'First quote');
    assert.equal(calls.length, 2);
});

test('a failed refresh keeps serving the old batch', async () => {
    let clock = 0;
    const { fetchFn, calls } = fakeFetch(ok(BATCH), { status: 503, body: null }, ok([zen('Too many requests', 'zenquotes.io')]));
    const inspire = createInspiration({ fetchFn, now: () => clock, random: () => 0 });
    await inspire();
    const quiet = console.error;
    console.error = () => {};
    try {
        clock += 61 * 60 * 1000;
        assert.equal((await inspire()).quote, 'First quote', 'a 503 keeps the old batch');
        clock += 61 * 1000;
        assert.equal((await inspire()).quote, 'First quote', 'a rate-limit notice keeps the old batch');
    } finally {
        console.error = quiet;
    }
    assert.equal(calls.length, 3);
});

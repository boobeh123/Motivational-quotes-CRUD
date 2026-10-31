// "Inspire me": a random quote from the ZenQuotes API.
// - Their free tier allows 5 requests per 30 seconds and asks that batches be
//   cached, so the server fetches 50 quotes at most once an hour and serves
//   from those.
// - Their terms forbid republishing their quotes, so these are only shown,
//   with the credit their free tier requires, and never saved.
// - The browser only ever talks to WisdomWell (GET /api/inspire), so the CSP
//   doesn't change and visitors' details never reach ZenQuotes.
// createInspiration() takes a fetch and a clock, so test/inspire.test.js can
// run it without calling ZenQuotes.

const ZENQUOTES_URL = process.env.ZENQUOTES_URL || 'https://zenquotes.io/api/quotes';
const CACHE_FOR = 60 * 60 * 1000; // an hour
const RETRY_AFTER = 60 * 1000;    // after a failed fetch, wait a minute before the next
const TIMEOUT = 5000;

// Keeps the well-formed quotes from a ZenQuotes reply, as { quote, author }.
// Over their limit, ZenQuotes answers with a "quote" by zenquotes.io saying
// "Too many requests", so those are dropped too.
const parseBatch = (data) => (Array.isArray(data) ? data : [])
    .filter((item) => typeof item?.q === 'string' && typeof item?.a === 'string')
    .map((item) => ({ quote: item.q.trim(), author: item.a.trim() }))
    .filter(({ quote, author }) => quote && author && author.toLowerCase() !== 'zenquotes.io');

const createInspiration = ({ fetchFn = fetch, now = Date.now, random = Math.random, url = ZENQUOTES_URL } = {}) => {
    let batch = [];
    let fetchedAt = 0;
    let failedAt = -Infinity;
    // One fetch at a time: requests that arrive meanwhile wait for the same one
    let pending = null;

    const refresh = async () => {
        try {
            const reply = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT) });
            if (!reply.ok) {
                throw new Error(`ZenQuotes answered ${reply.status}`);
            }
            const quotes = parseBatch(await reply.json());
            if (!quotes.length) {
                throw new Error('ZenQuotes sent no usable quotes');
            }
            batch = quotes;
            fetchedAt = now();
        } catch (error) {
            failedAt = now();
            throw error;
        }
    };

    // Returns a random { quote, author }. Throws only when there's no batch at
    // all; a failed refresh keeps serving the old one.
    return async () => {
        const stale = !batch.length || now() - fetchedAt > CACHE_FOR;
        const mayRetry = now() - failedAt > RETRY_AFTER;
        if (stale && mayRetry) {
            pending = pending || refresh().finally(() => { pending = null; });
            try {
                await pending;
            } catch (error) {
                if (!batch.length) {
                    throw error;
                }
                console.error('Keeping the last ZenQuotes batch:', error.message);
            }
        }
        if (!batch.length) {
            throw new Error('No ZenQuotes batch yet');
        }
        return batch[Math.floor(random() * batch.length)];
    };
};

module.exports = { parseBatch, createInspiration };

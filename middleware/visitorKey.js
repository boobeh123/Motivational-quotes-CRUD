// The browser key that lets whoever added a quote edit or delete it, without
// accounts. A browser's first saved quote gives it a random key in the ww_key
// cookie, and each quote stores only a SHA-256 hash of that key (ownerHash).
// The page never shows hashes. Pure helpers, so test/visitorKey.test.js can
// run them without a server.
const crypto = require('crypto');

const COOKIE_NAME = 'ww_key';
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

// 32 random bytes in base64url: 43 characters of A-Z, a-z, 0-9, - and _
const KEY_FORMAT = /^[A-Za-z0-9_-]{43}$/;

const newVisitorKey = () => crypto.randomBytes(32).toString('base64url');

const isVisitorKey = (value) => typeof value === 'string' && KEY_FORMAT.test(value);

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

// Finds one cookie's value in a Cookie header, or returns null
const readCookie = (header, name) => {
    if (typeof header !== 'string') {
        return null;
    }
    for (const part of header.split(';')) {
        const [key, ...value] = part.trim().split('=');
        if (key === name) {
            return value.join('=');
        }
    }
    return null;
};

// Middleware: req.visitorHash is the hash of a valid ww_key cookie, or null
const loadVisitor = (req, res, next) => {
    const key = readCookie(req.headers.cookie, COOKIE_NAME);
    req.visitorHash = isVisitorKey(key) ? hashKey(key) : null;
    next();
};

// Gives the browser a key if it has none yet. Returns the visitor's hash.
const giveVisitorKey = (req, res) => {
    if (!req.visitorHash) {
        const key = newVisitorKey();
        res.cookie(COOKIE_NAME, key, {
            httpOnly: true,
            sameSite: 'lax',
            // HTTPS on Railway (req.secure trusts the proxy), plain HTTP locally
            secure: req.secure,
            maxAge: ONE_YEAR,
        });
        req.visitorHash = hashKey(key);
    }
    return req.visitorHash;
};

// True for a form post sent from another site. A browser doesn't send ww_key
// with a cross-site post, so the reply would hand it a new key, replacing the
// visitor's own and costing them their quotes.
const isCrossSite = (req) => {
    // Current browsers (Chrome, Firefox, Safari 16.4+) say where a request
    // came from in Sec-Fetch-Site
    const site = req.get('sec-fetch-site');
    if (site) {
        return site !== 'same-origin';
    }
    // Older browsers: Origin. helmet's no-referrer policy makes browsers send
    // "null" even for this site's own form, so only another real origin counts.
    const origin = req.get('origin');
    return Boolean(origin && origin !== 'null' && origin !== `${req.protocol}://${req.get('host')}`);
};

module.exports = { COOKIE_NAME, newVisitorKey, isVisitorKey, hashKey, readCookie, loadVisitor, giveVisitorKey, isCrossSite };

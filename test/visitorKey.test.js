const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newVisitorKey, isVisitorKey, hashKey, readCookie, isCrossSite } = require('../middleware/visitorKey');

test('new keys are 43 base64url characters, and differ', () => {
    const first = newVisitorKey();
    const second = newVisitorKey();
    assert.equal(isVisitorKey(first), true);
    assert.equal(first.length, 43);
    assert.notEqual(first, second);
});

test('isVisitorKey refuses anything else', () => {
    assert.equal(isVisitorKey('a'.repeat(43)), true);
    assert.equal(isVisitorKey('a'.repeat(42)), false);
    assert.equal(isVisitorKey('a'.repeat(44)), false);
    assert.equal(isVisitorKey(`${'a'.repeat(42)}=`), false);
    assert.equal(isVisitorKey(`${'a'.repeat(42)}/`), false);
    assert.equal(isVisitorKey(null), false);
    assert.equal(isVisitorKey(undefined), false);
    assert.equal(isVisitorKey(['a'.repeat(43)]), false);
});

test('hashKey is a stable 64-character hex SHA-256', () => {
    const key = newVisitorKey();
    assert.match(hashKey(key), /^[0-9a-f]{64}$/);
    assert.equal(hashKey(key), hashKey(key));
    assert.notEqual(hashKey(key), hashKey(newVisitorKey()));
    assert.equal(hashKey('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('readCookie finds one cookie in a Cookie header', () => {
    assert.equal(readCookie('ww_key=abc', 'ww_key'), 'abc');
    assert.equal(readCookie('a=1; ww_key=abc; b=2', 'ww_key'), 'abc');
    assert.equal(readCookie('a=1;ww_key=abc', 'ww_key'), 'abc');
    assert.equal(readCookie('a=1; b=2', 'ww_key'), null);
    assert.equal(readCookie('my_ww_key=abc', 'ww_key'), null);
    assert.equal(readCookie('ww_key=a=b', 'ww_key'), 'a=b');
    assert.equal(readCookie(undefined, 'ww_key'), null);
    assert.equal(readCookie('', 'ww_key'), null);
});

test('isCrossSite flags posts from other sites', () => {
    const request = (headers, protocol = 'https') => ({
        protocol,
        get: (name) => headers[name.toLowerCase()],
    });
    const host = { host: 'wisdomwell.up.railway.app' };
    // The page's own form, as Chromium sends it: helmet's no-referrer policy
    // turns Origin into "null"
    assert.equal(isCrossSite(request({ ...host, origin: 'null', 'sec-fetch-site': 'same-origin' })), false);
    assert.equal(isCrossSite(request({ ...host, origin: 'https://wisdomwell.up.railway.app', 'sec-fetch-site': 'same-origin' })), false);
    // No browser headers at all (curl, scripts)
    assert.equal(isCrossSite(request(host)), false);
    // Another site, by Sec-Fetch-Site, whatever Origin says
    assert.equal(isCrossSite(request({ ...host, origin: 'null', 'sec-fetch-site': 'cross-site' })), true);
    assert.equal(isCrossSite(request({ ...host, 'sec-fetch-site': 'same-site' })), true);
    // Older browsers without Sec-Fetch-Site: only a real other origin counts
    assert.equal(isCrossSite(request({ ...host, origin: 'https://evil.example' })), true);
    assert.equal(isCrossSite(request({ ...host, origin: 'null' })), false);
    // Same host over plain HTTP locally
    assert.equal(isCrossSite(request({ host: '127.0.0.1:3998', origin: 'http://127.0.0.1:3998' }, 'http')), false);
});

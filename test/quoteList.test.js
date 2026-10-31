const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MAX_SEARCH_LENGTH, readListOptions, listQuery, listUrl } = require('../middleware/quoteList');

test('readListOptions falls back to most liked, no search', () => {
    assert.deepEqual(readListOptions({}), { sort: 'top', q: '' });
    assert.deepEqual(readListOptions(undefined), { sort: 'top', q: '' });
    assert.deepEqual(readListOptions({ sort: 'new' }), { sort: 'new', q: '' });
    assert.deepEqual(readListOptions({ sort: 'NEW' }), { sort: 'top', q: '' });
    assert.deepEqual(readListOptions({ sort: ['new'] }), { sort: 'top', q: '' });
    assert.deepEqual(readListOptions({ sort: 'likes' }), { sort: 'top', q: '' });
});

test('readListOptions tidies the search, and ignores anything but text', () => {
    assert.equal(readListOptions({ q: '  Maya   Angelou ' }).q, 'Maya Angelou');
    assert.equal(readListOptions({ q: ['a', 'b'] }).q, '');
    assert.equal(readListOptions({ q: { $ne: '' } }).q, '');
    assert.equal(readListOptions({ q: 'x'.repeat(150) }).q.length, MAX_SEARCH_LENGTH);
});

test('listQuery sorts by likes, or newest first', () => {
    assert.deepEqual(listQuery({ sort: 'top', q: '' }), { filter: {}, sort: { likes: -1, _id: -1 } });
    assert.deepEqual(listQuery({ sort: 'new', q: '' }), { filter: {}, sort: { _id: -1 } });
});

test('listQuery searches quote and author as plain lowercase text', () => {
    const contains = (field, term) => ({ $gte: [{ $indexOfCP: [{ $toLower: field }, { $literal: term }] }, 0] });
    assert.deepEqual(listQuery({ sort: 'top', q: 'Rumi' }).filter, {
        $expr: { $or: [contains('$quote', 'rumi'), contains('$name', 'rumi')] }
    });
    // Words that look like field names or patterns stay plain text
    assert.deepEqual(listQuery({ sort: 'top', q: '$likes' }).filter.$expr.$or[0], contains('$quote', '$likes'));
    assert.deepEqual(listQuery({ sort: 'top', q: '.*' }).filter.$expr.$or[1], contains('$name', '.*'));
});

test('listUrl keeps only what differs from the defaults', () => {
    assert.equal(listUrl({ sort: 'top', q: '' }), '/');
    assert.equal(listUrl({ sort: 'new', q: '' }), '/?sort=new');
    assert.equal(listUrl({ sort: 'top', q: 'rumi' }), '/?q=rumi');
    assert.equal(listUrl({ sort: 'new', q: 'José & co' }), '/?sort=new&q=Jos%C3%A9+%26+co');
});

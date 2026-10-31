const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MAX_NAME_LENGTH, MAX_QUOTE_LENGTH, checkQuoteInput, isQuoteId } = require('../middleware/validators');

test('accepts the punctuation, letters and emoji people type', () => {
    const quotes = [
        'Note: this has a colon',
        'Don’t stop',
        'Be 100% in; then rest',
        'Life (as we know it) & more',
        '“Curly quotes” — and an em dash…',
        'Ça va? 🙂 👨‍👩‍👧',
        'He said "go" and <b>left</b>',
    ];
    for (const quote of quotes) {
        assert.deepEqual(checkQuoteInput({ name: 'José Martí', quote }), { name: 'José Martí', quote });
    }
});

test('trims the text and collapses runs of whitespace', () => {
    assert.deepEqual(
        checkQuoteInput({ name: '  Maya   Angelou ', quote: '\tNothing will work\n\nunless you do.  ' }),
        { name: 'Maya Angelou', quote: 'Nothing will work unless you do.' }
    );
});

test('requires both fields, as text', () => {
    const required = { error: 'Name and quote are required' };
    assert.deepEqual(checkQuoteInput(undefined), required);
    assert.deepEqual(checkQuoteInput({}), required);
    assert.deepEqual(checkQuoteInput({ name: 'Rumi' }), required);
    assert.deepEqual(checkQuoteInput({ name: '   ', quote: 'Something' }), required);
    assert.deepEqual(checkQuoteInput({ name: 'Rumi', quote: ' \n ' }), required);
    // A JSON body can send a list or an object where text belongs
    assert.deepEqual(checkQuoteInput({ name: ['Rumi'], quote: 'Something' }), required);
    assert.deepEqual(checkQuoteInput({ name: 'Rumi', quote: { $ne: '' } }), required);
    assert.deepEqual(checkQuoteInput({ name: 'Rumi', quote: 42 }), required);
});

test('enforces the length limits, after trimming', () => {
    assert.deepEqual(checkQuoteInput({ name: 'a'.repeat(MAX_NAME_LENGTH), quote: 'b'.repeat(MAX_QUOTE_LENGTH) }),
        { name: 'a'.repeat(MAX_NAME_LENGTH), quote: 'b'.repeat(MAX_QUOTE_LENGTH) });
    assert.deepEqual(checkQuoteInput({ name: ` ${'a'.repeat(MAX_NAME_LENGTH)} `, quote: 'b' }).name, 'a'.repeat(MAX_NAME_LENGTH));
    assert.deepEqual(checkQuoteInput({ name: 'a'.repeat(MAX_NAME_LENGTH + 1), quote: 'b' }),
        { error: 'Name must be 100 characters or fewer' });
    assert.deepEqual(checkQuoteInput({ name: 'a', quote: 'b'.repeat(MAX_QUOTE_LENGTH + 1) }),
        { error: 'Quote must be 500 characters or fewer' });
});

test('refuses links', () => {
    for (const quote of ['Visit https://example.com', 'see http://spam.example', 'WWW.EXAMPLE.COM is great']) {
        assert.deepEqual(checkQuoteInput({ name: 'Rumi', quote }), { error: "Links aren't allowed in quotes" });
    }
    assert.deepEqual(checkQuoteInput({ name: 'www.spam.example', quote: 'Hi' }), { error: "Links aren't allowed in names" });
    // Words that only look a little like links are fine
    assert.equal(checkQuoteInput({ name: 'Rumi', quote: 'Find the way: www is not a word.' }).error, undefined);
});

test('refuses control characters and direction overrides', () => {
    assert.deepEqual(checkQuoteInput({ name: 'Rumi', quote: 'Null\u0000byte' }), { error: 'Quote contains hidden characters' });
    assert.deepEqual(checkQuoteInput({ name: 'Ru‮mi', quote: 'Hi' }), { error: 'Name contains hidden characters' });
    assert.deepEqual(checkQuoteInput({ name: 'Rumi', quote: 'Isolate ⁦this⁩' }), { error: 'Quote contains hidden characters' });
});

test('isQuoteId accepts only 24 hex characters', () => {
    assert.equal(isQuoteId('6ae55ee424c213d551d546a7'), true);
    assert.equal(isQuoteId('6AE55EE424C213D551D546A7'), true);
    assert.equal(isQuoteId('aaaaaaaaaaaa'), false); // 12 characters: ObjectId.isValid says yes
    assert.equal(isQuoteId('6ae55ee424c213d551d546a'), false);
    assert.equal(isQuoteId('6ae55ee424c213d551d546az'), false);
    assert.equal(isQuoteId(undefined), false);
    assert.equal(isQuoteId(12345), false);
    assert.equal(isQuoteId({ id: '6ae55ee424c213d551d546a7' }), false);
});

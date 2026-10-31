// Checks for what visitors send. Pure functions, so test/validators.test.js
// can run them without a server or a database.

const MAX_NAME_LENGTH = 100;
const MAX_QUOTE_LENGTH = 500;

// Control characters, and the invisible marks that reverse the direction text
// is shown in (they can make a quote look different from what was saved)
const HIDDEN_CHARACTERS = /[\p{Cc}‪-‮⁦-⁩]/u;

// A web address: http:// or https:// anywhere, or a www. prefix
const LINK = /https?:\/\/|www\./i;

// Trims a field and turns each run of spaces, tabs or line breaks into one space
const tidy = (text) => text.trim().replace(/\s+/g, ' ');

// Checks one field. Returns an error message, or null when it's fine.
const fieldError = (text, label, maxLength) => {
    if (!text) {
        return 'Name and quote are required';
    }
    if (text.length > maxLength) {
        return `${label} must be ${maxLength} characters or fewer`;
    }
    if (HIDDEN_CHARACTERS.test(text)) {
        return `${label} contains hidden characters`;
    }
    if (LINK.test(text)) {
        return `Links aren't allowed in ${label === 'Name' ? 'names' : 'quotes'}`;
    }
    return null;
};

// Checks the add and edit forms. Anything people type is allowed (colons,
// curly quotes, accents, emoji), because EJS escapes it on the page; what's
// refused is missing or overlong text, hidden characters and links.
// Returns { name, quote } ready to save, or { error } to show the visitor.
const checkQuoteInput = (body) => {
    const { name, quote } = body ?? {};
    if (typeof name !== 'string' || typeof quote !== 'string') {
        return { error: 'Name and quote are required' };
    }

    const cleanName = tidy(name);
    const cleanQuote = tidy(quote);
    const error = fieldError(cleanName, 'Name', MAX_NAME_LENGTH) ||
        fieldError(cleanQuote, 'Quote', MAX_QUOTE_LENGTH);

    return error ? { error } : { name: cleanName, quote: cleanQuote };
};

// A quote id is the 24-character hex string MongoDB created. ObjectId.isValid
// isn't enough on its own: it also accepts any 12-character string.
const isQuoteId = (id) => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);

module.exports = { MAX_NAME_LENGTH, MAX_QUOTE_LENGTH, tidy, checkQuoteInput, isQuoteId };

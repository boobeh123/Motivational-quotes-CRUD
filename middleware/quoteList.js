// How the home page lists quotes: the sort and search in its address
// (?sort=new&q=…), the database query for them, and links that keep them.
// Pure functions, so test/quoteList.test.js can run them without a database.
const { tidy } = require('./validators');

const MAX_SEARCH_LENGTH = 100;

// Reads ?sort and ?q. Anything unexpected falls back to the defaults (most
// liked, no search): a list from ?q=a&q=b, an unknown sort, a search that's
// too long (it's cut to the limit).
const readListOptions = (query) => {
    const sort = query?.sort === 'new' ? 'new' : 'top';
    const q = typeof query?.q === 'string' ? tidy(query.q).slice(0, MAX_SEARCH_LENGTH) : '';
    return { sort, q };
};

// The filter and sort for those options. A search matches quotes whose text
// or author contains it, ignoring case. $indexOfCP looks for the words as
// they are, so nothing typed becomes a regex, and $literal keeps a search
// like "$likes" from being read as a field name. MongoDB's $toLower only
// lowercases A-Z, so an uppercase accented letter in a quote won't match a
// lowercase search.
const listQuery = ({ sort, q }) => {
    const term = q.toLowerCase();
    const contains = (field) => ({ $gte: [{ $indexOfCP: [{ $toLower: field }, { $literal: term }] }, 0] });
    return {
        filter: q ? { $expr: { $or: [contains('$quote'), contains('$name')] } } : {},
        // Newest first by _id, which holds the creation time (2022 quotes have no createdAt)
        sort: sort === 'new' ? { _id: -1 } : { likes: -1, _id: -1 }
    };
};

// The home page address for a sort and search. The defaults stay out of it.
const listUrl = ({ sort, q }) => {
    const params = new URLSearchParams();
    if (sort === 'new') {
        params.set('sort', 'new');
    }
    if (q) {
        params.set('q', q);
    }
    const query = params.toString();
    return query ? `/?${query}` : '/';
};

module.exports = { MAX_SEARCH_LENGTH, readListOptions, listQuery, listUrl };

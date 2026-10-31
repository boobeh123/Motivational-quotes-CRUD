require('dotenv').config();
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const { ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { MAX_NAME_LENGTH, MAX_QUOTE_LENGTH, checkQuoteInput, isQuoteId } = require('./middleware/validators');
const { loadVisitor, giveVisitorKey, isCrossSite } = require('./middleware/visitorKey');
const { MAX_SEARCH_LENGTH, readListOptions, listQuery, listUrl } = require('./middleware/quoteList');
const { createInspiration } = require('./middleware/inspire');
const PORT = process.env.PORT || 3000;

// Railway sends each request through one proxy. Trusting that one hop makes
// req.ip the visitor's address, so the rate limiter counts visitors, not the proxy.
app.set('trust proxy', 1);

// Security middleware with custom CSP. No 'unsafe-inline': the pages have no
// inline scripts, onclick-style attributes or style="" attributes, so keep it
// that way (setting element.style from main.js is still allowed). cdnjs serves
// Font Awesome and Google serves the fonts.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    }
}));

// Views and static files. Static files come before the rate limiter, so the
// CSS, JS and icons each page loads don't count toward it.
app.set('view engine', 'ejs');
// The forms' maxlength attributes use the same limits the server checks
app.locals.limits = { name: MAX_NAME_LENGTH, quote: MAX_QUOTE_LENGTH, search: MAX_SEARCH_LENGTH };
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Request size limits. inflate: false refuses compressed bodies (415): browsers
// never compress a form post or a fetch() body, and decompressing one reached
// the Brotli bug fixed in Node's Oct 2026 security release.
app.use(express.json({ limit: '10kb', inflate: false }));
// extended: false keeps a field like name[$ne] a plain key instead of an object
app.use(express.urlencoded({ extended: false, limit: '10kb', inflate: false }));

// req.visitorHash: which browser this is, from its ww_key cookie (null without one)
app.use(loadVisitor);

// Validate required environment variables
if (!process.env.DB_STRING) {
    console.error('MongoDB connection string is missing. Please check your .env file.');
    process.exit(1);
}

// Constants
const DB_NAME = 'motivational-quotes';
const COLL_NAME = 'quotes';

let db;

// "Inspire me": random quotes from ZenQuotes, cached an hour (middleware/inspire.js)
const inspire = createInspiration();

// Sends an error page to browsers, and JSON to the page's fetch() calls,
// which ask for it with their Accept header
const sendError = (request, response, status, title, message) => {
    if (request.accepts(['html', 'json']) === 'json') {
        return response.status(status).json({ error: message });
    }
    response.status(status).render('error.ejs', { title, message });
};

// Renders the home page. When the add form was turned away, the page also
// says why, with what the visitor typed still in the boxes.
const renderHome = async (request, response, status, form = {}) => {
    // The sort and search come from the address: most liked first (newest
    // first among equal likes) unless it says ?sort=new, and every quote
    // unless it has ?q=
    const options = readListOptions(request.query);
    const { filter, sort } = listQuery(options);
    const found = await db.collection(COLL_NAME).find(filter).sort(sort).toArray();
    // Mark the quotes this browser added or liked, and keep every hash off the page
    const quotes = found.map(({ ownerHash, likedBy, ...quote }) => ({
        ...quote,
        isOwner: Boolean(ownerHash) && ownerHash === request.visitorHash,
        likedByViewer: Boolean(request.visitorHash) && Array.isArray(likedBy) && likedBy.includes(request.visitorHash)
    }));
    const typed = (value) => (typeof value === 'string' ? value : '');
    response.status(status).render('index.ejs', {
        quotes,
        formError: form.error ?? null,
        formValues: { name: typed(form.values?.name), quote: typed(form.values?.quote) },
        // The links keep the other setting: sorting keeps the search, and
        // clearing the search keeps the sort
        list: {
            ...options,
            topUrl: listUrl({ ...options, sort: 'top' }),
            newUrl: listUrl({ ...options, sort: 'new' }),
            clearUrl: listUrl({ ...options, q: '' })
        }
    });
};

// Adding quotes has its own, tighter limit: anyone can post, and nothing is
// moderated. Only quotes that were saved count toward it.
const addQuoteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 10,
    skipFailedRequests: true,
    handler: (request, response, next) => {
        renderHome(request, response, 429, {
            error: "You've added 10 quotes in the last hour. Please try again later.",
            values: request.body
        }).catch(next);
    }
});

// Answers an edit or delete that matched nothing: 403 when the quote exists
// but this browser didn't add it, 404 when there's no such quote
const refuseChange = async (response, id, action) => {
    const exists = await db.collection(COLL_NAME).countDocuments({ _id: new ObjectId(id) }, { limit: 1 });
    if (exists) {
        return response.status(403).json({ error: `You can only ${action} quotes added from this browser` });
    }
    response.status(404).json({ error: 'Quote not found' });
};

// A quote's like count, or null when there's no such quote
const likeCount = async (id) => {
    const quote = await db.collection(COLL_NAME).findOne({ _id: new ObjectId(id) }, { projection: { likes: 1 } });
    return quote ? quote.likes : null;
};

// Routes
app.get('/', async (request, response) => {
    await renderHome(request, response, 200);
});

app.get('/privacy', (request, response) => {
    response.render('privacy.ejs');
});

// A random quote for the "Inspire me" button, from the cached ZenQuotes batch
app.get('/api/inspire', async (request, response) => {
    // Each answer can differ, so browsers shouldn't keep one
    response.set('Cache-Control', 'no-store');
    try {
        response.json(await inspire());
    } catch (error) {
        console.error('ZenQuotes is unavailable:', error.message);
        response.status(503).json({ error: "Couldn't fetch a quote right now. Please try again in a minute." });
    }
});

// The add form posts to /addQuotes. A browser can still ask for it as a page,
// say a refresh after a refused quote with JavaScript off, so send it home.
app.get('/addQuotes', (request, response) => {
    response.redirect('/');
});

app.post('/addQuotes', addQuoteLimiter, async (request, response) => {
    if (isCrossSite(request)) {
        return sendError(request, response, 403, 'Not allowed', "Quotes can only be added from WisdomWell's own page.");
    }
    const { name, quote, error } = checkQuoteInput(request.body);
    if (error) {
        return renderHome(request, response, 400, { error, values: request.body });
    }

    // The browser's key marks the quote as its own: only it can edit or delete it
    const ownerHash = giveVisitorKey(request, response);
    await db.collection(COLL_NAME).insertOne({ name, quote, likes: 0, ownerHash, createdAt: new Date() });
    response.redirect('/');
});

app.put('/editQuote', async (request, response) => {
    // Express 5 leaves req.body undefined when a request has no body
    const { id } = request.body ?? {};
    if (!isQuoteId(id)) {
        return response.status(400).json({ error: 'Invalid quote ID' });
    }
    const { name, quote, error } = checkQuoteInput(request.body);
    if (error) {
        return response.status(400).json({ error });
    }
    // Only the browser that added a quote can change it. Without a key there's
    // nothing to match on: ownerHash: null would match every older quote,
    // since those have no owner.
    if (!request.visitorHash) {
        return refuseChange(response, id, 'edit');
    }

    // Since driver 6, this is the updated quote itself, or null if none matched.
    // The projection keeps the owner's hash out of the reply.
    const updatedQuote = await db.collection(COLL_NAME).findOneAndUpdate(
        { _id: new ObjectId(id), ownerHash: request.visitorHash },
        { $set: { name, quote, updatedAt: new Date() } },
        { returnDocument: 'after', projection: { ownerHash: 0, likedBy: 0 } }
    );
    if (!updatedQuote) {
        return refuseChange(response, id, 'edit');
    }
    response.json(updatedQuote);
});

// One like per browser: likedBy holds the hashed key of every browser that
// liked the quote. Counts from before likedBy existed stay as the base.
app.put('/addUpvote', async (request, response) => {
    const { id } = request.body ?? {};
    if (!isQuoteId(id)) {
        return response.status(400).json({ error: 'Invalid quote ID' });
    }

    // A first like gives the browser its key, as adding a quote does
    const visitorHash = giveVisitorKey(request, response);
    // Matches only while this browser hasn't liked the quote, so liking twice
    // changes nothing. $inc adds the one like on the server.
    const updatedQuote = await db.collection(COLL_NAME).findOneAndUpdate(
        { _id: new ObjectId(id), likedBy: { $ne: visitorHash } },
        { $addToSet: { likedBy: visitorHash }, $inc: { likes: 1 }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after', projection: { likes: 1 } }
    );
    const likes = updatedQuote ? updatedQuote.likes : await likeCount(id);
    if (likes === null) {
        return response.status(404).json({ error: 'Quote not found' });
    }
    response.json({ likes, liked: true });
});

// Takes back this browser's like
app.put('/removeUpvote', async (request, response) => {
    const { id } = request.body ?? {};
    if (!isQuoteId(id)) {
        return response.status(400).json({ error: 'Invalid quote ID' });
    }

    // Only a like this browser made can come off. Without a key there's none,
    // and likedBy: null would match every quote with no likedBy list yet,
    // taking a like off its count.
    const updatedQuote = request.visitorHash && await db.collection(COLL_NAME).findOneAndUpdate(
        { _id: new ObjectId(id), likedBy: request.visitorHash },
        { $pull: { likedBy: request.visitorHash }, $inc: { likes: -1 }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after', projection: { likes: 1 } }
    );
    const likes = updatedQuote ? updatedQuote.likes : await likeCount(id);
    if (likes === null) {
        return response.status(404).json({ error: 'Quote not found' });
    }
    response.json({ likes, liked: false });
});

app.delete('/deleteQuote', async (request, response) => {
    const { id } = request.body ?? {};
    if (!isQuoteId(id)) {
        return response.status(400).json({ error: 'Invalid quote ID' });
    }

    // As with editing: only the browser that added it, and never a missing key
    if (!request.visitorHash) {
        return refuseChange(response, id, 'delete');
    }

    const result = await db.collection(COLL_NAME).deleteOne({ _id: new ObjectId(id), ownerHash: request.visitorHash });
    if (result.deletedCount === 0) {
        return refuseChange(response, id, 'delete');
    }
    response.json({ message: 'Quote deleted successfully' });
});

// Pages that don't exist
app.use((request, response) => {
    sendError(request, response, 404, 'Page not found', "There's no page at this address.");
});

// Error handling middleware. Errors from the body parsers carry their own
// status (400 bad JSON, 413 too large, 415 compressed); anything else is a 500.
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (res.headersSent) {
        return next(err);
    }
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) {
        return sendError(req, res, 500, 'Something went wrong', 'Something went wrong! Please try again.');
    }
    sendError(req, res, status, 'Invalid request', "That request couldn't be read.");
});

// Connect to MongoDB, then start the server
MongoClient.connect(process.env.DB_STRING)
.then(client => {
    console.log(`Connected to ${DB_NAME} Database`);
    db = client.db(DB_NAME);
    // Express 5 passes a failed start (like a port in use) to this callback
    app.listen(PORT, (error) => {
        if (error) throw error;
        // The Node version shows in Railway's deploy log, to confirm the pin in package.json
        console.log(`Server is running on port ${PORT} with Node ${process.version}`);
    });
})
.catch(error => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
});

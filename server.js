require('dotenv').config();
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const { ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { MAX_NAME_LENGTH, MAX_QUOTE_LENGTH, checkQuoteInput, isQuoteId } = require('./middleware/validators');
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
app.locals.limits = { name: MAX_NAME_LENGTH, quote: MAX_QUOTE_LENGTH };
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

// Validate required environment variables
if (!process.env.DB_STRING) {
    console.error('MongoDB connection string is missing. Please check your .env file.');
    process.exit(1);
}

// Constants
const DB_NAME = 'motivational-quotes';
const COLL_NAME = 'quotes';

let db;

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
const renderHome = async (response, status, form = {}) => {
    // Most liked first, and newest first among equal likes. _id holds the
    // creation time; quotes from 2022 have no createdAt.
    const quotes = await db.collection(COLL_NAME).find().sort({ likes: -1, _id: -1 }).toArray();
    const typed = (value) => (typeof value === 'string' ? value : '');
    response.status(status).render('index.ejs', {
        quotes,
        formError: form.error ?? null,
        formValues: { name: typed(form.values?.name), quote: typed(form.values?.quote) }
    });
};

// Adding quotes has its own, tighter limit: anyone can post, and nothing is
// moderated. Only quotes that were saved count toward it.
const addQuoteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 10,
    skipFailedRequests: true,
    handler: (request, response, next) => {
        renderHome(response, 429, {
            error: "You've added 10 quotes in the last hour. Please try again later.",
            values: request.body
        }).catch(next);
    }
});

// Routes
app.get('/', async (request, response) => {
    await renderHome(response, 200);
});

app.get('/privacy', (request, response) => {
    response.render('privacy.ejs');
});

app.post('/addQuotes', addQuoteLimiter, async (request, response) => {
    const { name, quote, error } = checkQuoteInput(request.body);
    if (error) {
        return renderHome(response, 400, { error, values: request.body });
    }

    await db.collection(COLL_NAME).insertOne({ name, quote, likes: 0, createdAt: new Date() });
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

    // Since driver 6, this is the updated quote itself, or null if none matched
    const updatedQuote = await db.collection(COLL_NAME).findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { name, quote, updatedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!updatedQuote) {
        return response.status(404).json({ error: 'Quote not found' });
    }
    response.json(updatedQuote);
});

app.put('/addUpvote', async (request, response) => {
    const { id } = request.body ?? {};
    if (!isQuoteId(id)) {
        return response.status(400).json({ error: 'Invalid quote ID' });
    }

    // $inc adds one on the server, so a like can't set the count to anything else
    const updatedQuote = await db.collection(COLL_NAME).findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $inc: { likes: 1 }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!updatedQuote) {
        return response.status(404).json({ error: 'Quote not found' });
    }
    response.json(updatedQuote);
});

app.delete('/deleteQuote', async (request, response) => {
    const { id } = request.body ?? {};
    if (!isQuoteId(id)) {
        return response.status(400).json({ error: 'Invalid quote ID' });
    }

    const result = await db.collection(COLL_NAME).deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
        return response.status(404).json({ error: 'Quote not found' });
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

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const { ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const PORT = process.env.PORT;

// Debug environment variables
console.log('DB_STRING exists:', !!process.env.DB_STRING);
console.log('DB_STRING starts with:', process.env.DB_STRING?.substring(0, 20) + '...');

// Security middleware with custom CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000'
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Request size limits
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10kb' }));

// Validate required environment variables
if (!process.env.DB_STRING) {
    console.error('MongoDB connection string is missing. Please check your .env file.');
    process.exit(1);
}

// Constants
const DB_NAME = 'motivational-quotes';
const COLL_NAME = 'quotes';
const MAX_QUOTE_LENGTH = 500;
const MAX_NAME_LENGTH = 100;

let db;

// Input validation middleware
const validateQuoteInput = (req, res, next) => {
    const { name, quote } = req.body;
    
    // Check if fields exist
    if (!name || !quote) {
        return res.status(400).json({ error: 'Name and quote are required' });
    }

    // Trim whitespace
    req.body.name = name.trim();
    req.body.quote = quote.trim();

    // Validate lengths
    if (req.body.name.length > MAX_NAME_LENGTH) {
        return res.status(400).json({ error: `Name must be less than ${MAX_NAME_LENGTH} characters` });
    }
    if (req.body.quote.length > MAX_QUOTE_LENGTH) {
        return res.status(400).json({ error: `Quote must be less than ${MAX_QUOTE_LENGTH} characters` });
    }

    // Validate content (basic sanitization)
    if (!/^[a-zA-Z0-9\s.,!?'"-]+$/.test(req.body.name)) {
        return res.status(400).json({ error: 'Name contains invalid characters' });
    }
    if (!/^[a-zA-Z0-9\s.,!?'"-]+$/.test(req.body.quote)) {
        return res.status(400).json({ error: 'Quote contains invalid characters' });
    }

    next();
};

// Connect to MongoDB
const connectToMongo = async () => {
    try {
        if (!process.env.DB_STRING) {
            throw new Error('MongoDB connection string is missing');
        }

        // Ensure the connection string starts with the correct protocol
        const connectionString = process.env.DB_STRING.trim();
        if (!connectionString.startsWith('mongodb://') && !connectionString.startsWith('mongodb+srv://')) {
            throw new Error('Invalid MongoDB connection string format');
        }

        const client = await MongoClient.connect(connectionString);
        console.log(`Connected to ${DB_NAME} Database`);
        db = client.db(DB_NAME);
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
};

connectToMongo();

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Routes
app.get('/', (request, response) => {
    db.collection(COLL_NAME).find().sort({likes: -1}).toArray()
    .then(data => {
        response.render('index.ejs', { quotes: data });
    })
    .catch(error => {
        console.error('Error fetching quotes:', error);
        response.status(500).json({ error: 'Unable to fetch quotes' });
    });
});

const quoteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 quotes per hour
    message: 'Too many quotes created, please try again later'
});

app.post('/addQuotes', quoteLimiter, validateQuoteInput, (request, response) => {
    const { name, quote, authorId } = request.body;
    
    if (!name || !quote || !authorId) {
        return response.status(400).json({ error: 'Name, quote, and author ID are required' });
    }

    db.collection(COLL_NAME).insertOne({
        name: name,
        quote: quote,
        authorId: authorId,
        likes: 0,
        createdAt: new Date()
    })
    .then(() => {
        response.redirect('/');
    })
    .catch(error => {
        console.error('Error adding quote:', error);
        response.status(500).json({ error: 'Unable to add quote' });
    });
});

app.put('/editQuote', validateQuoteInput, (request, response) => {
    const { id, name, quote } = request.body;
    
    if (!id) {
        return response.status(400).json({ error: 'Quote ID is required' });
    }

    try {
        const objectId = new ObjectId(id);
        db.collection(COLL_NAME).findOneAndUpdate(
            { _id: objectId },
            { 
                $set: { 
                    name: name,
                    quote: quote,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        )
        .then(result => {
            if (!result.value) {
                return response.status(404).json({ error: 'Quote not found' });
            }
            response.json(result.value);
        })
        .catch(error => {
            console.error('Error updating quote:', error);
            response.status(500).json({ error: 'Unable to update quote' });
        });
    } catch (error) {
        console.error('Invalid ObjectId:', error);
        response.status(400).json({ error: 'Invalid quote ID' });
    }
});

app.put('/addUpvote', (request, response) => {
    const { id, likes } = request.body;
    
    if (!id || likes === undefined) {
        return response.status(400).json({ error: 'Quote ID and likes count are required' });
    }

    try {
        const objectId = new ObjectId(id);
        db.collection(COLL_NAME).findOneAndUpdate(
            { _id: objectId },
            { 
                $set: { 
                    likes: likes + 1,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        )
        .then(result => {
            if (!result.value) {
                return response.status(404).json({ error: 'Quote not found' });
            }
            response.json(result.value);
        })
        .catch(error => {
            console.error('Error updating likes:', error);
            response.status(500).json({ error: 'Unable to update likes' });
        });
    } catch (error) {
        console.error('Invalid ObjectId:', error);
        response.status(400).json({ error: 'Invalid quote ID' });
    }
});

app.delete('/deleteQuote', (request, response) => {
    const { id, authorId } = request.body;
    
    if (!id || !authorId) {
        return response.status(400).json({ error: 'Quote ID and author ID are required' });
    }

    try {
        const objectId = new ObjectId(id);
        // First find the quote to verify ownership
        db.collection(COLL_NAME).findOne({ _id: objectId })
        .then(quote => {
            if (!quote) {
                return response.status(404).json({ error: 'Quote not found' });
            }
            
            // Verify the author is the one trying to delete
            if (quote.authorId !== authorId) {
                return response.status(403).json({ error: 'You can only delete your own quotes' });
            }

            // If ownership is verified, delete the quote
            db.collection(COLL_NAME).deleteOne({ _id: objectId })
            .then(result => {
                if (result.deletedCount === 0) {
                    return response.status(404).json({ error: 'Quote not found' });
                }
                response.json({ message: 'Quote deleted successfully' });
            })
            .catch(error => {
                console.error('Error deleting quote:', error);
                response.status(500).json({ error: 'Unable to delete quote' });
            });
        })
        .catch(error => {
            console.error('Error finding quote:', error);
            response.status(500).json({ error: 'Unable to verify quote ownership' });
        });
    } catch (error) {
        console.error('Invalid ObjectId:', error);
        response.status(400).json({ error: 'Invalid quote ID' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

async function cleanupOrphanedQuotes() {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30); // 30 days old

    try {
        await db.collection(COLL_NAME).deleteMany({
            updatedAt: { $lt: threshold },
            likes: 0
        });
    } catch (error) {
        console.error('Error cleaning up orphaned quotes:', error);
    }
}
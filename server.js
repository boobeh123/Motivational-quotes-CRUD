const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const MongoClient = require('mongodb').MongoClient
const PORT = process.env.PORT || 3000;
let DB_STRING = process.env.DB_STRING;

try {
    const mongoAtlasLogin = require('./config.js');
    DB_STRING = mongoAtlasLogin.connectionString;
} catch(error) {
    console.error(error);
}


// Connecting to MongoDB Atleast using Promises
MongoClient.connect(DB_STRING)
.then(client => {
    console.log('Connected to Database');
    const db = client.db('motivational-quotes');
    const quotesCollection = db.collection('quotes');
    app.set('view engine', 'ejs');  // Setting view engine to use EJS
    app.use(bodyParser.urlencoded({ extended: true}))   // Place body-parser before CRUD handlers
    app.use(bodyParser.json())  // Accepting PUT requests
    app.use(express.static('public'));  // Tell Express to make this public folder accessible
    app.get('/', (request, response) => {   // Using the sendFile method to serve an html page in the root directory
        // response.sendFile(__dirname + '/index.html')
        db.collection('quotes').find().toArray()
        .then(results => {
            console.log(results);
            response.render('index.ejs', { quotes: results });
        })
        .catch(error => console.error(error));
    });

    // Using the insertOne method to add into a MongoDB collection
    app.post('/quotes', (request, response) => {
        quotesCollection.insertOne(request.body)
        .then(result => {
            console.log(result);
            response.redirect('/');
        })
        .catch(error => console.error(error));
    });
    app.put('/quotes', (request, response) => {
        quotesCollection.findOneAndUpdate(
            { name: '' }, 
        { 
            $set: {
                name: request.body.name,
                quote: request.body.quote
            }
        }, 
        {
            upsert: true
        })
        .then(result => {
            // console.log(result)
            response.json('Changes saved')
        })
        .catch(error => console.error(error));
    });
    app.delete('/quotes', (request, response) => {
        quotesCollection.deleteOne(
            { name: request.body.name }
        )
        .then(result => {
            if (result.deletedCount === 0) {
                return response.json('No changes to remove');
            }
            response.json('Changes removed');
        })
    })
})
.catch(error => console.error(error));

app.listen(PORT, () => {
    console.log(`Listening to ${PORT}`);
});
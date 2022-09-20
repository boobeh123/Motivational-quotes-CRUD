const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const MongoClient = require('mongodb').MongoClient
const PORT = process.env.PORT || 3000;
let db,
    DB_STRING = process.env.DB_STRING,
    DB_NAME = 'motivational-quotes',
    COLL_NAME = 'quotes';

try {
    const mongoAtlasLogin = require('./config.js');
    DB_STRING = mongoAtlasLogin.connectionString;
} catch(error) {
    console.error(error);
}

MongoClient.connect(DB_STRING)
.then(client => {
    console.log(`Connected to ${DB_NAME} Database`);
    db = client.db(DB_NAME);
})
.catch(error => console.error(error));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true}))
app.use(bodyParser.json())

app.get('/', (request, response) => {
    db.collection(COLL_NAME).find().sort({likes: -1}).toArray()
    .then(data => {
        response.render('index.ejs', { quotes: data });
    })
    .catch(error => console.error(error));
});

app.post('/addQuotes', (request, response) => {
    db.collection(COLL_NAME).insertOne({name: request.body.name, quote: request.body.quote, likes: 0})
    .then(data => {
        console.log('Quote & Author added.');
        response.redirect('/');
    })
    .catch(error => console.error(error));
});

app.put('/addUpvote', (request, response) => {
    db.collection(COLL_NAME).findOneAndUpdate({name: request.body.name, quote: request.body.quote, likes: request.body.likes}, {
        $set: {
            likes: request.body.likes + 1
          }
    },{
        sort: {_id: -1},
        upsert: true
    })
    .then(result => {
        console.log('Added One Like')
        response.json('Like Added')
    })
    .catch(error => console.error(error))
})

//     app.put('/quotes', (request, response) => {
//         quotesCollection.findOneAndUpdate({ name: '' }, { $set: {name: request.body.name, quote: request.body.quote} }, { upsert: true })
//         .then(result => {
//             response.json('Changes saved')
//         })
//         .catch(error => console.error(error));
// });

app.delete('/deleteQuote', (request, response) => {
    db.collection(COLL_NAME).deleteOne({name: request.body.name})
    .then(result => {
        console.log('Changed removed')
        response.json('Changes removed');
    })
});

app.listen(PORT, () => {
    console.log(`Listening to ${PORT}`);
});
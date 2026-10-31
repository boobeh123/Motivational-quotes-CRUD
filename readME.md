## Description
A full stack web application that receives inputs from the user and sends the inputs to a server. The database stores the inputs & serves the data to be displayed onto the web page. This data is not stored locally and can be viewed by anyone using any device or browser. Quotes can be edited or deleted only from the browser that added them, & each browser can like a quote once.

The project is deployed here: https://wisdomwell.up.railway.app/

## Demo
![demo](cruddemo.gif)
![demo](cruddemo2.gif)

## Features
* Full-stack web application deployed with Railway
* Responsive to mobile viewports
* Database (MongoDB)
* Error handling & messages
* Input validation & sanitization
* Executes CRUD operations
* Displays data dynamically with EJS (Embedded JavaScript)
* .env 
* Privacy Policy
* SEO & ARIA-labels/roles
* Accessible to screen readers
* Search quotes by text or author, & sort by most liked or newest
* "Inspire me" button with random quotes from the ZenQuotes API
* Edit & delete only the quotes you added, without accounts
* One like per browser, press again to take it back
* Character count on the quote box
* Social card for link previews
* Tests with Node's built-in test runner
* Security: strict Content-Security-Policy (Helmet), rate limiting & server-side validation

## Technologies
<img src="https://profilinator.rishav.dev/skills-assets/html5-original-wordmark.svg" alt="HTML5" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/css3-original-wordmark.svg" alt="CSS3" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/javascript-original.svg" alt="JavaScript" height="40" /><img src="https://profilinator.rishav.dev/skills-assets/nodejs-original-wordmark.svg" alt="NodeJS" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/express-original-wordmark.svg" alt="Express" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/mongodb-original-wordmark.svg" alt="MongoDB" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/git-scm-icon.svg" alt="Git" height="50" />

## Optimizations
* ~I want to add a generate quote button which can fetch to several APIs-- many quotes~ (done with the ZenQuotes API)
* ~Update layout with header/section/footer~
* ~Update SEO~
* ~Optimize for accessibility & pageload~
* ~Add privacy policy on what data is stored~

## Do you want to build this project?
https://zellwk.com/blog/crud-express-mongodb/

* Install Node 24.22.1 (the version in `package.json`) & dependencies with `npm install`
* Copy `.env.example` to a file named `.env`
    * DB_STRING='your_mongo_db_connection_string'
    * PORT=3000 (optional, 3000 is the default)
* Start it with `npm run dev`, & run the tests with `npm test`
* Change values to these variables `DB_NAME` & `COLL_NAME` within `server.js`
* Delete any [templating](https://ejs.co/#docs) within `index.ejs`
* Reading server.js-> middleware/-> creating .env-> read index.ejs-> read main.js -> style.css
* If deploying: change MongoDB User Permissions & environment variables. On Railway, use the Railpack builder so it runs the exact Node version

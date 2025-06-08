[Motivational-Quotes-CRUD](https://github.com/boobeh123/Motivational-quotes-CRUD)

## Description
A full stack web application that receives inputs from the user and sends the inputs to a server. The database stores the inputs & serves the data to be displayed onto the web page. This data is not stored locally and can be viewed / interacted by anyone using any device or browser.

The project is deployed here: https://wisdomwell.up.railway.app/

## Demo 2023
![demo](cruddemo.gif)

## Features
* Full-stack web application deployed with Railway
* Responsive to mobile viewports
* Database (MongoDB)
* Error handling & messages
* Input validation & sanitization
* Executes CRUD operations
* Displays data dynamically with EJS (Embedded JavaScript)
* .env 

## Technologies
<img src="https://profilinator.rishav.dev/skills-assets/html5-original-wordmark.svg" alt="HTML5" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/css3-original-wordmark.svg" alt="CSS3" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/javascript-original.svg" alt="JavaScript" height="40" /><img src="https://profilinator.rishav.dev/skills-assets/nodejs-original-wordmark.svg" alt="NodeJS" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/mongodb-original-wordmark.svg" alt="MongoDB" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/git-scm-icon.svg" alt="Git" height="50" />

## Optimizations
* I want to add a generate quote button which can fetch to several APIs-- many quotes
* Update layout with header/section/footer
* Update SEO
* Optimize for accessibility & pageload 
* Add privacy policy on what data is stored

## Do you want to build this project?
https://zellwk.com/blog/crud-express-mongodb/

* Installing dependencies
* Creating a `.env` file named `.env`
    * DB_STRING='your_mongo_db_connection_string'
    * PORT=3000
* Change values to these variables `DB_NAME` & `COLL_NAME` within `server.js`
* Delete any [templating](https://ejs.co/#docs) within `index.ejs`
* Reading server.js-> creating .env-> read index.ejs-> read main.js -> style.css
* If deploying: change MongoDB User Permissions & environment variables
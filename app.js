const express = require('express');
const session = require('express-session');
const mongoDBStore = require('connect-mongodb-session')(session);
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const mustacheExpress = require('mustache-express');
const morgan = require('morgan');
const bodyParser = require('body-parser');

// load our words from a data file
const words = require('./words');

// create our Express app
let app = express();

// set up public dir for css and js
app.use(express.static('public'));

// set up our logging using morgan
app.use(morgan('tiny'));
app.use(bodyParser.urlencoded({ extended: false }));

// set up the express-session store to use MongoDB
let store = new mongoDBStore(
  {
    uri: 'mongodb://localhost:27017/word-guess-game-project',
    collection: 'user'
  }
);

store.on('error', (e) => {
  assert.ifError(e);
  assert.ok(false);
});

// set up express-session
app.use(session({
  secret: 'keyboard cat',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 //1 week
  },
  store: store,
  resave: true,
  saveUninitialized: true
}));

// set up our template engine - mustache
app.engine('mustache', mustacheExpress());
app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

// ****************************************************************************
// BEGIN ROUTES

app.get('/', (req, res, next) => {
  let randomWord = 'laundry';
  let randomWordAsList = randomWord.split('');
  let wordInfo = [];
  randomWordAsList.forEach( (letter) => {
    wordInfo.push({letter: letter, guessed: false});
  });
  wordInfo[3].guessed = true;
  res.render('index', {word: wordInfo});
});

app.listen(3000, () => {
  console.log('Word Guess Game listening on 3000!');
});

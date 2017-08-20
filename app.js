const express = require('express');
const session = require('express-session');
const mongoDBStore = require('connect-mongodb-session')(session);
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const mustacheExpress = require('mustache-express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');

// load our words from a data file
const words = require('./words');

// create our Express app
let app = express();

// set up public dir for css and js
app.use(express.static('public'));

// set up our logging using morgan
app.use(morgan('tiny'));

// body-parser and express validator
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator());

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

let wordInfo = [];
let guessCounter = 5;

app.get('/', (req, res, next) => {
  let randomWord = 'laundry';
  let randomWordAsList = randomWord.split('');
  randomWordAsList.forEach( (letter) => {
    wordInfo.push({letter: letter, guessed: false});
  });
  res.render('index', {word: wordInfo, counter: guessCounter});
});

app.post('/', (req, res, next) => {
  // process the incoming letter guess
  console.log(req.body);
  // make sure it is a single letter
  req.checkBody('letter', 'Not a letter').isAlpha();
  req.checkBody('letter', 'Too long').isLength({min:1, max:1});

  req.getValidationResult()
    .then( (result) => {
      if( !result.isEmpty() ) {
        // validation errors
        res.render('index', {word: wordInfo, counter: guessCounter, errors: result.array()})
      } else {
        // validation passed
        // check if the letter has already been guessed or not
        let shouldDecrementCounter = true;
        wordInfo.forEach( (letter) => {
          if( letter.letter === req.body.letter ) {
            if( letter.guessed === false ) {
              // user guessed one of the letters
              letter.guessed = true;
              shouldDecrementCounter = false;
            } else {
              // user had already guessed this letter
              shouldDecrementCounter = false
            }
          } else {

          }
        })
        if( shouldDecrementCounter === true ) {
          guessCounter -= 1;
        }
        res.render('index', {word: wordInfo, counter: guessCounter});
      }
    })

})

app.listen(3000, () => {
  console.log('Word Guess Game listening on 3000!');
});

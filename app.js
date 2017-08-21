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

app.use( (req, res, next) => {
  // check for req.session
  if( !req.session.game ) {
    // never seen this person before, we need to create a new game
    console.log('=> need to create new game');
    createNewGame(req);
    next();
  } else {
    // game is in progress...
    console.log('=> game is in progress');
    req.session.game.validationErrors = [];
    next();
  }
})

app.get('/', (req, res, next) => {
  console.log(req.session.game);
  res.render('index', req.session.game);
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
        req.session.game.validationErrors = result.array();
        res.render('index', req.session.game)
      } else {
        // our guess is valid
        if( uniqueGuess(req.session.game, req.body.letter) ) {
          // is the letter in the word
          if( checkAndUpdateLetter(req.session.game, req.body.letter) ) {
            // letter matched
            res.render('index', req.session.game);
          } else {
            // letter didn't match
            req.session.game.guessesRemaining -= 1;
            res.render('index', req.session.game);
          }
        } else {
          // our guess had been made before
          res.render('index', req.session.game);
        }
      }
    })

})

app.listen(3000, () => {
  console.log('Word Guess Game listening on 3000!');
});


// helper functions

function createNewGame( req ) {
  // we need to initialize req.session with game information
  req.session.game = {
    word: 'laundry',
    wordAsList : [
      {'letter': 'l', 'guessed': false},
      {'letter': 'a', 'guessed': false},
      {'letter': 'u', 'guessed': false},
      {'letter': 'n', 'guessed': false},
      {'letter': 'd', 'guessed': false},
      {'letter': 'r', 'guessed': false},
      {'letter': 'y', 'guessed': false},
    ],
    lettersGuessed : [],
    guessesRemaining: 5,
    validationErrors: [],
  };
}

function uniqueGuess(game, letter) {
  // look for letter in list of lettersGuessed
  if( game.lettersGuessed.indexOf(letter) >= 0 ) {
    return false;
  }
  return true;
}

function checkAndUpdateLetter(game, guessedLetter) {
  let didGuessMatchLetter = false;
  game.lettersGuessed.push(guessedLetter);

  game.wordAsList.forEach( (letter) => {
    if( letter.letter === guessedLetter ) {
      letter.guessed = true;
      didGuessMatchLetter = true;
    }
  })
  return didGuessMatchLetter;
}

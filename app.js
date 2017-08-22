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
    // no game is in session
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
  req.checkBody('letter', 'not a letter').isAlpha();
  req.checkBody('letter', 'too long').isLength({min:1, max:1});

  req.getValidationResult()
    .then( (result) => {
      if( !result.isEmpty() ) {
        // validation errors
        req.session.game.validationErrors = result.array()[0];
        res.render('index', req.session.game)
      } else {
        // our guess is valid
        if( uniqueGuess(req.session.game, req.body.letter) ) {
          // is the letter in the word
          if( checkAndUpdateLetter(req.session.game, req.body.letter) ) {
            // letter matched
            // have we matched all the letters?
            if( checkAllLetters(req.session.game) ) {
              // update the state to won
              req.session.game.stateWon = true;
              updateHistory(req.session.game, 'win');
              req.session.game.stateInProgress = false;
            }
            res.render('index', req.session.game);
          } else {
            // letter didn't match
            req.session.game.guessesRemaining -= 1;
            console.log(`guessesRemaining: ${req.session.game.guessesRemaining}`);
            if( req.session.game.guessesRemaining <= 0 ) {
              // the game is over, change state
              req.session.game.stateLost = true;
              updateHistory(req.session.game, 'loss');
              req.session.game.stateInProgress = false;
            }
            res.render('index', req.session.game);
          }
        } else {
          // our guess had been made before
          res.render('index', req.session.game);
        }
      }
    })

})

app.get('/again', (req, res, next) => {
  // clear out the user's session
  askForNewGame(req);
  res.redirect('/');
});

app.get('/highscores', (req, res, next) => {
  res.render('highscores');
})

app.listen(3000, () => {
  console.log('Word Guess Game listening on 3000!');
});


// helper functions

function createNewGame( req ) {
  // we need to initialize req.session with game information
  req.session.game = {
    stateInProgress: true,
    stateWon: false,
    stateLost: false,
    category: '',
    word: '',
    wordAsList : [],
    lettersGuessed : [],
    guessesRemaining: 5,
    validationErrors: [],
    history: {
      exists: false,
      wins: 0,
      losses: 0
    }
  };

  // choose a word at random
  let randInt = Math.floor(Math.random()*(words.length-1));
  req.session.game.word = words[randInt].word;
  req.session.game.category = words[randInt].category;
  console.log(req.session.game);

  req.session.game.wordAsList = [];
  req.session.game.word.split('').forEach( (letter) => {
    req.session.game.wordAsList.push({'letter': letter, 'guessed': false});
  });
}

function askForNewGame( req ) {
  req.session.game.stateInProgress = true;
  req.session.game.stateWon = false;
  req.session.game.stateLost = false;
  req.session.game.lettersGuessed = [];
  req.session.game.guessesRemaining = 5;
  req.session.game.validationErrors = [];
  // choose a word at random
  let randInt = Math.floor(Math.random()*(words.length-1));
  req.session.game.word = words[randInt].word;
  req.session.game.category = words[randInt].category;
  console.log(req.session.game);

  req.session.game.wordAsList = [];
  req.session.game.word.split('').forEach( (letter) => {
    req.session.game.wordAsList.push({'letter': letter, 'guessed': false});
  });
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

function checkAllLetters(game) {
  let result = true;
  for(let i=0; i<game.wordAsList.length; i++) {
    if( game.wordAsList[i].guessed === false ) {
      result = false;
    }
  }
  console.log(`checkAllLetters returns: ${result}.`);
  return result;
}

function updateHistory(game, outcome) {
  // this gets called after every win or loss
  // check if history exists, set it to true if it doesn't
  if( !game.history.exists ) {
    game.history.exists = true;
  }
  // update win or loss count
  if( outcome === 'win' ) {
    game.history.wins += 1;
  } else if( outcome === 'loss' ) {
    game.history.losses += 1;
  }
}

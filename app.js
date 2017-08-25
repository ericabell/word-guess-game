const express = require('express'),
      session = require('express-session'),
      mongoDBStore = require('connect-mongodb-session')(session),
      MongoClient = require('mongodb').MongoClient,
      assert = require('assert'),
      mustacheExpress = require('mustache-express'),
      morgan = require('morgan'),
      bodyParser = require('body-parser'),
      expressValidator = require('express-validator'),
      passport = require('passport'),
      TwitterStrategy = require('passport-twitter').Strategy,
      mongoose = require('mongoose'),
      findOrCreate = require('mongoose-findorcreate'),
      ObjectId = require('mongodb').ObjectID,
      TwitterUser = require('./models/TwitterUser');

// load our words from a data file
const words = require('./words');

// create our Express app
let app = express();

let Twitter = require('twitter');

let client = new Twitter({
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET,
  access_token_key: process.env.TWITTER_API_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_API_TOKEN_SECRET
});


// set up public dir for css and js
app.use(express.static('public'));

// set up our logging using morgan
app.use(morgan('tiny'));

// body-parser and express validator
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator());

// connect to mongoose for twitter user store
mongoose.connect('mongodb://localhost:27017/twitter', {useMongoClient: true});

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
app.set('layout', 'layout');
app.set('views', __dirname + '/views');

// configure passport to use the TwitterStrategy, if needed
passport.use(new TwitterStrategy({
        consumerKey: process.env.TWITTER_API_KEY,
        consumerSecret: process.env.TWITTER_API_SECRET,
        callbackURL: "http://localhost:3000/auth/twitter/callback"
    },
    function (token, tokenSecret, profile, done) {
        // function to get a user from the returned data
        // console.log('get user from the returned data');
        // console.log(token);
        // console.log(tokenSecret);
        //
        // console.log(profile);
        // save twitter user data into mongoose
        // console.log('About to save twitter data into mongoose');
        TwitterUser.findOrCreate({
          provider: profile.provider,
          providerId: profile.id
        }, {
          displayName: profile.displayName
        },
        function( err, user ) {
          if (err) {
            return done(err);
          }
          // console.log('Data saved to mongo!');
          done(null, user);
        });
        // console.log('After TwitterUser.findorcreate');
    }
));
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    // User.findById(id, function(err, user) {
    //     done(err, user);
    // });
    done(null, id);
});

app.use(passport.initialize());
app.use(passport.session());

// to protect certain routes, we need to apply some middleware
const requireLogin = function(req, res, next) {
  if(req.user) {
    next();
  } else {
    res.send('You do not have access yet. Try logging in.');
  }
}

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
    // req.session.game.validationErrors = [];
    next();
  }
})

app.get('/', (req, res, next) => {
  // log the word so we can always cheat.
  console.log(`Your word is ${req.session.game.word}`);
  if( req.user ) {
    // grab the username from twitter
    // req.session.passport.user is _id in mongoose
    // req.user just contains the _id as well.
    TwitterUser.find({_id: ObjectId(req.user)})
      .then( (docs) => {
        req.session.game.userName = docs[0].displayName;
        res.render('index', req.session.game);
      })
  } else {
    req.session.game.userName = 'Anonymous User';
    res.render('index', req.session.game);
  }
});

app.post('/guess', (req, res, next) => {
  req.session.game.validationErrors = [];
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
        console.log(req.session.game.validationErrors);
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
              console.log('About to redirect to /win');
              res.redirect('/win');
            } else {
              res.render('index', req.session.game);
            }
          } else {
            // letter didn't match
            req.session.game.guessesRemaining -= 1;
            console.log(`guessesRemaining: ${req.session.game.guessesRemaining}`);
            if( req.session.game.guessesRemaining <= 0 ) {
              // the game is over, change state
              req.session.game.stateLost = true;
              updateHistory(req.session.game, 'loss');
              req.session.game.stateInProgress = false;
              res.redirect('/lose')
            } else {
              res.render('index', req.session.game);
            }
          }
        } else {
          // our guess had been made before
          res.render('index', req.session.game);
        }
      }
    })

})

app.get('/win', (req, res, next) => {
  res.render('win', req.session.game);
});

app.get('/lose', (req, res, next) => {
  res.render('lose', req.session.game);
});


app.get('/reset', (req, res, next) => {
  req.session.game.history.wins = 0;
  req.session.game.history.losses = 0;
  res.redirect('/');
});

app.get('/again', (req, res, next) => {
  // clear out the user's session
  askForNewGame(req);
  res.redirect('/');
});

app.get('/highscores', (req, res, next) => {
  res.render('highscores');
});

app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback',
  passport.authenticate('twitter', {
    successRedirect: '/',
    failureRedirect: '/auth/twitter'
}));

app.get('/logout', (req, res, next) => {
  req.logout();
  res.redirect('/');
});

app.get('/protected', requireLogin, (req, res, next) => {
  res.send('you have reached the protected page!');
});


app.post('/sendtweet', (req, res, next) => {
  console.log(req.body.tweet);
  client.post('statuses/update', {status: req.body.tweet}, (err, tweet, response) => {
    if(err) {
      console.log('statuses/update error');
      throw err;
    }
    console.log(tweet);
    console.log(response);
  })
  res.send('tweet sent!');
})

app.get('/timeline', (req, res, next) => {
  console.log('Get Twitter timeline');
  res.send('get user timeline?')
})

app.listen(3000, () => {
  console.log('Word Guess Game listening on 3000!');
});


// helper functions

function createNewGame( req ) {
  // we need to initialize req.session with game information
  req.session.game = {
    userName: 'Anonymous User',
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

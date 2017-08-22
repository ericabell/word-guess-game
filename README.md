# A Word-Guessing Game

This is the simple game of Hangman. A word is
chosen at random from a collection of words and you
are provided with how many letters are in the word.
You are also given a category for the word. You get some
number of guesses and if you manage to guess the word
correctly, you win.

Notable implementation features:
1. A keypress is detected for guessing a letter.
1. Validation checks to make sure you entered a letter.
1. Win/Loss count is kept in the session so you can play
multiple games without losing your streak.
1. The session is kept in a MongoDB collection and so
persists across events such as server restart.

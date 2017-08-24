const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');
ObjectId = require('mongodb').ObjectID;

mongoose.Promise = require('bluebird');

const twitterUserSchema = new mongoose.Schema({
    provider: {
      type: String, required: true
    },
    providerId: {
      type: String, required: true
    },
    displayName: {
      type: String, required: true
    }
});

twitterUserSchema.plugin(findOrCreate);

const TwitterUser = mongoose.model('TwitterUser', twitterUserSchema);

module.exports = TwitterUser;

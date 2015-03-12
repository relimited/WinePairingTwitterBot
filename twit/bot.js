//
//  Bot
//  class for performing various twitter actions
//
var Twit = require('./lib/twitter');

var Bot = module.exports = function(config) { 
  this.twit = new Twit(config);
};

//
//  Post a tweet
//
Bot.prototype.tweet = function (status, callback) {
  if(typeof status !== 'string') {
    return callback(new Error('tweet must be of type String'));
  } //else if(status.length > 140) {
    //return callback(new Error('tweet is too long: ' + status.length));
  //}
  this.twit.post('statuses/update', { status: status }, callback);
};

//Get the current size of t.co links
Bot.prototype.getConfiguration = function(callback) {
	this.twit.get('help/configuration', {}, callback);
};

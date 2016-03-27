var MongoClient = require('mongodb').MongoClient,
    accounts = require('require-all')(__dirname + '/../config/accounts'),
    twitter_config = require(__dirname + '/../config/twitter'),
    Twit = require('twit');

const url = 'mongodb://localhost:27017/twitter-watch';

var s_accounts = "";
Object.keys(accounts).forEach(function(key) {
    if (s_accounts.length > 0) s_accounts += ',';
    var _a = accounts[key].accounts;
    s_accounts += _a.join(',');
});

var T = new Twit({
    consumer_key: twitter_config.auth.consumer_key,
    consumer_secret: twitter_config.auth.consumer_secret,
    access_token: twitter_config.auth.access_token,
    access_token_secret: twitter_config.auth.access_token_secret
});

MongoClient.connect(url, function(err, db) {
    if (err) {
        return console.dir(err);
    }
    console.log('Connected correctly to server.');

    var tweets = db.collection('tweets');

    var stream = T.stream('statuses/filter', { follow: s_accounts });

    stream.on('tweet', function(tweet) {
        console.log('Inserting @' + tweet.user.screen_name + ': "' + tweet.text + '"');
        tweets.insertOne(tweet, {w:1}, function(err, result) {
            if (err) console.error(err);
        });
    });

    stream.on('delete', function(deleteMessage) {
        tweets.updateOne(
            { "id_str": deleteMessage.status.id_str },
            {$set: { "deleted": true }},
            function(err, result) {
                if (err) console.error(err);
            }
        );
    });
});
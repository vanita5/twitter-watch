var MongoClient = require('mongodb').MongoClient,
    accounts = require('require-all')(__dirname + '/../config/accounts'),
    twitter_config = require(__dirname + '/../config/twitter'),
    Twit = require('twit');

const url = require(__dirname + '/../config/mongo').url;

var arr_accounts = [];
Object.keys(accounts).forEach(function(file_key) {
    Object.keys(accounts[file_key]).forEach(function(account_key) {
        if (account_key.charAt(0) === '_') return;
        arr_accounts.push(accounts[file_key][account_key].id_str);
    });
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

    var stream = T.stream('statuses/filter', { follow: arr_accounts });

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
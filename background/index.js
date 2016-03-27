var MongoClient = require('mongodb').MongoClient,
    account_configs = require('require-all')(__dirname + '/../config/accounts'),
    twitter_config = require(__dirname + '/../config/twitter'),
    Twit = require('twit');

const url = require(__dirname + '/../config/mongo').url;

MongoClient.connect(url, function(err, db) {
    if (err) {
        return console.dir(err);
    }
    console.log('Connected correctly to server.');

    var tweets = db.collection('tweets');
    var accounts = db.collection('accounts');

    console.log('Empty old accounts collection...');
    accounts.deleteMany({}, function(err, result) {
        if (err) console.error(err);

        var docs = [];
        Object.keys(account_configs).forEach(function(file_key) {
            Object.keys(account_configs[file_key]).forEach(function(account_key) {
                if (account_key.charAt(0) === '_') return;
                var account = account_configs[file_key][account_key];
                docs.push(account);
            });
        });
        console.log('Got %d accounts from JSON files.', docs.length);
        accounts.insertMany(docs, {w:1}, function(err, result) {
            if (err) console.error(err);

            //validate
            accounts.count(function(err, result) {
                console.log('Inserted %d accounts!', result);

                //collect account ids for filter stream
                var account_ids = [];
                accounts.find({}, { _id: 0, id_str: 1 }).toArray(function(err, result) {
                    if (err) { console.error(err); return; }
                    result.forEach(function(acc) {
                        account_ids.push(acc.id_str);
                    });
                    initStream(account_ids, tweets);
                });
            });
        });
    });
});

var initStream = function(account_ids, tweets) {
    console.log('Starting stream...');

    var T = new Twit({
        consumer_key: twitter_config.auth.consumer_key,
        consumer_secret: twitter_config.auth.consumer_secret,
        access_token: twitter_config.auth.access_token,
        access_token_secret: twitter_config.auth.access_token_secret
    });

    var stream = T.stream('statuses/filter', { follow: account_ids });

    stream.on('tweet', function(tweet) {
        console.log('Inserting @' + tweet.user.screen_name + ': "' + tweet.text + '"');

        //TODO Filter
        //Filter retweets from unobserved accounts
        //Filter mentions targeting observed accounts

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
};
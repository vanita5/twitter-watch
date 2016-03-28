'use strict';
const MongoClient = require('mongodb').MongoClient,
    account_configs = require('require-all')(__dirname + '/../config/accounts'),
    twitter_config = require(__dirname + '/../config/twitter'),
    Twit = require('twit'),
    url = require(__dirname + '/../config/mongo').url;


const T = new Twit({
    consumer_key: twitter_config.auth.consumer_key,
    consumer_secret: twitter_config.auth.consumer_secret,
    access_token: twitter_config.auth.access_token,
    access_token_secret: twitter_config.auth.access_token_secret
});

MongoClient.connect(url, (err, db) => {
    if (err) {
        return console.dir(err);
    }
    console.log('Connected correctly to server.');

    var tweets = db.collection('tweets');
    var accounts = db.collection('accounts');

    console.log('Empty old accounts collection...');
    accounts.deleteMany({})
        .catch((e) => {console.error(e);})
        .then(() => {
            //collect accounts from jsons and save them into the db
            var docs = [];
            for(var file_key in account_configs) {
                for(var account_key in account_configs[file_key]) {
                    if (account_key.charAt(0) === '_') continue;
                    var account = account_configs[file_key][account_key];
                    docs.push(account);
                }
            }
            console.log('Got %d accounts from JSON files.', docs.length);
            return accounts.insertMany(docs, {w:1});
        })
        .catch((e) => {console.error(e);})
        .then(() => {
            //collect account ids for filter stream
            return accounts.find({}, { _id: 0, id_str: 1 }).toArray();
        })
        .catch((e) => {console.error(e);})
        .then((account_ids) => {
            initStream(account_ids, tweets);
        });
});

var initStream = function (account_ids, tweets) {
    console.log('Starting stream...');

    var stream = T.stream('statuses/filter', { follow: account_ids });

    stream.on('tweet', (tweet) => {
        if (filter(tweet, account_ids)) return;
        console.log('Inserting @' + tweet.user.screen_name + ': "' + tweet.text + '"');
        tweets.insertOne(tweet, {w:1})
            .catch((e) => {console.error(e);});
    });

    stream.on('delete', (deleteMessage) => {
        tweets.updateOne({"id_str": deleteMessage.delete.status.id_str},
                         {$set: { "deleted": true }})
            .catch((e) => {console.error(e);});
    });
};

var filter = function (tweet, accounts_ids) {

    //case 1: tweet.user.id_str is NOT an observed account -> this is a mention or a retweet from someone else
    if (accounts_ids.indexOf(tweet.user.id_str) < 0) return true;

    return false;
};
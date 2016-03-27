var MongoClient = require('mongodb').MongoClient;

const url = require(__dirname + '/../config/mongo').url;

MongoClient.connect(url, function(err, db) {
    if (err) {
        return console.dir(err);
    }
    console.log('Connected correctly to server.');

    var tweets = db.collection('tweets');
    var accounts = db.collection('accounts');

    console.log('Empty accounts collection...');
    accounts.deleteMany({}, function(err, result) {
        if (err) console.error(err);
        console.log('Accounts collection cleared!');

        console.log('Empty tweets collection...');
        tweets.deleteMany({}, function(err, result) {
            if (err) console.error(err);
            console.log('Tweets collection cleared!');
            db.close();
        });
    });
});
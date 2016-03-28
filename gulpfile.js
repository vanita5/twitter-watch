var gulp = require('gulp'),
    util = require('gulp-util'),
    inquirer = require('inquirer'),
    mongobackup = require('mongobackup');

gulp.task('default', function() {
    util.log('No default task!');
});

gulp.task('db-backup', function() {
    mongobackup.dump({
        host: 'localhost',
        db: 'twitter-watch',
        collection: 'tweets',
        out: './backup'
    });
});

gulp.task('db-restore', function() {
    mongobackup.restore({
        host: 'localhost',
        db: 'twitter-watch',
        path: './backup/twitter-watch',
        drop: false
    });
});

gulp.task('db-clear', function(cb) {
    inquirer.prompt([{
        type: 'confirm',
        message: 'Do you really want to clear the database? All data will be lost!',
        default: false,
        name: 'clear'
    }], function(answers) {
        if(answers.clear) {
            util.log('Clearing the database...');

            var MongoClient = require('mongodb').MongoClient;

            const url = require(__dirname + '/config/mongo').url;

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
                        cb();
                    });
                });
            });
        } else {
            util.log('Canceled');
            cb();
        }
    });
});
'use strict';
const gulp = require('gulp'),
    util = require('gulp-util'),
    inquirer = require('inquirer'),
    mongobackup = require('mongobackup');

gulp.task('default', () => {
    util.log('No default task!');
});

gulp.task('db-backup', () => {
    mongobackup.dump({
        host: 'localhost',
        db: 'twitter-watch',
        collection: 'tweets',
        out: './backup'
    });
});

gulp.task('db-restore', () => {
    mongobackup.restore({
        host: 'localhost',
        db: 'twitter-watch',
        path: './backup/twitter-watch',
        drop: false
    });
});

gulp.task('db-clear', (cb) => {
    inquirer.prompt([{
        type: 'confirm',
        message: 'Do you really want to clear the database? All data will be lost!',
        default: false,
        name: 'clear'
    }], (answers) => {
        if(answers.clear) {
            util.log('Clearing the database...');

            const MongoClient = require('mongodb').MongoClient;

            const url = require(__dirname + '/config/mongo').url;

            MongoClient.connect(url, (err, db) => {
                if (err) {
                    return console.dir(err);
                }
                console.log('Connected correctly to server.');

                var tweets = db.collection('tweets');
                var accounts = db.collection('accounts');

                console.log('Empty accounts collection...');
                accounts.deleteMany({})
                    .catch((e) => {console.error(e);})
                    .then(() => {
                        console.log('Accounts collection cleared!');

                        console.log('Empty tweets collection...');
                        return tweets.deleteMany({});
                    })
                    .catch((e) => {console.error(e);})
                    .then(() => {
                        console.log('Tweets collection cleared!');
                        db.close();
                        cb();
                    });
            });
        } else {
            util.log('Canceled');
            cb();
        }
    });
});
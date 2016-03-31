'use strict';
const MongoClient = require('mongodb').MongoClient,
    twitter_config = require(__dirname + '/../config/twitter'),
    Twit = require('twit'),
    url = require(__dirname + '/../config/mongo').url,
    account_configs = require('require-all')({
        dirname: __dirname + '/../config/accounts',
        recursive: false
    });


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
    let last, ids;

    
    tweets.createIndex({id_str: 'text'},{w: 1, unique: true})
    .catch((e) => {console.error(e);})
    .then(() => {
        console.log('Empty old accounts collection...');
        return accounts.deleteMany({});
    })
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
        //find newest tweet in database
        return tweets.find({}, {_id: 0, id_str: 1}).sort({id_str: -1}).limit(1).next();
    })
    .catch((e) => {console.error(e);})
    .then((last_id) => {
        last = last_id.id_str;
        //collect account ids for filter stream
        return accounts.find({}, { _id: 0, id_str: 1 }).toArray();
    })
    .catch((e) => {console.error(e);})
    .then((account_ids) => {
        ids = account_ids.map((id)=>{return id.id_str;});
        return initStream(ids, tweets);
    })
    .then((account_ids) => {
        fetchPreviousTweets(ids, tweets, last);
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
        tweets.updateOne(
            {"id_str": deleteMessage.delete.status.id_str},
            {$set: { "deleted": true }}
        )
        .catch((e) => {console.error(e);});
    });
    
    stream.on('disconnect', (disconnectMsg) => {
        console.log('Disconnected from stream: ' + disconnectMsg);
    });
    
    stream.on('reconnect', (request, response, connectInterval) => {
        console.log('Trying to reconnect in ' + connectInterval + 'ms…');
    });
    
    return new Promise((resolve, reject) => {
        stream.on('connected', (response) => {
            if(response.statusCode === 200){
                console.log('Connected successfully!');
                resolve();
            }
        });
    });
};

var fetchTimeline = function (id, tweets) {
    //right now twit does not reject promises on rate limit errors but the promise chain should break
    //https://github.com/ttezel/twit/issues/256
    let getTimeline = new Promise((resolve, reject) => {
        T.get('statuses/user_timeline', {user_id: id, count: 200, include_rts: true})
        .then((result) => {
            if(result.data.errors && result.data.errors.length) reject(result.data.errors[0]);
            else if (result.data.length === 0) reject(new Error("Empty timeline."));
            else resolve(result.data);
        },(e) => {
            reject(e);
        });
    });
    
    return new Promise((resolve, reject) => {
        getTimeline
        .then((result) => {
            result = result.map((tweet) => {
                let insertOp = {insertOne: {document: {}}};
                insertOp.insertOne.document = tweet;
                return insertOp;
            });
            return tweets.bulkWrite(result, {w: 1});
        }, (e) => {
            e.id = id;
            if(e.code === 88) reject(e);
            else console.error(e);
        })
        .catch((e) => {console.error(e);})
        .then(resolve);
    });
};

var fetchPreviousTweets = function (account_ids, tweets) {
    sync(function* (){
        let redoStack = [];
        let start = new Date().getTime();
        try{
            for(let id of account_ids){
                let result = yield fetchTimeline(id, tweets);
                console.log('Fetched timeline for ' + id + ' (' + (account_ids.indexOf(id) + 1) +'/' + account_ids.length + ')');
                if(result && result.nInserted > 0) console.log('Inserted ' +  result.nInserted + ' new tweet(s) into the database');
            }
        } catch(err){
            //got rate limit
            let pos = account_ids.indexOf(err.id);
            console.log("got rate limit at timeline " + (pos + 1));
            redoStack = redoStack.concat(account_ids.slice(pos));
        }
        
        let rateLimit, rateLimitReset;
        try{
            rateLimit = yield T.get('application/rate_limit_status', {resources: 'statuses'});
            rateLimitReset = rateLimit.data.resources.statuses['/statuses/user_timeline'].reset*1000 + 30000;
        } catch(err){
            console.error(err);
        }
        
        let end = new Date().getTime();
        let difference = end-start;
        
        if(redoStack.length > 0){
            let redoTime = rateLimitReset || ((60000*16)-difference); //rate limit refreshes every 15 minutes. 1min extra against slippery slopes.
            setTimeout(() => {
                fetchPreviousTweets(redoStack, tweets);
            }, rateLimitReset-end);
            let redoDate = new Date(redoTime);
            console.log('Scheduled remaining ' + redoStack.length + ' timeline-fetches for ' + redoDate.toLocaleDateString() + ' ' + redoDate.toLocaleTimeString() + ' system time');
        }
        
        console.log('finished in ' + difference + ' ms');
    });
};

var filter = function (tweet, accounts_ids) {

    //case 1: tweet.user.id_str is NOT an observed account -> this is a mention or a retweet from someone else
    if (accounts_ids.indexOf(tweet.user.id_str) < 0) return true;

    return false;
};

//this function - makes all - promises - look synchrone - oh don't ask why - oh don't ask why
//https://www.youtube.com/watch?v=PAK5blgfKWM
var sync = (fn) => {
    let iterator = fn();
    let loop = (result) => {
        if(!result.done) result.value.then((res) => {loop(iterator.next(res));}, (err) => {loop(iterator.throw(err));});
    };
    loop(iterator.next());
};
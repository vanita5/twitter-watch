# twitter-watch

A web application to watch Twitter account activity and topics, intended to observe social media usage of german parties (polit.) 

## Installation

1. [Setup MongoDB](https://docs.mongodb.org/manual/installation/#tutorials)
2. Clone this repository
3. Install dependencies
`npm install`
4. Copy `config/twitter_sample.json` to `config/twitter.json` and fill in your API Keys from [apps.twitter.com](https://apps.twitter.com/)
5. Run background script to stream tweets right into your database
`npm run-script background`
6. Start webapp
`npm start`

## Files

#### Configs

Configuration files are found under `config`.

* `twitter.json`
    Contains API Keys for Twitter authorization.
    
    
* `mongo.json`
    Defines the URL of your Mongo DB
    
    
* `accounts/*.json`
    JSON files containing arrays of Twitter user IDs. They are used to observe those accounts.
    
#### Extra

This directory contains extra information like lists of Twitter accounts (e.g. German parties), research and documentation. 

## Credits / Thanks

[@Jeff_Tichar](https://twitter.com/jeff_tichar) for his collection of german parties Twitter accounts (see `extra/jeff_tichar1.jpg` and `extra/jeff_tichar2.jpg`)
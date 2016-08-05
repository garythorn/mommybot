/*jshint esnext: true */
// jshint ignore:start
// jscs:disable
'use strict';

const request = require('request');
const rp = require('request-promise');
const _ = require('lodash');

const botUserId = "user/1470361823098000000"
const botAuth = {
  grant_type: 'password',
  username: 'mommybot',
  password: '5XP1h38&4lD55o37cl#T'
};
const commands = {
  'raffle': {callback: start_raffle, optional: ['raffle_length', 'num_winners']},
  'enter': {callback: enter_raffle, arguments: ['username']}
}

let chatRoomId = process.argv[2];
let headers = {};
let chatRoomUrl = 'http://api.mobcrush.com/api/chatroom/' + chatRoomId + '/';
let contestants = [];
let previous_winners = {};
let num_winners = 1;
let raffle_going = false;

startBot();

// getAuthTokenPromise()
//   .then(token => {
//     console.log(token)
//   })

// getAuthToken(credentials)
//   .then(setHeaders)
//   .then(joinChatroom)

function startBot() {
  getAuthToken();
  // .then(token => {
  //   setHeaders(token);
  // })
  // .then
}

function getAuthTokenPromise() {
  return new Promise((resolve, reject) => {
    request.post(
      {
        url: 'http://6ef1f4b5-d19c-49f2-9ef9-edd0193a49c4:a@api.mobcrush.com/oauth2/token',
        form: botAuth
      },
      (err, response, body) => {
        if (body) {
          let info = JSON.parse(body);
          let token = info.access_token;
          resolve(token);
        } else {
          reject(err)
        }
    });
  })
}

function getAuthToken() {
  request.post(
    {
      url: 'http://6ef1f4b5-d19c-49f2-9ef9-edd0193a49c4:a@api.mobcrush.com/oauth2/token',
      form: botAuth
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        let token = info.access_token;
        setHeaders(token);
        joinChatRoom();
      }
  });
}

function setHeaders(token) {
  headers.Authorization = 'Bearer ' + token;
}

function joinChatRoom() {
  request.put(
    {
      url: chatRoomUrl + 'presence',
      headers: headers
    }, (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        if(info.message === "success") {
          getSubscriberId();
        }
      }
  });
}

function getChatMessages() {
  request.get(
    {
      url: chatRoomUrl + 'chatmessage'
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        let entries = info.result.entries;
        _.each(entries, entry => {
          parseMessage(entry);
        });
      }
  });
}

function parseMessage(entry) {
  if (!entry) return;
  let messageData = entry.chatroomActivityData.chatroomMessageActivity.chatroomMessageActivityData;
  if (messageData.senderId == botUserId) return;

  let message = messageData.text.toLowerCase().trim();
  if (!_.startsWith(message, '!mommybot')) return;

  let tokens = message.split(" ");
  tokens.shift();
  let command = commands[tokens.shift()];
  let args = {};
  let counter = 0;
  if (_.isEmpty(command)) return;

  if (command.arguments) {
    while (counter !== command.arguments.length) {
      if (tokens.length === 0) break;
      args[command.arguments[counter]] = tokens.shift();
      counter++;
    }

    if (counter < command.arguments.length) {
      return;
    }
  }

  if (command.optional) {
    if (tokens.length !== 0 && command.optional) {
      command.optional.forEach(function(o) {
        args[o] = tokens.shift();
      })
    }
  }

  command.callback(args)
}

function hideMessage(messageId) {
  request.put(
    {
      url: chatRoomUrl + messageId,
      form: {
        message_text: "",
        parent_event_id: messageId
      },
      headers
  });
}

function getSubscriberId() {
  request.post(
    {
      url: 'https://api.mobcrush.com/api/pubsub/subscriber',
      headers: headers
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        subscribeToTopics(info.result.subscriberId);
      }
  });
}

function subscribeToTopics(subscriberId) {
  request.put(
    {
      url: 'https://api.mobcrush.com/api/pubsub/' + subscriberId + '/topic/message/chatroom/' + chatRoomId + '?k=json&k=hydrations_json'
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        startLongPolling(subscriberId);
      }
  });
}

function startLongPolling(subscriberId) {
  request.delete(
    {
      url: 'https://api.mobcrush.com/api/pubsub/' + subscriberId + '/articles/head'
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        //console.log(info)
        if(info.result.data.json) {
          let msgEvent = JSON.parse(info.result.data.json);
          parseMessage(msgEvent);
        }
      }
      startLongPolling(subscriberId);
  });
}

function send_message(text) {
  request.post(
    {
      url: chatRoomUrl + 'chatmessage',
      form: {
        message_text: text
      },
      headers: headers
    });
}

function start_raffle(options) {
  options = options || {};
  let raffle_length = options.raffle_length * 1000 || 60000;
  num_winners = options.num_winners || 1;
  contestants = [];

  send_message('Starting the Raffle');
  send_message('Enter the raffle by typing: !mommybot enter <username>')

  raffle_going = true;

  setTimeout(end_raffle, raffle_length);
}

function enter_raffle(options) {
  if (!raffle_going) return;
  options = options || {};

  // v2 will grab username from hydrations
  if (!options.username) {
    send_message('Username required')
  }
  send_message(options.username + ' entered the raffle');
  contestants.push(options.username);
}

function end_raffle() {
  let winners = _.sampleSize(contestants, num_winners);
  let message = 'Winners of the raffle are ' + winners.join(', ') + '.';
  raffle_going = false;
  send_message(message);
}

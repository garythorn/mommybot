/*jshint esnext: true */
// jshint ignore:start
// jscs:disable
'use strict';

const request = require('request');
const rp = require('request-promise');
const _ = require('lodash');

const bot_user_id = "user/1470361823098000000"
const botAuth = {
  grant_type: 'password',
  username: 'mommybot',
  password: '5XP1h38&4lD55o37cl#T'
};
const commands = {
  'raffle': {callback: start_raffle, optional: ['raffle_length', 'num_winners']},
  'enter': {callback: enter_raffle}
}

let chatRoomId = process.argv[2];
let headers = {};
let chatRoomUrl = 'http://api.mobcrush.com/api/chatroom/' + chatRoomId + '/';
let contestants = [];
let previous_winners = {};
let num_winners = 1;
let raffle_going = false;

start_bot();

// getAuthTokenPromise()
//   .then(token => {
//     console.log(token)
//   })

// getAuthToken(credentials)
//   .then(set_headers)
//   .then(joinChatroom)

function start_bot() {
  getAuthToken();
  // .then(token => {
  //   set_headers(token);
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
        set_headers(token);
        join_chatroom();
      }
  });
}

function set_headers(token) {
  headers.Authorization = 'Bearer ' + token;
}

function join_chatroom() {
  request.put(
    {
      url: chatRoomUrl + 'presence',
      headers: headers
    }, (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        if(info.message === "success") {
          get_subscriber_id();
        }
      }
  });
}

function get_messages() {
  request.get(
    {
      url: chatRoomUrl + 'chatmessage'
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        let entries = info.result.entries;
        _.each(entries, entry => {
          parse_message(entry);
        });
      }
  });
}

// I probably don't need this function
function get_user_info(data) {
  data = data || {};


  return {
    username: data.name,
    mongoid: data.mongoid,
    profile_logo: data.profileLogoSmall,
    subtitle: data.subtitle,
    trust_all_links: data.trustAllLinks
  }
}

function parse_message(data) {
  data = data || {};
  let json = data.json;
  let hydrations = data.hydrations;

  if (json && json.chatroomActivityType === 'Message') {
    let messageData = json.chatroomActivityData.chatroomMessageActivity.chatroomMessageActivityData;
    if (messageData.senderId == bot_user_id) return;

    let message = messageData.text.toLowerCase().trim();
    if (!_.startsWith(message, '!mommybot')) return;

    // clean this up
    let tokens = message.split(" ");
    tokens.shift();
    let command = commands[tokens.shift()];
    let args = {
      user: get_user_info(hydrations[messageData.senderId])
    };
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
}

function hide_message(messageId) {
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

function get_subscriber_id() {
  request.post(
    {
      url: 'https://api.mobcrush.com/api/pubsub/subscriber',
      headers: headers
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        subscribe_to_topics(info.result.subscriberId);
      }
  });
}

function subscribe_to_topics(subscriberId) {
  request.put(
    {
      url: 'https://api.mobcrush.com/api/pubsub/' + subscriberId + '/topic/message/chatroom/' + chatRoomId + '?k=json&k=hydrations_json'
    },
    (err, response, body) => {
      if(body) {
        let info = JSON.parse(body);
        start_long_polling(subscriberId);
      }
  });
}

function start_long_polling(subscriberId) {
  request.delete(
    {
      url: 'https://api.mobcrush.com/api/pubsub/' + subscriberId + '/articles/head'
    },
    (err, response, body) => {
      if(body) {
        let data = JSON.parse(body);
        parse_message({
          json: JSON.parse(_.get(data, 'result.data.json', '{}')),
          hydrations: JSON.parse(_.get(data, 'result.data.hydrations_json', '{}'))
        });
      }
      start_long_polling(subscriberId);
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
  if (raffle_going) return;

  options = options || {};
  let raffle_length = options.raffle_length * 1000 || 60000;
  num_winners = options.num_winners || 1;

  send_message('Starting the Raffle!\nEnter the raffle by typing: !mommybot enter')
  raffle_going = true;
  setTimeout(end_raffle, raffle_length);
}

function enter_raffle(options) {
  if (!raffle_going) return send_message('Raffle not currently going');
  options = options || {};
  let user = options.user;

  // v2 will grab username from hydrations
  if (!user.username) {
    // send_message('Unable to resolve username')
    console.log('couldnt get username');
  }
  send_message(user.username + ' entered the raffle');
  contestants.push(user.username);
}

function end_raffle() {
  let winners = _.sampleSize(contestants, num_winners);
  let message = '';
  if (num_winners === 1) {
    message = 'Winner of the raffle is ' + winners[0] + '.';
  } else {
    message = 'Winners of the raffle are ' + winners.join(', ') + '.';
  }

  send_message(message);

  contestants = [];
  raffle_going = false;
}

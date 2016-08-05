/*jshint esnext: true */
// jshint ignore:start
// jscs:disable
'use strict';

let request = require('request');
let rp = require('request-promise');
let _ = require('underscore');

let botUserId = "user/1470361823098000000"

let botAuth = {
  grant_type: 'password',
  username: 'mommybot',
  password: '5XP1h38&4lD55o37cl#T'
};

let headers = {};
let chatRoomId = 1464010014814000000;
let chatRoomUrl = 'http://api.mobcrush.com/api/chatroom/' + chatRoomId + '/';

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
  if (messageData.senderId == botUserId) {
    return;
  }
  let message = messageData.text.toLowerCase();
  let length = bannedWords.length;
  while(length--) {
    let word = bannedWords[length];
    if(message.indexOf(word) != -1) {
      hideMessage(messageData.messageId);
      sendMessage('You can\'t say "' + word + '"!');
    }
  }
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

function sendMessage(text) {
  request.post(
    {
      url: chatRoomUrl + 'chatmessage',
      form: {
        message_text: text
      },
      headers: headers
    });
}

function raffle(options) {
  options = options || {};
  if (!options.numWinners) {
    options.numWinners = 1;
  }

  var winners = lodash.sampleSize(lodash.values(vm.presentUsers), options.numWinners);
  winners = winners.map(function(winner) {
    return winner.username;
  })
  var message = 'Winners of the raffle are ' + winners.join(', ') + '.';
}

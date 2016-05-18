var login = require('facebook-chat-api');
var prompt = require('prompt');
var fs = require('fs');
var storage = require('node-persist');
var Bot = require('botjs');

function filterInt (value) {
  'use strict';
  if(/^(\-|\+)?([0-9]+|Infinity)$/.test(value))
    return Number(value);
  return NaN;
}

function prettify (height) {
  'use strict';
  return Math.floor(height / 12) + '\'' + height % 12 + '"';
}

function quote(args, botAPI, event) {
  'use strict';
  let responses = [
    'No bend whatsoever!',
    'Plant like you mean it!', 
    'Ya got a little bend!', 
    'No bend whatsoever!',
    'I\'m not saying lock your arm...but lock it',
    'Jump and Drive!',
    'A good plant gets you higher!',
    'Run faster!',
    'Jump higher!',
    'Vault higher!'
  ];
  botAPI.sendMessage(responses[Math.floor(Math.random() * responses.length)], event.threadID);
}

function pr(args, botAPI, event) {
  'use strict';
  if (args.length < 1)
    return;
  else { 
    let height = event.body;
    height = height.split(' ')[1];
    let things = height.split(/'|"/g);
    if (isNaN(filterInt(things[0])))
      return;
    let num = (things[1] === null || isNaN(filterInt(things[1]))) ? 
      filterInt(things[0]) * 12 : filterInt(things[0]) * 12 + filterInt(things[1]);

    storage.getItem('heights', (err, heights) => {
      if (err) {
        console.error(err);
        return;
      } else {
        if (!heights) {
          heights = [];
        }
        botAPI.api.getUserInfo(event.senderID, (err, res) => {
          if (err)
            return console.log(err);
          heights = heights.filter((a) => {
            return a.id !== event.senderID;
          });
          heights.push({'id': event.senderID, 'height': num, 'name': res[event.senderID].name});
          storage.setItem('heights', heights, (err) => {
            if (err)
              return console.error(err);
            botAPI.sendMessage('New Personal Record: ' + prettify(num), event.threadID);
          });
        });
      }
    });
  }
}

function scoreboard(args, botAPI, event) {
  'use strict';
  storage.getItem('heights', (err, heights) => {
    if (err) {
      console.error(err);
      return;
    }
    if (!heights)
      return;
    let message = '';
    heights.sort((a, b) => {
      return b.height - a.height;
    });

    heights.forEach((val, ind) => {
      message += '\n' + (ind + 1) + '. ' + val.name + ': ' + prettify(val.height);
    });
    botAPI.sendMessage(message, event.threadID);
  });
}

function note(args, botAPI, message) {
  'use strict';
  // Make sure correct number of arguments
  if(args.length < 2) {
    botAPI.sendMessage('Oh no, an error occurred!',
      message.threadID);
  }
  else {
    let name = args[0];
    let note = args.slice(1).join(' ');
    if (!note) {
      botAPI.sendMessage('No note specified!',
        message.threadID);
    }
    botAPI.getUserByName(name, message.threadID, (err, res) => {
      if (err)
        return console.error(err);

      if (res.length > 1) {
        let response = 'There is more than one person by that name!\nDo you mean:\n';
        res.forEach((val) => {
          response += '\t- ' + val.name + '\n';
        });
        botAPI.sendMessage(response, message.threadID);
        return;
      }

      let id = res[0].id;  
      storage.getItem('notes', (err, notes) => {
        if (err)
          return console.error(err);
        if (!notes) {
          notes = {};
          notes[id] = {};
          notes[id][message.threadID] = [note];
        }
        else {
          if (notes[id]) {
            if (notes[id][message.threadID])
              notes[id][message.threadID].push(note);
            else {
              notes[id][message.threadID] = [note];
            }
          }
          else {
            notes[id] = {};
            notes[id][message.threadID] = [note];
          }
        }
        storage.setItem('notes', notes, (err) => {
          if(err)
            return console.error(err);
          else
            return botAPI.sendMessage('Note for ' + res[0].name + ' set.', message.threadID);
        });
      });
    });
  }
}

function sendNote (botAPI, message) {
  'use strict';
  botAPI.api.getUserInfo(message.senderID, (err, res) => {
    if (err) {
      console.error(err);
    }
    else {
      storage.getItem('notes', (err, notes) => {
        if (err)
          return console.error(err);
        if (!notes)
          return;
        if (notes[message.senderID] && notes[message.senderID][message.threadID]) {
          if (notes[message.senderID][message.threadID].length > 0) {
            let response = 'Hey, ' + 
            res[message.senderID].name + 
            '! Here are some notes for you!\n';
            while (notes[message.senderID][message.threadID][0]) {
              response += '\t"'  + notes[message.senderID][message.threadID][0] + '"\n';
              notes[message.senderID][message.threadID].shift();
            }
            botAPI.sendMessage(response, message.threadID);
            storage.setItem('notes', notes, (err) => {
              if (err)
                console.error(err);
            });
          }
        }
      });
    }
  });
}

//where credentials is the user's credentials as an object, fields `email` and `password
function authenticate(credentials){
  'use strict';
  login(credentials, function(err, api) {
    if(err) return console.error(err);

    if(credentials.email)
      fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));

    console.log('Logged in'); //we've authenticated

    storage.initSync();

    let gb = new Bot('Pole Vault Bot', api);
    gb.command('!advice', quote, '!advice')
      .command('!pr', pr, '!pr <height>')
      .command('!scoreboard', scoreboard, '!scoreboard')
      .command('!note', note, '!note <name> <message>')
      .event(sendNote, 'message');
  });

}

try {
  authenticate({appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))});
}
catch (err) {
  console.log('Enter your Facebook credentials - ' + 
  'your password will not be visible as you type it in');
  prompt.start();
  prompt.get([{
    name: 'email',
    required: true
  }, {
    name: 'password',
      hidden: true,//so we don't see the user's password when they type it in
      conform: function () {
        'use strict';
        return true;
      }
    }], function (err, result) {
      'use strict';
      authenticate(result); //pass credentials to authenticate function
    }
  );
}


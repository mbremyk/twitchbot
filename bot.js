const tmi = require('tmi.js');
const fetch = require('node-fetch');
const { normalize } = require('path');
const readline = require('readline');
require('dotenv').config();

const HornyJail = require('./HornyJail');

const api = 'https://api.twitch.tv/helix/';
const headers = {
    'Authorization': `Bearer ${process.env.OAUTH_TOKEN.slice(6)}`,
    'client-id': process.env.CLIENT_ID
};

const opts = {
    identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.OAUTH_TOKEN
    },
    channels: [
        process.env.CHANNEL_NAME, ...process.env.CHANNEL_LIST.split(' ')
    ]
};

const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

let hornyjail = new HornyJail();

async function onMessageHandler(target, context, msg, self) {
    if (self) { return; }

    const m = msg.split(' ').map(s => s.replace('@', ''));
    const commandName = m[0];
    //console.log(context);

    switch (commandName) {
        case '!so':
            getUser(m[1], res => client.say(target, `Shoutout to ${res}! Check them out at https://twitch.tv/${res}`));
            /*fetch(api + 'users?login=' + m[1], { headers: headers })
                .then(res => res.json())
                .then(res => res.data[0].display_name)
                .then(res => res ? client.say(target, `Shoutout to ${res}! Check them out at https://twitch.tv/${res}`) : console.log(res))
                .catch(e => console.error(e));*/
            break;
        case '!bonk':
            getUser(m[1], res => {
                if (hornyjail.size == 0 || hornyjail.hornyjail.size <= hornyjail.size) {
                    client.say(target, `Bonk! Go to horny jail, ${m[1].trim()}!`);
                    hornyjail.addUser(m[1].trim());
                }
                else {
                    client.say(target, `Horny jail is full! Chat is too horny!`)
                }
            });
            break;
        case '!hornyjail':
            if (hornyjail.hornyjail.size) client.say(target, `These users are in horny jail: ${hornyjail.prisoners}`);
            else client.say(target, `There are no users in horny jail`)
            break;
        case '!free':
            if (hornyjail.removeUser(m[1])) {
                client.say(target, `${m[1]} was freed from horny jail. For now...`);
            }
            break;
        case '!lurk':
            client.say(target, `${context['display-name']} is having a lurk`)
            break;
        default:
            //console.log(`* Unknown command ${commandName}`);
            break;
    }
}

function onConnectedHandler(addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
}

async function getUser(username, callback = null) {
    return await fetch(api + 'users?login=' + username, { headers: headers })
        .then(res => res.json())
        .then(res => res.data[0].display_name)
        .then(res => res && callback ? callback(res) : res)
        .catch(e => console.error(e));
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', terminal);

function terminal(input) {
    m = input.split(' ');

    switch(m[0]){
        case 'to':
            client.say(`#${m[1]}`, m.slice(2).join(' '));
            break;
    }
}
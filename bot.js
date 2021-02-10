const tmi = require('tmi.js');
const fetch = require('node-fetch');
const { normalize } = require('path');
const readline = require('readline');
const OBSWebSocket = require('obs-websocket-js');
require('dotenv').config();

const HornyJail = require('./HornyJail');

//
//
//  Twitch chat connect
//
//

const api = 'https://api.twitch.tv/helix/';
const headers = {
    'Authorization': `Bearer ${process.env.OAUTH_TOKEN.slice(6)}`,
    'Client-Id': process.env.CLIENT_ID
};

const opts = {
    identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.OAUTH_TOKEN
    },
    channels: [
        process.env.CHANNEL_NAME, "CazhStrats"//process.env.CHANNEL_LIST.split(' ')[0]
    ]
};

const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

let hornyjail = new HornyJail();

let lurkers = {};
let me;

async function onMessageHandler(target, context, msg, self) {
    if (self) { return; }

    const m = msg.split(' ').map(s => s.replace('@', ''));
    const commandName = m[0];
    //console.log(context);

    switch (commandName) {
        case '!so':
            getUser(m[1], res => client.say(target, `!Shoutout to ${res.display_name}! Check them out at https://twitch.tv/${res.display_name}`));
            /*fetch(api + 'users?login=' + m[1], { headers: headers })
                .then(res => res.json())
                .then(res => res.data[0].display_name)
                .then(res => res ? client.say(target, `Shoutout to ${res}! Check them out at https://twitch.tv/${res}`) : console.log(res))
                .catch(e => console.error(e));*/
            break;
        case '!bonk':
            getUser(m[1], res => {
                if (hornyjail.size == 0 || hornyjail.hornyjail.size <= hornyjail.size) {
                    client.say(target, `!Bonk! Go to horny jail, ${res.display_name.trim()}!`);
                    hornyjail.addUser(res.display_name.trim(), m[2] ? parseInt(m[2]) * 1000 : null);
                }
                else {
                    client.say(target, `!Horny jail is full! Chat is too horny!`)
                }
            });
            break;
        case '!hornyjail':
            if (Object.keys(hornyjail.hornyjail).length) client.say(target, `!These users are in horny jail: ${hornyjail.prisoners}`);
            else client.say(target, `!There are no users in horny jail`)
            break;
        case '!free':
            if (hornyjail.removeUser(hornyjail, m[1])) {
                client.say(target, `!${m[1]} was freed from horny jail. For now...`);
            }
            break;
        case '!lurk':
            client.say(target, `!${context['display-name']} is having a lurk`)
            break;
        case '!roll':
            client.say(target, `!Rolled a d${m.length > 1 && parseInt(m[1]) ? m[1] : 6} and got ${Math.floor(Math.random() * (m.length > 1 && parseInt(m[1]) ? parseInt(m[1]) : 6)) + 1}`);
            break;
        case '!lurkers':
            client.say(target, `!${lurkers[target] && lurkers[target].length ? `Current lurkers: ${lurkers[target].join(', ')}` : `No lurkers`}`);
            break;
        default:
            //console.log(`* Unknown command ${commandName}`);
            break;
    }
}

client.on('join', async (channel, username, self) => {
    if (self) return;
    if (channel.slice(1) == username) return;

    let followage = await follows(await getUser(username), await getUser(channel.slice(1)));
    //console.log(followage);
    if (!(followage.total)) {
        if (!lurkers[channel]) lurkers[channel] = [];
        lurkers[channel].push(username);
        //console.log(channel, username);
    }
});

client.on('part', (channel, username, self) => {
    if (self) return;

    if (lurkers[channel]) {
        lurkers[channel] = lurkers[channel].filter(p => p != username);
        //console.log(`${username} left ${channel}`);
    }
});

function onConnectedHandler(addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
    me = getUser(process.env.BOT_USERNAME);
}

async function getUser(username, callback = null) {
    return await fetch(api + 'users?login=' + username, { headers: headers })
        .then(res => res.json())
        .then(res => res.data[0])
        .then(res => res && callback ? callback(res) : res)
        .catch(e => console.error(e));
}

//
//
//  Runtime terminal
//
//

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function follows(a, b, callback = null) {
    return await fetch(api + `users/follows?from_id=${parseInt(a.id)}&to_id=${parseInt(b.id)}`, { headers: headers })
        .then(res => res.json())
        .catch(e => console.error(e));
}

async function followUser(user, callback = null) {
    return await fetch(api + `users/follows?scope=user:edit:follows`, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 'to_id': `${user.id}`, 'from_id': `${me.id}` })
    });
}

rl.on('line', terminal);

async function terminal(input) {
    m = input.split(' ');

    switch (m[0]) {
        case 'to':
            client.say(`#${m[1]}`, m.slice(2).join(' '));
            break;
        case 'follows':
            follower = await getUser(m[1]);
            followee = await getUser(m[2]);
            follows(follower, followee)
                .then(res => console.log(res.total));
            break;
        case 'follow':
            followee = await getUser(m[1]);
            followUser(followee)
                .then(res => console.log(res))
                .catch(error => console.error(error));
            break;
        case 'getuser':
            user = await getUser(m[1]);
            console.log(user);
            break;
    }
}

//
//
//  OBS control
//
//

const obs = new OBSWebSocket();

obs.connect({ address: 'localhost:4444' })
    .then(res => obs.send('GetAuthRequired'))
    .then(res => console.log(res))
    .catch(error => console.error(error));

const callback = (data) => {
    console.log(data);
};

//obs.on('ConnectionOpened', (data) => callback(data).catch(error => console.error(error)));
//obs.on('ConnectionClosed', (data) => callback(data));
//obs.on('AuthenticationSuccess', (data) => callback(data));
//obs.on('AuthenticationFailure', (data) => callback(data));


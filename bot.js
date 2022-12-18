const tmi = require('tmi.js');
const fetch = require('node-fetch');
const readline = require('readline');
const OBSWebSocket = require('obs-websocket-js');
const fs = require('fs');
const axios = require('axios');
const say = require('say');
const yargs = require('yargs');
//const ps = require('play-sound')
const naughty_words = require('naughty-words');
const naughty_en = naughty_words.en;
const naughty_no = naughty_words.no;
const naughty = [...new Set(naughty_en.concat(naughty_no))];

require('dotenv').config();

const HornyJail = require('./HornyJail');
const NameQueue = require('./NameQueue');
const DAO = require('./dao.js');

const argv = yargs
    .option('verbose', {
        alias: 'v',
        default: false,
        type: "boolean"
    })
    .argv;

//
//
//  Twitch chat connect
//
//

const api = 'https://api.twitch.tv/helix/';
const headers = {
    'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
    'Client-Id': process.env.CLIENT_ID2
};

const opts = {
    identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.OAUTH_TOKEN
    },
    channels: [
        process.env.CHANNEL_NAME, //"thechippdipp"//process.env.CHANNEL_LIST.split(' ')[0]
    ]
};

const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('subscription', onSubscriptionHandler);
client.on('submysterygift', onSubmysterygiftHandler);
client.on('hosted', onHostedHandler);
client.on('connected', onConnectedHandler);

client.connect().catch(err => console.error(err));

let hornyjail = new HornyJail();

let lurkers = {};
let me;

const dao = new DAO('HorneePolice', 'stream', process.env.MYSQL_PASSWORD);
let commands = {};

let addCommand = (command, message = null, user = null, insert = true) => {
    if (!commands[command]) {
        commands[command] = (target, context, msg) => {
            msg = msg.split(' ');
            answer = message.replace('$(fromuser)', context['display-name']).replace('$(touser)', msg[1]);
            client.say(target, answer);
        };
        if (insert) {
            dao.createCommand(command, message, user);
        }
    }
};

let loadCommands = () => {
    dao.getCommands()
        .then(res => {
            res.forEach(c => {
                addCommand(c.command, c.response, c.user, false);
            });
        });
};
loadCommands();

//addCommand('!hi', '$(fromuser) says hi to $(touser)');

commands['!add'] = (target, context, msg) => {
    //console.log(target, target.replace('#', ''), target.replace('#', '').toLowerCase(), context['display-name'], context['display-name'].toLowerCase(), context.mod)
    if (!(target.replace('#', '').toLowerCase() == context['display-name'].toLowerCase() || context.mod || context['display-name'].toLowerCase() == 'harumin24' || context['display-name'].toLowerCase() == 'thechippdipp')) return;

    msg = msg.split(' ');
    addCommand(msg[1], msg.slice(2).join(' '), context['display-name']);
};

commands['!so'] = (target, context, msg) => {
    getUser(msg.split(' ')[1], res => client.say(target, `!Shoutout to ${res.display_name}! Check them out at https://twitch.tv/${res.display_name}`));
};

commands['!nuzlocke'] = commands['!rules'] = (target, context, msg) => {
    client.say(target, 'The rules of this nuzlocke are pretty lax. Pokémon dies it dies, one mon for each route, set battle style, items in battle allowed but discouraged, only one of each evolution line');
};

commands['!math'] = (target, context, msg) => {
    let m = msg.split(' ').slice(1).join('');
    if (!m.length) return;
    const re = /[^+\-\*\/\d\s]/g;
    client.say(target, re.test(m) ? `Invalid math expression. Invalid characters given by ${re}` : `${m}=` + eval(m));
};

let ttsRunning = false;
let ttsQueue = [];

let censor = (str) => {
    str = str.toLowerCase();
    let words = naughty.filter(word => str.search(word) >= 0);
    words.sort((a, b) => b.length - a.length);
    for (let word of words) {
        while (str.search(word) >= 0) {
            str = str.replace(new RegExp(word, 'gi'), () => parseInt(Math.random() * 100));
        }
    }
    return str;
};

commands['!tts'] = commands['!say'] = commands['!si'] = (target, context, msg) => {
    ttsQueue.push(censor(msg.split(' ').slice(1).join(' ')));
    if (!ttsRunning) {
        ttsRunning = true;
        tts(ttsQueue.shift());
    }
};

let tts = msg => {
    say.speak(msg, null, null, () => {
        if (ttsQueue.length) {
            tts(ttsQueue.shift());
        }
        else {
            ttsRunning = false;
        }
    });
};

commands['!tts'](null, null, "a Initialising twitch bot");
//commands['!tts'](null, null, "a This is an automated message");
//commands['!tts'](null, null, "a This is an automated message");
//commands['!tts'](null, null, "a This is an automated message");

let codeUrl = 'https://github.com/mbremyk/twitchbot';

commands['!code'] = (target, context, msg) => {
    client.say(target, `!My code can be found at ${codeUrl}`);
};

commands['!hug'] = (target, context, msg) => {
    let m = msg.split(' ');
    if (m[1]) {
        client.say(target, `${context['display-name']} gave ${m[1]} a big ol' hug`);
    }
};

let trackerUrl = 'https://nuzlocke.netlify.app/';
commands['!tracker'] = (target, context, msg) => {
    client.say(target, `The nuzlocke tracker can be found at ${trackerUrl}`);
};

let nq;

let loadQueue = (channel) => {
    dao.getQueue().then(res => {
        console.log(res);
        nq = new NameQueue(channel, res);
    });
};

loadQueue("mbremyk");

commands['!queue'] = (target, context, msg) => {
    let m = msg.split(' ');
    switch (m[1]) {
        case 'join': {
            // console.log(context['display-name'], m[2], m[2] ? true : false);
            m.splice(0, 2);
            m = m.join(' ').trim();
            nq.add(context['display-name'], m.length ? m : context['display-name']);
            dao.joinQueue(context['display-name'], m.length ? m : context['display-name']);
            break;
        }
        case 'leave': {
            m.splice(0, 2);
            m = m.join(' ').trim();
            nq.remove(context['display-name'], m.length ? m : null);
            dao.leaveQueue(context['display-name'], m.length ? m : null);
            break;
        }
        case 'next': {
            if (context.mod || target.replace('#', '') == context['display-name']) {
                let o = nq.pop_next();
                client.say(target, `Next name from ${o.user}: ${o.name}`);
                dao.leaveQueue(o.user, o.name);
            } else {
                let o = nq.next();
                client.say(target, `Next name from ${o.user}: ${o.name}`);
            }
            break;
        }
        default: {
            let str = 'Naming queue: ';
            nq.queue.forEach((o, i) => {
                str += `${i + 1}. ${o.user}: ${o.name} `;
            });
            client.say(target, str);
            break;
        }
    }
};

let normalRNG = (mean, stdDev) => {
    return Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random()) * stdDev + mean;
};

/* let arr = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
console.log(arr);
let max = -Infinity;

for(let i = 0; i < 10000; ++i) {
    let n = normalRNG(300, 100);
    max = n > max ? n : max;
    arr[Math.floor(n/25)]++;
}

console.log(arr);

for(let i = 0; i < arr.length; ++i) {
    let str = '';
    for(let j = 0; j < arr[i] / 100; ++j) {
        str += '#';
    }
    console.log(str);
}

console.log(max); */

/**
 * 
 * Birthday time
 * 
 */

let birthday = {};
let cakes = ['brownie', 'piece of chocolate cake', 'piece of strawberry shortcake', 'piece of marsipan cake', 'gingerbread man', 'gingerbread woman', 'gingerbread enby', 'shapeless gingerbread cookie'];
let drinks = ['cup of tea', 'cup of coffee', 'glass of water', 'glass of champagne', 'dry martini', 'coke', 'pepsi', 'generic soda'];

birthday["!drink"] = (target, context, msg) => {
    let rng = Math.floor(Math.random() * drinks.length);
    client.action(target, `Here ${context['display-name']}, have a ${drinks[rng]}`);
};

birthday["!cake"] = (target, context, msg) => {
    let rng = Math.floor(Math.random() * cakes.length);
    client.action(target, `Here ${context['display-name']}, have a ${cakes[rng]}`);
};

/////////////////////////////////////////

async function onMessageHandler(target, context, msg, self) {
    if (self) { return; }

    const m = msg.split(' ').map(s => s.replace('@', ''));
    const commandName = m[0].toLowerCase();
    //console.log(context);

    if (msg.search('deez') >= 0) {
        client.say(target, 'nuts');
    }

    console.log(context);

    switch (commandName) {
        case '!bonk':
            getUser(m[1], res => {
                if (res.display_name == "HorneePolice" || (me && res.display_name == me.display_name)) return;
                if (hornyjail.prisoners.includes(context['display-name'])) {
                    client.say(target, `!You can't bonk someone from your cell, ${context['display-name']}`);
                }
                else if (hornyjail.prisoners.includes(res.display_name)) {
                    client.say(target, `!${res.display_name} is already in horny jail!`);
                }
                else if (hornyjail.size == 0 || hornyjail.hornyjail.size < hornyjail.size) {
                    client.say(target, `!Bonk! Go to horny jail, ${res.display_name.trim()}!`);
                    hornyjail.addUser(res.display_name.trim(), m[2] ? parseInt(m[2]) * 1000 : null);
                }
                else {
                    client.say(target, `!Horny jail is full! Chat is too horny!`);
                }
            });
            break;
        case '!hornyjail':
            if (Object.keys(hornyjail.hornyjail).length) client.say(target, `!These users are in horny jail: ${hornyjail.prisonersStr}`);
            else client.say(target, `!There are no users in horny jail`);
            break;
        case '!free':
            if (hornyjail.prisoners.includes(context['display-name'])) {
                client.say(target, `!You're in horny jail yourself, ${context['display-name']}`);
            }
            else if (hornyjail.removeUser(hornyjail, m[1])) {
                client.say(target, `!${m[1]} was freed from horny jail. For now...`);
            }
            break;
        case '!lurk':
            client.say(target, `!${context['display-name']} is having a lurk`);
            break;
        case '!roll':
            client.say(target, `!Rolled a d${m.length > 1 && parseInt(m[1]) ? m[1] : 6} and got ${Math.floor(Math.random() * (m.length > 1 && parseInt(m[1]) ? parseInt(m[1]) : 6)) + 1}`);
            break;
        case '!lurkers':
            client.say(target, `!${lurkers[target] && lurkers[target].length ? `Current lurkers: ${lurkers[target].join(', ')}` : `No lurkers`}`);
            break;
        case '!ctof':
            if (m[1]) client.say(target, `! ${m[1]}C is ${Math.floor(parseFloat(m[1]) * 100 * 9 / 5) / 100 + 32}F`);
            else client.say(target, `!Usage: !ctof <int>`);
            break;
        case '!ftoc':
            if (m[1]) client.say(target, `! ${m[1]}F is ${Math.floor((parseFloat(m[1]) - 32) * 100 * 5 / 9) / 100}C`);
            else client.say(target, `!Usage: !ctof <int>`);
            break;
        case '!lookup':
            fetch(`https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API}&cx=${process.env.GOOGLE_CX}&q=${m.slice(1).join('%20')}`)
                .then(res => res.json())
                .then(res => res['items'][0])
                .then(res => client.say(target, `!From ${res['title']}: ${res['snippet']} ${res['link']}`))
                .catch(error => console.error(error));
            break;
        case '!timeout':
            let time = Math.floor(normalRNG(300, 100));
            time = time > 0 ? time : 900;
            if ((target.replace('#', '').toLowerCase() == context['display-name'].toLowerCase() || context.mod) && m[1]) {
                client.timeout(target, m[1], !!(m[2]) ? parseInt(m[2]) : time)
                    .then((channel, username, seconds, reason) => {
                        console.log(`Timed out ${username} in ${channel} for ${seconds} seconds`);
                    });
            }
            else {
                client.timeout(target, context['display-name'], time)
                    .then((channel, username, seconds, reason) => {
                        console.log(`Timed out ${username} in ${channel} for ${seconds} seconds`);
                    });
            }
            break;
        default:
            if (commands[commandName]) {
                commands[commandName](target, context, msg);
            }
            else if (birthday[commandName]) {
                birthday[commandName](target, context, msg);
            }
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

client.on('raided', (channel, username, viewers) => {
    commands['!so'](channel, null, `!so ${username}`);
});

function onConnectedHandler(addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
    me = getUser(process.env.BOT_USERNAME);
}

async function getUser(username, callback = null) {
    let response = { display_name: username };
    return response && callback ? callback(response) : response;
    console.log(`Fetching information about ${username}`);
    return await fetch(api + 'users?login=' + username, { headers: headers })
        .then(res => res.json())
        .then(res => console.log(res))
        .then(res => res.data[0])
        .then(res => res && callback ? callback(res) : res)
        .catch(e => { if (argv.v) console.error(e); });
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
    return true;
    return await fetch(api + `users/follows?from_id=${parseInt(a.id)}&to_id=${parseInt(b.id)}`, { headers: headers })
        .then(res => res.json())
        .catch(e => console.error(e));
}

/*'https://api.twitch.tv/helix/users/follows' \
-H 'Authorization: Bearer a' \
-H 'Client-Id: s' \
-H 'Content-Type: application/json' \
--data-raw '{"to_id": "41245072","from_id": "57059344"}'*/

async function followUser(user, callback = null) {
    return await fetch(api + `users/follows`, {
        method: 'POST',
        headers: {
            //...headers,
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
            'Client-Id': process.env.CLIENT_ID2,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 'to_id': `${user.id}`, 'from_id': `${me.id}` })
    });
}

let getPlan = (methods) => {
    let method = methods.prime ? 4 : parseInt(methods.plan) / 1000;
    return method ? method : 0;
};

async function onSubscriptionHandler(channel, username, methods, message, userstate) {
    let plan = getPlan(methods);
    let method = plan == 4 ? 'with Prime' : `at Tier ${plan}`;
    let tts = `a ${username} just ${userstate['message-type'] == 'resub' ? 're' : ''}subscribed ${method} for ${userstate['msg-param-cumulative-months']} months, saying: ${message}`;
    commands['!say'](channel, null, tts);
}

async function onSubmysterygiftHandler(channel, username, numbOfSubs, methods, userstate) {
    let tts = `a ${username} just gifted ${numbOfSubs} Tier ${getPlan(methods)} sub${numbOfSubs - 1 ? 's' : ''}. That's a lot of wasted money`;
    commands['!say'](channel, null, tts);
}

async function onHostedHandler(channel, username, viewers) {
    client.say(channel, `${username} just hosted with ${viewers} viewers`);
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
        case 'timer':
            target = `#${m[1]}`;
            if (setTimeout(async () => {
                console.log('Sending message');
                if (client.readyState() == "CLOSED") await client.connect();
                client.say(target, m.slice(3).join(' '));
                console.log(`Message "${m.slice(3).join(' ')}" sent`);
            }, parseInt(m[2]) * 1000)) {
                console.log(`I will tell ${m[1]} "${m.slice(3).join(' ')}" in ${m[2]} seconds`);
            }
            break;
        case 'eval':
            eval(m.slice(1).join(' '));
            break;
        case 'exit':
            exit(0);
            break;
    }
}

//
//
//  OBS control
//
//
/*
const obs = new OBSWebSocket();

obs.connect({ address: 'localhost:4444' })
    .then(res => obs.send('GetAuthRequired'))
    .then(res => console.log(res))
    .catch(error => console.error(error));

const callback = (data) => {
    console.log(data);
};
*/
//obs.on('ConnectionOpened', (data) => callback(data).catch(error => console.error(error)));
//obs.on('ConnectionClosed', (data) => callback(data));
//obs.on('AuthenticationSuccess', (data) => callback(data));
//obs.on('AuthenticationFailure', (data) => callback(data));


//analytics:read:extensions%20analytics:read:games%20bits:read%20channel:edit:commercial%20channel:manage:broadcast%20channel:manage:extensions%20channel:manage:redemptions%20channel:manage:videos%20channel:read:editors%20channel:read:hype_train%20channel:read:redemptions%20channel:read:stream_key%20channel:read:subscriptions%20clips:edit%20moderation:read%20user:edit%20user:edit:follows%20user:read:blocked_users%20user:manage:blocked_users%20user:read:broadcast%20user:read:email


//
//
//      Economy
//
//

let bank;
fs.readFile('./bank.json', 'utf8', (err, data) => {
    if (err) console.error(err);
    bank = JSON.parse(data);
    if (!bank) bank = {};
});

function exit(code = 0) {
    process.exit(0);
}

process.on('SIGINT', () => {
    exit(0);
});

//
//
//      Play sound
//
//

//let player = ps({});
//player.play('bonk.mp3', {}, ()=>{});

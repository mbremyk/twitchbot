let defaultJailtime = 120000;

module.exports = class HornyJail {
    constructor(size = 0, defJailtime = defaultJailtime) {
        this.size = size;
        this.hornyjail = {};
        this.defJailtime = defJailtime;
    }

    countdown(context, username, amount, contCallback, endCallback) {
        if ((context.hornyjail[username] -= amount) > 0) {
            setTimeout(() => contCallback(context, username, amount, contCallback, endCallback), 1000);
        }
        else {
            endCallback(context, username);
        }
    }

    addUser(username, time = this.defJailtime) {
        if (!this.hornyjail[username]) this.hornyjail[username] = Math.floor(time / 1000);
        if (time) setTimeout(() => this.countdown(this, username, 1, this.countdown, this.removeUser));
        console.log(`${username} sentenced to ${Math.floor(time / 1000)} seconds in jail`);
    }

    removeUser(context, username) {
        console.log(`${username} removed from horny jail`)
        return delete context.hornyjail[username];
    }

    get prisoners() {
        return Object.keys(this.hornyjail).join(', ');
    }
}

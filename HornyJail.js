let defaultJailtime = 120000;

module.exports = class HornyJail {
    constructor(size = 0, defJailtime = defaultJailtime) {
        this.size = size ? size : null;
        this.hornyjail = new Set();
        this.defJailtime = defJailtime;
    }

    addUser(username, time = this.defJailtime) {
        this.hornyjail.add(username);
        if (time) setTimeout(() => this.removeUser(username), time);
    }

    removeUser(username) {
        console.log(`${username} removed from horny jail`)
        return this.hornyjail.delete(username);
    }

    get prisoners() {
        return Array.from(this.hornyjail).join(', ');
    }
}

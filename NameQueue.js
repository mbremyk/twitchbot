module.exports = class NameQueue {
    constructor(channel, queue = null) {
        this.channel = channel;
        this.queue = queue ? queue : [];
    }

    add(user, name=null) {
        let o = {
            user: user,
            name: name
        };
        this.queue.push(o);
    }

    next() {
        return this.queue[0];
    }

    pop_next() {
        return this.queue.shift();
    }

    remove(user, name=null) {
        if (name) {
            return this.queue = this.queue.filter(o => {
                return o.user != user || o.name != name;
            });
        } else {
            return this.queue = this.queue.filter(o => {
                return o.user != user;
            });
        }
    }
}
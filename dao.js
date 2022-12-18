const {Sequelize, DataTypes} = require('sequelize');

module.exports = class DAO {
    constructor(user, db, password) {
        this.user = user;
        this.db = db;
        this.password = password;
        this.config = {
            username: this.user,
            database: this.db,
            password: this.password,
            port: 3306,
            dialect: 'mysql',
            host: 'localhost'
        }
        this.init();
    }

    init() {
        this.sequelize = new Sequelize(this.config);

        this.commandModel = this.sequelize.define('command', {
            command: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                primaryKey: true
            },
            response: {
                type: DataTypes.STRING
            },
            username: {
                type: DataTypes.STRING
            }
        });

        this.queueModel = this.sequelize.define('queue', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user: {
                type: DataTypes.STRING
            }, 
            name: {
                type: DataTypes.STRING
            }
        }, {
            freezeTableName: true
        });

        this.sequelize.sync();
    }

    getCommands() {
        return this.commandModel.findAll();
    }

    createCommand(command, response, username = null) {
        return this.commandModel.create({
            command: command, 
            response: response, 
            username: username
        });
    }

    getQueue() {
        return this.queueModel.findAll({order: ['id']});
    }

    joinQueue(user, name) {
        return this.queueModel.create({
            user: user,
            name: name
        });
    }

    leaveQueue(user, name=null) {
        let opt = {
            where: {
                user: user
            }
        }
        if(name) opt.where.name = name;
        return this.queueModel.destroy(opt);
    }
}
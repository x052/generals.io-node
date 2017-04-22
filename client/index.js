const io = require('socket.io-client')
const EventEmitter = require('events').EventEmitter

function generalsGame(data) {
	if (data) {
		this.replay_url = 'http://bot.generals.io/replays/' + encodeURIComponent(data.replay_id)
	}

	this.types 		= {
		'-1' : 'TILE_EMPTY',
		'-2' : 'TILE_MOUNTAIN',
		'-3' : 'TILE_FOG',
		'-4' : 'TILE_FOG_OBSTACLE'
	}

	this.scores 	= []

	this.cities 	= []
	this.map 		= []
	this.generals 	= []

	this.map_width 	= 0
	this.map_height = 0
	this.map_size   = 0

	this.terrain 	= []
	this.armies		= []
}

generalsGame.prototype.gameUpdate = function(data) {
	this.scores 	= data.scores

	this.cities 	= this.patch(this.cities, data.cities_diff)
	this.map 		= this.patch(this.map, data.map_diff)
	this.generals 	= data.generals

	this.map_width 	= this.map[0]
	this.map_height	= this.map[1]
	this.map_size  	= this.map_width * this.map_height

	this.armies		= this.map.slice(2, this.map_size + 2)
	this.terrain	= this.map.slice(this.map_size + 2, this.map_size + 2 + this.map_size)

	this.emit('update')
}

generalsGame.prototype.patch = function(old, diff) { //could be optimized
	var out = [];
	var i = 0;
	while (i < diff.length) {
		if (diff[i]) {  // matching
			Array.prototype.push.apply(out, old.slice(out.length, out.length + diff[i]));
		}
		i++;
		if (i < diff.length && diff[i]) {  // mismatching
			Array.prototype.push.apply(out, diff.slice(i + 1, i + 1 + diff[i]));
			i += diff[i];
		}
		i++;
	}
	return out;
}

function generalsClient(user_id, username) {
	this.connecting = false

	this.playerIndex= null
	this.game 		= new generalsGame()
	this.game_id    = null

	this.username 	= username
	this.user_id 	= user_id
	this.socket 	= io('http://botws.generals.io')

	this.socket.on('disconnect', function() {
		console.error('Disconnected from server');
		this.emit('disconnected')
		process.exit(1)
	})
	this.socket.on('connect', function() {
		console.log('Connected to server')
		this.emit('connected')
	}.bind(this))

	this.socket.on('error_set_username', function(e) {
		if (e.length > 1) throw e
	})

	this.socket.on('game_start', function(data) {
		this.playerIndex = data.playerIndex
		this.game = new generalsGame(data)
		console.log('game_start', this.game.replay_url)
		this.emit('game_start')
	}.bind(this))

	this.socket.on('game_lost', function(data) {
		this.playerIndex = null
		console.log('game_lost')
		this.emit('game_lost')
	}.bind(this))

	this.socket.on('game_won', function(data) {
		this.playerIndex = null
		console.log('game_won')
		this.emit('game_won')
	}.bind(this))

	this.socket.on('game_update', function(data) {
		this.game.gameUpdate.bind(this.game)(data)
		this.emit('update')
	}.bind(this))
	/*
	var onevent = this.socket.onevent;
	this.socket.onevent = function (packet) {
	    var args = packet.data || [];
	    onevent.call (this, packet);    // original call
	    packet.data = ["*"].concat(args);
	    onevent.call(this, packet);      // additional call to catch-all
	}
	this.socket.on("*",function(event,data) {
	    console.log(event, data);
	})*/
}

generalsClient.prototype.setUsername = function (username) {
	if (!username) username = this.username
	if (!username) throw("No username provided, can not setUsername")
	if (!this.user_id) throw("No user_id provided")
	if (!username.indexOf('[Bot]') > -1) username = '[Bot]' + username
	this.socket.emit('set_username', this.user_id, username)
}

generalsClient.prototype.playFFA = function () {
	if (!this.user_id) throw("No user_id provided")
	this.socket.emit('play', this.user_id)
}

generalsClient.prototype.play1v1 = function () {
	if (!this.user_id) throw("No user_id provided")
	this.socket.emit('join_1v1', this.user_id)
}

generalsClient.prototype.playPrivate = function (custom_game_id) {
	if (!custom_game_id) throw("No custom_game_id provided")
	if (!this.user_id) throw("No user_id provided")
	this.socket.emit('join_private', custom_game_id, this.user_id)
	this.game_id = custom_game_id
	return 'http://bot.generals.io/games/' + encodeURIComponent(custom_game_id)
}

generalsClient.prototype.leaveQueue = function() {
	this.socket.emit('cancel')
}

generalsClient.prototype.clearMoves = function() {
	this.this.socket.emit('clear_moves')
}

generalsClient.prototype.leaveGame = function() {
	this.socket.emit('leave_game')
}

generalsClient.prototype.attack = function(start, end, is50) {
	this.socket.emit('attack', start, end, is50)
}

generalsClient.prototype.forceStart = function(queue_id, doForce) {
	if (!queue_id) queue_id = this.game_id
	this.socket.emit('set_force_start', queue_id, doForce)
}

for (var key in EventEmitter.prototype) {
    if (!EventEmitter.prototype.hasOwnProperty(key)) continue;
    generalsClient.prototype[key] = generalsGame.prototype[key] = EventEmitter.prototype[key];
}

module.exports = generalsClient

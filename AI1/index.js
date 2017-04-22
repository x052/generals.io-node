const user_id = 'USER_ID_HERE'

const generalsClient = require('../client')
const fs = require('fs')

var bot = new generalsClient(user_id)
bot.newGame = function() {
	bot.playFFA()
	bot.forceStart(null, true)
}

bot.canMove = function(game, start_index, end_index, target_index) {
    var row = Math.floor(start_index / game.map_width)
    var col = start_index % game.map_width
    var buf = [{
        'can_move': false,
        'end_index': 0,
        'is50': false
    }, {
        'can_move': false,
        'end_index': 0,
        'is50': false
    }, {
        'can_move': false,
        'end_index': 0,
        'is50': false
    }, {
        'can_move': false,
        'end_index': 0,
        'is50': false
    }]
    end_index = start_index - 1 //move left
    if (col > 0 && game.terrain[end_index] != -2) {
        buf[0].can_move = true
        buf[0].end_index = end_index
    }

    end_index = start_index + 1 //move right
    if (col < game.map_width - 1 && game.terrain[end_index] != -2) {
        buf[1].can_move = true
        buf[1].end_index = end_index
    }

    end_index = start_index + game.map_width //move down
    if (row < game.map_height - 1 && game.terrain[end_index] != -2) {
        buf[2].can_move = true
        buf[2].end_index = end_index
    }

    end_index = start_index - game.map_width //move up
    if (row > 0 && game.terrain[end_index] != -2) {
        buf[3].can_move = true
        buf[3].end_index = end_index
    }
    if (!target_index) {
        for (var i = buf.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1))
            var temp = buf[i]
            buf[i] = buf[j]
            buf[j] = temp
        }
        return buf
    }
    var buf2 = []

    for (var i = buf.length - 1; i >= 0; i--) {
        var closest = buf.reduce(function(prev, curr) {
            return (Math.abs(curr.end_index - target_index) < Math.abs(prev.end_index - target_index) ? curr : prev)
        })
        buf2.push(closest)
        buf = buf.filter(e => e !== closest)
    }

    return buf2
}

bot.fillCubes = function(bot, game, tile, army, cities, start_index, end_index) {
    var should_fill = true
    var highest_score = {
        score: 0,
        playerIndex: -1
    }
    for (var i = game.scores.length - 1; i >= 0; i--) {
        var score = game.scores[i].total - game.scores[i].tiles
        if (score > highest_score.score) {
            highest_score = {
                score: score + 25,
                playerIndex: game.scores[i]['i']
            }
        }
    }
    if (highest_score.playerIndex === bot.playerIndex) {
        should_fill = false
    }

    if (!should_fill) return false
    var can_move = bot.canMove(game, start_index, end_index)
    for (var i = can_move.length - 1; i >= 0; i--) {
        var obj = can_move[i]
        if (obj.can_move && game.terrain[obj.end_index] === -1) {
            return obj
        }
    }
    return false
}

bot.safeAttack = function(bot, game, tile, army, cities, start_index, end_index) {
    var can_move = bot.canMove(game, start_index, end_index)
    for (var i = can_move.length - 1; i >= 0; i--) {
        var obj = can_move[i]
        if (obj.can_move && game.terrain[obj.end_index] >= 0 && game.armies[obj.end_index] < game.armies[start_index] && game.terrain[obj.end_index] != bot.playerIndex) {
            return obj
        }
    }
    return false
}

bot.dangerAttack = function(bot, game, tile, army, cities, start_index, end_index) {
    var can_move = bot.canMove(game, start_index, end_index)
    for (var i = can_move.length - 1; i >= 0; i--) {
        var obj = can_move[i]
        if (obj.can_move && game.terrain[obj.end_index] >= 0 && game.terrain[obj.end_index] != bot.playerIndex) {
            return obj
        }
    }
    return false
}
bot.getDistance = function(game, start_index, end_index) {
    var row = Math.floor(start_index / game.map_width)
    var col = start_index % game.map_width

    var row2 = Math.floor(end_index / game.map_width)
    var col2 = end_index % game.map_width

    var a = row - row2
    var b = col - col2

    return Math.sqrt(a * a + b * b)
}

bot.spreadPoints = function(bot, game, tile, army, cities, start_index, end_index) {
    var target = null
    var closest_army = 9999999999
    for (var i = game.terrain.length - 1; i >= 0; i--) {
        var tile = game.terrain[i]
        var army = game.armies[i]
        var isBase = (game.generals.indexOf(i) >= 0)
        var distance = bot.getDistance(game, start_index, i)
        if (game.terrain[i] != bot.playerIndex && game.terrain[i] >= 0 && distance < closest_army) {
            target = i
            closest_army = distance
        }
    }
    var can_move = bot.canMove(game, start_index, end_index, target)
    var res_obj = can_move[0]

    for (var i = can_move.length - 1; i >= 0; i--) {
        var obj = can_move[i]
        var army = game.armies[start_index]
        if (obj.can_move) {
            res_obj.logic = 'army !> end'
            res_obj = obj
        }
    }

    for (var i = can_move.length - 1; i >= 0; i--) {
        var obj = can_move[i]
        var army = game.armies[start_index]
        if (obj.can_move && army > game.armies[obj.end_index] && game.armies[obj.end_index] > 1) {
            res_obj.logic = 'army > end'
            res_obj = obj
        }
    }

    for (var i = can_move.length - 1; i >= 0; i--) {
        var obj = can_move[i]
        var army = game.armies[start_index]
        if (obj.can_move && army > game.armies[obj.end_index] && game.terrain[obj.end_index] != bot.playerIndex) {
            res_obj.logic = 'army > end + clean playerIndex'
            res_obj = obj
        }
    }

    console.log(res_obj.logic)

    return res_obj
}

bot.AI_Modes = {
    'attackIfWeCan': bot.safeAttack,
    'fillCubes': bot.fillCubes,
    'attackIfWeMust' : bot.dangerAttack,
}

bot.updateAI = function() {
    var hasMoved = false
    var game = bot.game
    var start_index = 0
    var end_index = 0
    var is50 = false
    for (key in bot.AI_Modes) {
        for (var i = game.terrain.length - 1; i >= 0; i--) {
            var tile = game.terrain[i]
            var army = game.armies[i]
            var city = (game.cities.indexOf(i) >= 0)
            start_index = i
            end_index = i
            if (tile === bot.playerIndex & army >= 2) {
                var res = bot.AI_Modes[key](bot, game, tile, army, city, start_index)
                if (res) {
                    is50 = res.is50
                    end_index = res.end_index
                    break
                }
            }
            start_index = 0
            end_index = 0
        }
        if (end_index != 0) {
            hasMoved = true
            bot.attack(start_index, end_index, is50)
            break
        }
    }
    if (!hasMoved) {
        var highest_army = 0
        var end_tile = 0
        for (var i = game.terrain.length - 1; i >= 0; i--) {
            var tile = game.terrain[i]
            var army = game.armies[i]
            if (tile != bot.playerIndex) continue
            if (highest_army < army) {
                highest_army = army
                start_index = i
                end_index = i
                end_tile = tile
            }
        }
        var res = bot.spreadPoints(bot, game, end_tile, highest_army, false, start_index)
        if (res) {
            bot.attack(start_index, res.end_index, res.is50)
        }
    }
}

bot.on('connected', () => {
    bot.newGame()
    bot.on('game_start', () => {
        console.log('game_start')
    })
    bot.on('update', () => {
        bot.updateAI()
    })
    bot.on('game_lost', () => {
        console.log('I lost :c')
        fs.appendFileSync('log', 'LOSE: ' + bot.game.replay_url + "\n")
        bot.leaveGame()
        bot.newGame()
    })
    bot.on('game_won', () => {
        console.log('I won?')
        fs.appendFileSync('log', 'WIN: ' + bot.game.replay_url + "\n")
        bot.leaveGame()
        bot.newGame()
    })

})
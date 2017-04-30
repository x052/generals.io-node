const ndarray = require('ndarray')
const createPlanner = require('l1-path-finder')

const generalsClient = require('../client')
const fs = require('fs')

var bot = new generalsClient("user_id_here")

bot.newTarget = (game, tile_index) => {
    tile = game.tiles[tile_index]

    var target = {}
    target.type = 'target'

    target.priority = 0
    target.tile = tile

    return target
}

bot.newTile = (game, tile_index) => {
    var tile = {}
    tile.tile = game.terrain[tile_index]
    tile.army = game.armies[tile_index]
    tile.isCity = (game.cities.indexOf(tile_index) >= 0)
    tile.isGeneral = (game.generals.indexOf(tile_index) >= 0)
    tile.isObject = (tile.tile === -2)
    tile.isEnemy = (tile.tile >= 0 && tile.tile != bot.playerIndex)
    tile.isEmpty = (tile.tile === -1)
    tile.isOwned = (tile.tile === bot.playerIndex)

    tile.row = Math.floor(tile_index / game.map_width)
    tile.col = tile_index % game.map_width
    tile.tile_index = tile_index

    if (tile.isOwned && tile.isGeneral) game.myGeneral = tile

    return tile
}

bot.setPriority_target = (game, target_index) => {
    var settings = bot.settings
    var target = game.targets[target_index]

    if (!target) return

    if (target.tile.isEmpty) target.priority += 1
    if (target.tile.isEnemy) target.priority += 3
    if (target.tile.isCity) target.priority += 2
    if (target.tile.isGeneral) target.priority += 4

    if (target.tile.isObject) {
        target.priority = 0
        return
    }

    if (target.tile.isOwned) {
        target.priority = 0.5
        return
    }

    if (target.tile.army) target.priority += (target.tile.army / 100)
}

bot.parseData = (bot) => {
    var game = bot.game
    game.tiles = []
    game.tiles_sorted = []
    game.targets = []

    game.maze = []
    game.planner = []

    game.myGeneral = null

    for (i = 0; i < game.terrain.length; i++) { 
        game.tiles[i] = bot.newTile(game, i)
    }

    for (i = 0; i < game.tiles.length; i++) { 
        var tile = game.tiles[i]
        var canMove = 0
        if (tile.isObject) canMove = true
        game.maze.push(canMove)
    }

    game.maze = ndarray(game.maze, [game.map_height, game.map_width])
    game.planner = createPlanner(game.maze)

    for (var i = game.tiles.length - 1; i >= 0; i--) {
        if (game.tiles[i].isOwned) continue
        game.targets[i] = bot.newTarget(game, i)
    }

    for (var i = game.targets.length - 1; i >= 0; i--) {
        bot.setPriority_target(game, i)
    }

    game.targets.sort((tile_a, tile_b) => {
        return tile_b.priority - tile_a.priority
    })
}

bot.attackPriority = (bot) => {
    var game = bot.game
    game.tiles_sorted = game.tiles
    game.tiles_sorted.sort((tile_a, tile_b) => {
        return tile_a.army - tile_b.army
    })

    for (var i = game.tiles_sorted.length - 1; i >= 0; i--) {
        var tile = game.tiles_sorted[i]
        var target
        var found_path = []
        var distance = 0

        var end_index = 0
        var path_x = 0
        var path_y = 0

        if (tile.army <= 1 || !tile.isOwned) continue
        var i = 0
        while (distance === 0) {
            target = game.targets[i++]
            distance = game.planner.search(tile.row, tile.col, target.tile.row, target.tile.col, found_path)
        }

        for (var i = 0; i <= found_path.length; i+=2) {
            path_x = found_path[i]
            path_y = found_path[i++]
        }

        if (Math.abs(found_path[0] - found_path[2]) > 1) {
            if (found_path[2] > found_path[0]) {
                found_path[2] = found_path[0] + 1
            } else {
                found_path[2] = found_path[0] - 1
            }
        }
        if (Math.abs(found_path[1] - found_path[3]) > 1) {
            if (found_path[3] > found_path[1]) {
                found_path[3] = found_path[1] + 1
            } else {
                found_path[3] = found_path[1] - 1
            }
        }

        var end_index = found_path[2] * game.map_width + found_path[3]

        console.log('start_index', tile.tile_index, 'end_index', end_index, 'target_index', target.tile.tile_index, 'map_width', game.map_width, target, 'distance', distance)

        if (tile.tile_index === end_index) continue
        if (distance === 0) continue


        bot.attack(tile.tile_index, end_index)
        break
    }
}

bot.gameTick = () => {
    console.time('gameTick')
    bot.parseData(bot)
    bot.attackPriority(bot)
    console.timeEnd("gameTick")
}

bot.newGame = () => {
    bot.playFFA()
    bot.forceStart(null, true)
}

bot.on('connected', () => {
    bot.newGame()
    bot.on('game_start', () => {
        console.log('game_start')
    })
    bot.on('update', () => {
        bot.gameTick()
    })
    bot.on('game_lost', () => {
        bot.leaveGame()
        bot.newGame()
    })
    bot.on('game_won', () => {
        bot.leaveGame()
        bot.newGame()
    })

})
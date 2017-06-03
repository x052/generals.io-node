'use strict';

var fs = require('fs');

function Map(width, height, teams) {
  this.width = width;
  this.height = height;
  if (teams) this.teams = teams;

  this._map = [];
  this._armies = [];
  for (var i = 0; i < this.height; i++) {
    for (var j = 0; j < this.width; j++) {
      this._map.push(Map.TILE_EMPTY);
      this._armies.push(0);
    }
  }
}

Map.prototype.size = function() {
  return this.width * this.height;
};

Map.prototype.indexFrom = function(row, col) {
  return row * this.width + col;
};

// Returns whether index 1 is adjacent to index 2.
Map.prototype.isAdjacent = function(i1, i2) {
  var r1 = Math.floor(i1 / this.width);
  var c1 = Math.floor(i1 % this.width);
  var r2 = Math.floor(i2 / this.width);
  var c2 = Math.floor(i2 % this.width);
  return (
    Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1
  );
};

Map.prototype.isValidTile = function(index) {
  return index >= 0 && index < this._map.length;
};

Map.prototype.tileAt = function(index) {
  return this._map[index];
};

Map.prototype.armyAt = function(index) {
  return this._armies[index];
};

Map.prototype.setTile = function(index, val) {
  this._map[index] = val;
};

Map.prototype.setArmy = function(index, val) {
  this._armies[index] = val;
};

Map.prototype.incrementArmyAt = function(index) {
  this._armies[index]++;
};

// Attacks from start to end. Always leaves 1 unit left at start.
Map.prototype.attack = function(start, end, is50, generals) {
  // Verify that the attack starts from a valid tile.
  if (!this.isValidTile(start)) {
    console.error('Attack has invalid start position ' + start);
    return false;
  }

  // Verify that the attack ends at a valid tile.
  if (!this.isValidTile(end)) {
    console.error('Attack has invalid end position ' + end);
    return false;
  }

  // Verify that the attack goes to an adjacent tile.
  if (!this.isAdjacent(start, end)) {
    console.error('Attack for non-adjacent tiles ' + start + ', ' + end);
    return false;
  }

  // Check if the attack goes to a mountain.
  if (this.tileAt(end) === Map.TILE_MOUNTAIN) {
    return false;
  }

  var reserve = is50 ? Math.ceil(this._armies[start] / 2) : 1;

  // Attacking an Enemy.
  if (!this.teams || this.teams[this.tileAt(start)] !== this.teams[this.tileAt(end)]) {
    // If the army at the start tile is <= 1, the attack fails.
    if (this._armies[start] <= 1) return false;

    if (this.tileAt(end) === this.tileAt(start)) {
      // player -> player
      this._armies[end] += this._armies[start] - reserve;
    } else {
      // player -> enemy
      if (this._armies[end] >= this._armies[start] - reserve) {
        // Non-takeover
        this._armies[end] -= this._armies[start] - reserve;
      } else {
        // Takeover
        this._armies[end] = this._armies[start] - reserve - this._armies[end];
        this.setTile(end, this.tileAt(start));
      }
    }
  }

  // Attacking an Ally.
  else {
    this._armies[end] += this._armies[start] - reserve;
    if (generals.indexOf(end) < 0) {
      // Attacking a non-general allied tile.
      // Steal ownership of the tile.
      this.setTile(end, this.tileAt(start));
    }
  }

  this._armies[start] = reserve;

  return true;
};

// Replaces all tiles of value val1 with val2.
// @param scale Optional. If provided, scales replaced armies down using scale as a multiplier.
Map.prototype.replaceAll = function(val1, val2, scale) {
  scale = scale || 1;
  for (var i = 0; i < this._map.length; i++) {
    if (this._map[i] === val1) {
      this._map[i] = val2;
      this._armies[i] = Math.round(this._armies[i] * scale);
    }
  }
};

// Returns the Manhattan distance between index1 and index2.
Map.prototype.distance = function(index1, index2) {
  var r1 = Math.floor(index1 / this.width);
  var c1 = index1 % this.width;
  var r2 = Math.floor(index2 / this.width);
  var c2 = index2 % this.width;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
};

// Nonnegative numbers represent player indices.
Map.TILE_EMPTY = -1;
Map.TILE_MOUNTAIN = -2;
Map.TILE_FOG = -3;
Map.TILE_FOG_OBSTACLE = -4;
var Constants = {
  MIN_CITY_ARMY: 40,
  RECRUIT_RATE: 2, // 1 recruit per city/general every _ turns.
  FARM_RATE: 50, // 1 recruit per land every _ turns.
}

var DEAD_GENERAL = -1;

// @param teams Optional. Defaults to FFA.
function Game(sockets, teams) {
  if (!sockets) return;
  this.lastAttack = 0;

  this.sockets = sockets;
  this.teams = teams;

  this.turn = 0;
  this.alivePlayers = sockets.length;
  this.leftSockets = [];
  this.inputBuffer = [];
  this.scores = [];
  this.deaths = [];

  for (var i = 0; i < sockets.length; i++) {
    this.inputBuffer.push([]);
    this.scores.push({
      total: 1,
      tiles: 1,
    });
  }
}

Game.prototype.addMountain = function(index) {
  this.map.setTile(index, Map.TILE_MOUNTAIN);
};

Game.prototype.addCity = function(index, army) {
  this.cities.push(index);
  this.map.setArmy(index, army);
};

Game.prototype.addGeneral = function(index) {
  this.generals.push(index);
  this.map.setTile(index, this.generals.length - 1);
  this.map.setArmy(index, 1);
}

Game.createFromReplay = function(gameReplay) {
  var sockets = gameReplay.generals.map(function(g, i) {
    return {
      emit: function() {},
      gio_username: gameReplay.usernames[i],
      gio_stars: gameReplay.stars ? (gameReplay.stars[i] || 0) : '',
    };
  });
  var game = new Game(sockets, gameReplay.teams);

  game.cities = [];
  game.generals = [];

  // Init the game map from the replay.
  game.map = new Map(gameReplay.mapWidth, gameReplay.mapHeight, gameReplay.teams);
  for (var i = 0; i < gameReplay.mountains.length; i++) {
    game.addMountain(gameReplay.mountains[i]);
  }
  for (var i = 0; i < gameReplay.cities.length; i++) {
    game.addCity(gameReplay.cities[i], gameReplay.cityArmies[i]);
  }
  for (var i = 0; i < gameReplay.generals.length; i++) {
    game.addGeneral(gameReplay.generals[i]);
  }

  // For replay versions < 6, city regeneration is enabled.
  // City regeneration is when cities "heal" themselves back to 40 after
  // dropping below 40 army.
  if (gameReplay.version < 6) {
    game.city_regen = true;
  }

  return game;
};

// Returns true when the game is over.
Game.prototype.update = function() {
  // Handle buffered attacks.
  for (var sock = 0; sock < this.sockets.length; sock++) {
    // Flip priorities every other turn.
    var i = this.turn % 2 === 0 ? sock : this.sockets.length - 1 - sock;

    while (this.inputBuffer[i].length) {
      var attack = this.inputBuffer[i].splice(0, 1)[0];
      if (this.handleAttack(i, attack[0], attack[1], attack[2], attack[3]) !== false) {
        // This attack wasn't useless.
        break;
      }
    }
  }

  this.turn++;

  // Increment armies at generals and cities.
  if (this.turn % Constants.RECRUIT_RATE === 0) {
    for (var i = 0; i < this.generals.length; i++) {
      this.map.incrementArmyAt(this.generals[i]);
    }
    for (var i = 0; i < this.cities.length; i++) {
      // Increment owned cities + unowned cities below the min threshold if city_regen is enabled.
      if (this.map.tileAt(this.cities[i]) >= 0 ||
        (this.city_regen && this.map.armyAt(this.cities[i]) < Constants.MIN_CITY_ARMY)) {
        this.map.incrementArmyAt(this.cities[i]);
      }
    }
  }

  // Give farm to all owned tiles for all players.
  if (this.turn % Constants.FARM_RATE === 0) {
    var size = this.map.size();
    for (var i = 0; i < size; i++) {
      if (this.map.tileAt(i) >= 0) {
        this.map.incrementArmyAt(i);
      }
    }
  }

  this.recalculateScores();
};

// Returns true if the game is over.
Game.prototype.isOver = function() {
  // Game with no teams - ends when one player is left.
  if (!this.teams && this.alivePlayers === 1) {
    return true;
  }
  // Game with teams - ends when everyone left alive is on the same team.
  else if (this.teams) {
    var winningTeam = undefined;
    for (var i = 0; i < this.generals.length; i++) {
      if (this.deaths.indexOf(this.sockets[i]) < 0) {
        // Player is alive!
        if (winningTeam === undefined) {
          winningTeam = this.teams[i];
        } else if (this.teams[i] !== winningTeam) {
          return;
        }
      }
    }
    return true;
  }
};

Game.prototype.recalculateScores = function() {
  // Recalculate scores (totals, tiles).
  for (var i = 0; i < this.sockets.length; i++) {
    this.scores[i].i = i;
    this.scores[i].total = 0;
    this.scores[i].tiles = 0;
    this.scores[i].dead = (this.deaths.indexOf(this.sockets[i]) >= 0);
  }
  for (var i = 0; i < this.map.size(); i++) {
    var tile = this.map.tileAt(i);
    if (tile >= 0) {
      this.scores[tile].total += this.map.armyAt(i);
      this.scores[tile].tiles++;
    }
  }
  var self = this;
  this.scores.sort(function(a, b) {
    if (a.dead && !b.dead) return 1;
    if (b.dead && !a.dead) return -1;
    if (a.dead && b.dead) {
      return self.deaths.indexOf(self.sockets[b.i]) - self.deaths.indexOf(self.sockets[a.i]);
    }
    if (b.total === a.total)
      return b.tiles - a.tiles;
    return b.total - a.total;
  });
};

Game.prototype.indexOfSocketID = function(socket_id) {
  var index = -1;
  for (var i = 0; i < this.sockets.length; i++) {
    if (this.sockets[i].id == socket_id) {
      index = i;
      break;
    }
  }
  return index;
};

// Returns false if the attack was useless, i.e. had no effect or failed.
Game.prototype.handleAttack = function(index, start, end, is50, attackIndex) {
  // Verify that the attack starts from an owned tile.
  if (this.map.tileAt(start) !== index) {
    return false;
  }

  // Store the value of the end tile pre-attack.
  var endTile = this.map.tileAt(end);

  // Handle the attack.
  var succeeded = this.map.attack(start, end, is50, this.generals);
  if (!succeeded) {
    return false;
  }

  // Check if this attack toppled a general.
  var newEndTile = this.map.tileAt(end);

  if (newEndTile !== endTile) this.lastAttack = this.turn + 1

  var generalIndex = this.generals.indexOf(end);
  if (newEndTile !== endTile && generalIndex >= 0) {
    // General captured! Give the capturer command of the captured's army.
    this.map.replaceAll(endTile, newEndTile, 0.5);

    // Only count as a death if this player has not died before (i.e. rage quitting)
    var deadSocket = this.sockets[endTile];
    if (this.deaths.indexOf(deadSocket) < 0) {
      this.deaths.push(deadSocket);
      this.alivePlayers--;
      deadSocket.emit('game_lost', {
        killer: newEndTile,
      });
    }

    // Turn the general into a city.
    this.cities.push(end);
    this.generals[generalIndex] = DEAD_GENERAL;
  }
};

// Returns the index of an alive teammate of the given player, if any.
Game.prototype.aliveTeammate = function(index) {
  if (this.teams) {
    for (var i = 0; i < this.sockets.length; i++) {
      if (this.teams[i] === this.teams[index] && this.deaths.indexOf(this.sockets[i]) < 0) {
        return i;
      }
    }
  }
};

// If the player hasn't been captured yet, either gives their land to a teammate
// or turns it gray (neutral).
Game.prototype.tryNeutralizePlayer = function(playerIndex) {
  var deadGeneralIndex = this.generals[playerIndex];
  this.generals[playerIndex] = DEAD_GENERAL;

  // Check if the player has an alive teammate who can take their land.
  var aliveTeammateIndex = this.aliveTeammate(playerIndex);
  var newIndex = Number.isInteger(aliveTeammateIndex) ? aliveTeammateIndex : Map.TILE_EMPTY;

  // Check if the player hasn't been captured yet.
  if (this.map.tileAt(deadGeneralIndex) === playerIndex) {
    this.map.replaceAll(playerIndex, newIndex);
    this.cities.push(deadGeneralIndex);
  }
};

module.exports = function(replay, callback) {

  // Create a game from the replay.
  var game = Game.createFromReplay(replay);

  var currentMoveIndex = 0;
  var currentAFKIndex = 0;

  // Simulates the next turn.
  function nextTurn() {
    // Put moves in the move queue.
    while (replay.moves.length > currentMoveIndex && replay.moves[currentMoveIndex].turn <= game.turn) {
      var move = replay.moves[currentMoveIndex++];
      game.handleAttack(move.index, move.start, move.end, move.is50);
    }

    // Check for AFKs.
    while (replay.afks.length > currentAFKIndex && replay.afks[currentAFKIndex].turn <= game.turn) {
      var afk = replay.afks[currentAFKIndex++];
      var index = afk.index;

      // If already dead, mark as dead general and neutralize if needed.
      if (game.deaths.indexOf(game.sockets[index]) >= 0) {
        game.tryNeutralizePlayer(index);
      }
      // Mark as AFK if not already dead.
      else {
        game.deaths.push(game.sockets[index]);
        game.alivePlayers--;
      }
    }

    game.update();
  }

  // Simulate the game!
  while (!game.isOver()) {
    nextTurn();
    console.log(
      'Simulated turn ' + game.turn + '. ' + game.alivePlayers + ' players left alive. ' +
      'Leader has ' + game.scores[0].total + ' army.'
    );

    // Do whatever you want with the current game state. Some useful fields are:
    // game.turn: The current turn.
    // game.sockets: The array of players. Player game.sockets[i] has playerIndex i.
    // game.map: A Map object representing the current game state. See Map.js.
    // game.scores: An ordered (decreasing) array of scores. Each score object can be tied to a player by its .i field.
    // game.alivePlayers: The number of players left alive.
    // game.deaths: Dead players in chronological order: game.deaths[0] is the first player to die.
    callback(game)
  }
}
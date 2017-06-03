const Replay = require('./downloader')
const Colours = require('./colours')

const GIFEncoder = require('gifencoder')
const Canvas = require('canvas')
const Image = Canvas.Image
const fs = require('fs')

const tileSize = 20

var encoder
var canvas
var ctx

const tiles = {
  'king': fs.readFileSync('./img/' + 'king' + '.png'),
  'mountain': fs.readFileSync('./img/' + 'mountain' + '.png'),
  'city': fs.readFileSync('./img/' + 'city' + '.png'),

}

const newReplay = (width, height) => {
  encoder = new GIFEncoder(width, height)
  encoder.createReadStream().pipe(fs.createWriteStream('out.gif'))
  encoder.start()
  encoder.setRepeat(0) // repeat forever
  encoder.setDelay(20) // ms
  encoder.setQuality(1) // lowest quality
  canvas = new Canvas(width, height)
  ctx = canvas.getContext('2d')
}

const drawTile = (type, x, y) => {
  tile = tiles[type]
  img = new Image
  img.src = tile
  ctx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize)
}

const clearCanvas = (width, height) => {
  ctx.fillStyle = 'rgb(220, 220, 220)'
  ctx.fillRect(0, 0, width, height)
}

const drawGrid = (canvasWidth, canvasHeight) => {
  ctx.beginPath()
  for (var x = 0; x <= canvasWidth; x += tileSize) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvasHeight)
  }

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.beginPath()
  for (var y = 0; y <= canvasHeight; y += tileSize) {
    ctx.moveTo(0, y)
    ctx.lineTo(canvasWidth, y)
  }

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  ctx.stroke()
}

const drawTileTypes = (game) => {
  game.map._map.forEach((tile, index) => {
    let target = game.map.tileAt(index)
    let target_row = Math.floor(index / game.map.width)
    let target_col = index % game.map.width

    if (target >= 0) {
      ctx.beginPath()
      ctx.rect(target_col * tileSize, target_row * tileSize, tileSize - 1, tileSize - 1)
      ctx.fillStyle = Colours[target]
      ctx.fill()
    }

    if (target === -2) {
      ctx.beginPath()
      ctx.rect(target_col * tileSize, target_row * tileSize, tileSize - 1, tileSize - 1)
      ctx.fillStyle = "#bbb"
      ctx.fill()

      ctx.fillStyle = "black"
      return drawTile('mountain', target_col, target_row)
    }
    if (game.cities.indexOf(index) >= 0) {
      ctx.beginPath()
      ctx.rect(target_col * tileSize, target_row * tileSize, tileSize - 1, tileSize - 1)
      if (target <= -1) {
        ctx.fillStyle = "gray"
      } else {
        ctx.fillStyle = Colours[target]
      }
      ctx.fill()

      ctx.fillStyle = "black"
      drawTile('city', target_col, target_row)
    }
    if (game.generals.indexOf(index) > 0) {
      ctx.fillStyle = "black"
      drawTile('king', target_col, target_row)
    }

    if (game.map._armies[index] > 0) {
      ctx.fillStyle = "white"
      ctx.font = "14px verdana"

      let fontSize = 14
      var width = ctx.measureText(game.map._armies[index]).width
      while (width > (tileSize / 2)) {
        fontSize -= 0.1
        ctx.font = fontSize + "px verdana"
        width = ctx.measureText(game.map._armies[index]).width
      }

      ctx.fillText(game.map._armies[index], (target_col * tileSize) + (tileSize / 4), (target_row * tileSize) + (tileSize))
    }

  })
}

const drawGameState = (game) => {
  let canvasWidth = game.map.width * tileSize
  let canvasHeight = game.map.height * tileSize

  if (game.turn === 1) {
  newReplay(canvasWidth, canvasHeight)
  }
  if (game.lastAttack !== game.turn) return

  clearCanvas(canvasWidth, canvasHeight)
  drawGrid(canvasWidth, canvasHeight)
  drawTileTypes(game)
  encoder.addFrame(ctx)

  if (game.alivePlayers === 1 || game.turn > 50) {
    encoder.finish()
  }
}

Replay('rOx9ZeuRx', drawGameState)
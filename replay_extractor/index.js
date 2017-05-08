const replayFolder = './replays_prod/'
const fs = require('fs')
const LZString = require('lz-string')

var storage = {}
var files = fs.readdirSync(replayFolder)

files.forEach((filename) => {
	var input = JSON.parse(fs.readFileSync(replayFolder + filename).toString())
	for (key in input) {
		if (key === 'id' || key === 'teams' || key === "afks" || key === 'generals') continue
		var item = input[key]
		if (!storage[key]) storage[key] = []
		if (key === 'moves') {
			if (item.length === 0) continue
			storage.moves.push(Math.floor(item[item.length - 1].turn / 2))
			continue
		}
		if (!isNaN(item)) {
			storage[key].push(item)
		} else if (item instanceof Array) {
			if (key === 'stars' || key === 'cityArmies') {
				for (var i = item.length - 1; i >= 0; i--) {
					storage[key].push(item[i])
				}
				continue
			}
			storage[key].push(item.length)
		}
	}
})

const average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length
const median = arr => arr.sort(function(a,b){return a - b;})
const range = arr => arr.sort(function(a,b){return a - b;})

for (key in storage) {
	console.log('average', key, average(storage[key]).toFixed(3))
	var med = median(storage[key])
	med = med[Math.floor(med.length / 2)]
	console.log('median', key, med.toFixed(3))
	var rag = range(storage[key])
	rag = rag[rag.length - 1] - rag[0]
	console.log('range', key, rag)
}
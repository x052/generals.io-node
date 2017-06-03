const converter = require('./converter')
const simulator = require('./simulator')

const request = function(url, options) {
    return new Promise((resolve, reject) => {
        require('request')(url, options || null, (error, response, body) => {
            if (error) return reject(error)
            resolve([response, body])
        })
    })
}

const downloadReplayAndGiveBackAGameState = async function(replay_id, callback) {
    let [req, output] = await request('https://generalsio-replays-na.s3.amazonaws.com/' + replay_id + '.gior', {
        encoding: null
    })
    
    let replay = converter(output)
    simulator(replay, callback)
}

module.exports = downloadReplayAndGiveBackAGameState
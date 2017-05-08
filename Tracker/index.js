const fs = require('fs')
const app = require('express')()
const request = require('request')

const serverConfig = require('./config.json')

const getServer = (req) => {
    if (!serverConfig.subDomains[req.params['serverName']]) return false
    var serverName = req.params['serverName']
    if (serverName === 'na') {
        serverName = ''
    } else {
        serverName += '.'
    }
    return 'http://' + serverName + serverConfig.apiDomain
}

const getServer_two = (req) => {
    var server_path = req.originalUrl
    server_path = 'api' + server_path.replace(/\/(.*)\/api/, '')
    return server_path
}

const htmlHeader = (req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.header('Pragma', 'no-cache')
    res.header('Expires', 0)
    res.set('content-type','text/html')
    if (!serverConfig.subDomains[req.params['serverName']] && req.originalUrl != '/' && req.originalUrl != '/config') {
        res.end('Invalid server')
        return
    }
    next()
}

app.get('/', htmlHeader, (req, res) => {
    res.send(fs.readFileSync("./view/index.html"))
})

app.get('/config', htmlHeader, (req, res) => {
    res.json(serverConfig)
})

app.get('/:serverName/profiles/*', htmlHeader, (req, res) => {
	res.send(fs.readFileSync('./view/profile.html'))
})

app.get('/:serverName/replays/*', htmlHeader, (req, res) => {
    res.send(fs.readFileSync('./view/replay.html'))
})

app.get('/:serverName/r-profiles/*', htmlHeader, (req, res) => {
    res.writeHead(302, {'Location': getServer(req) + 'profiles/' + req.url.replace(/.*\//, '')})
    res.end()
})

app.get('/:serverName/r-replays/*', htmlHeader, (req, res) => {
    res.writeHead(302, {'Location': getServer(req) + 'replays/' + req.url.replace(/.*\//, '')})
    res.end()
})

app.get('/:serverName', htmlHeader, (req, res) => {
    res.send(fs.readFileSync("./view/server_index.html"))
})

app.get('/:serverName/:replayID.gior', (req, res) => {
    request(getServer(req) + req.params.replayID + '.gior', {encoding: null}, function (error, response, body) {
        res.send(body)
    })
})

app.get('/:serverName/api/:apiQuery', (req, res) => {
    request(getServer(req) + getServer_two(req), function (error, response, body) {
        res.send(body)
    })
})

app.get('/:serverName/config', htmlHeader, (req, res) => {
    res.json(serverConfig.subDomains[req.params['serverName']])
})

app.listen(8080)
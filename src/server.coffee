express = require('express')
http = require('http')

simpleDriver = require('./simple.js')


druidPost = ({host, port, path}) -> (druidQuery, callback) ->
  opts = {
    host
    port
    path
    method: 'POST'
    headers: {
      'content-type': 'application/json'
    }
  }
  req = http.request(opts, (response) ->
    # response.statusCode
    # response.headers
    # response.statusCode

    response.setEncoding('utf8')
    chunks = []
    response.on 'data', (chunk) ->
      chunks.push(chunk)
      return

    response.on 'close', (err) ->
      console.log 'CLOSE'
      return

    response.on 'end', ->
      chunks = chunks.join('')
      if response.statusCode isnt 200
        callback(chunks, null)
        return

      try
        chunks = JSON.parse(chunks)
      catch e
        callback(e, null)
        return

      callback(null, chunks)
      return
    return
  )

  req.write(JSON.stringify(druidQuery))
  req.end()
  return


data = {}
data.data1 = do ->
  pick = (arr) -> arr[Math.floor(Math.random() * arr.length)]
  now = Date.now()
  w = 100
  ret = []
  for i in [0...400]
    ret.push {
      id: i
      time: new Date(now + i * 13 * 1000)
      letter: 'ABC'[Math.floor(3 * i / 400)]
      number: pick([1, 10, 3, 4])
      scoreA: i * Math.random() * Math.random()
      scoreB: 10 * Math.random()
      walk: w += Math.random() - 0.5 + 0.02
    }
  return ret


app = express()

app.disable('x-powered-by')

app.use(express.compress())
app.use(express.json())

app.use(express.static(__dirname + '/../static'))
app.use(express.static(__dirname + '/../target'))

app.get '/', (req, res) ->
  res.send('Welcome to facet')
  return

# Simple
app.post '/driver/simple', (req, res) ->
  { context, query } = req.body
  simpleDriver(data[context.data])(query, (err, result) ->
    if err
      res.json(500, err)
      return

    res.json(result)
  )
  return

# SQL
app.post '/pass/sql', (req, res) ->

  return

app.post '/driver/sql', (req, res) ->

  return

# Druid
druidPass = druidPost({
  host: '10.60.134.138'
  port: 8080
  path: '/druid/v2/'
})
app.post '/pass/druid', (req, res) ->
  { context, query } = req.body
  druidPass(query, (err, result) ->
    if err
      res.json(500, err)
      return

    res.json(result)
  )
  return

app.post '/driver/druid', (req, res) ->

  return








app.listen(9876)
console.log('Listening on port 9876')

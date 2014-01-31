chai = require("chai")
expect = chai.expect

exec = require('child_process').exec
async = require('async')
zookeeper = require('node-zookeeper-client')
CreateMode = zookeeper.CreateMode

zookeeperLocator = require('../../src/locator/zookeeperLocator')({
  servers: 'localhost:2181/discovery'
})

zkClient = zookeeper.createClient(
  'localhost:2181',
  {
    sessionTimeout: 10000
    spinDelay : 1000
    retries : 0
  }
)

rmStar = (path, callback) ->
  zkClient.getChildren(path, (err, children) ->
    if err
      if err.getCode() is zookeeper.Exception.NO_NODE
        callback(null)
      else
        callback(err)
      return

    async.map(
      children
      (child, callback) -> zkClient.remove(path + '/' + child, callback)
      (err) -> callback(err)
    )
    return
  )

createNode = (node, guid, obj, callback) ->
  zkClient.mkdirp(
    "/discovery/#{node}/#{guid}"
    new Buffer(JSON.stringify(obj))
    (error, path) ->
      if error
        console.log(error.stack)
        callback(error)
        return

      callback(null)
      return
  )
  return

removeNode = (node, guid, callback) ->
  zkClient.remove("/discovery/#{node}/#{guid}", callback)
  return

zkClient.connect()

# setInterval((->
#   console.log 'State:', zkClient.getState()
# ), 1000)

getPool = (locator, callback) ->
  locations = []
  done = false
  async.whilst(
    -> not done
    (callback) ->
      locator (err, location) ->
        if err
          done = true
          callback()
          return

        locationStr = location.host + ':' + location.port

        if locationStr in locations
          done = true
        else
          locations.push(locationStr)

        callback()
        return
    (err) -> callback(err, locations.sort())
  )

simpleExec = (cmd, done) ->
  exec(cmd, (err, stdout, stderr) ->
    if err
      console.log(cmd)
      console.log('  stdout: ' + stdout)
      console.log('  stderr: ' + stderr)
      console.log('  exec err: ' + err)
    done(err)
  )

describe 'Zookeeper locator', ->
  @timeout 10000
  myServiceLocator = null

  before (done) ->
    async.series([
      (callback) -> simpleExec('zkServer start', callback)
      (callback) -> rmStar('/discovery/my:service', callback)
      (callback) -> createNode('my:service', 'fake-guid-1-1', { address: '10.10.10.10', port: 8080 }, callback)
      (callback) -> createNode('my:service', 'fake-guid-1-2', { address: '10.10.10.20', port: 8080 }, callback)
      (callback) -> createNode('my:service', 'fake-guid-1-3', { address: '10.10.10.30', port: 8080 }, callback)
      (callback) ->
        myServiceLocator = zookeeperLocator('my:service')
        callback()
    ], done)

  after (done) ->
    async.series([
      (callback) -> rmStar('/discovery/my:service', callback)
      (callback) -> simpleExec('zkServer stop', callback)
    ], done)

  it "is memoized by path", ->
    expect(myServiceLocator).to.equal(zookeeperLocator('/my:service'))

  it "fails on fake service", (done) ->
    myFakeServiceLocator = zookeeperLocator('my:fake:service')
    myFakeServiceLocator (err, location) ->
      expect(err).to.exist
      done()

  it "correct init run", (done) ->
    getPool myServiceLocator, (err, locations) ->
      expect(err).to.not.exist
      expect(locations).to.deep.equal([
        '10.10.10.10:8080'
        '10.10.10.20:8080'
        '10.10.10.30:8080'
      ])
      done()

  it "works after removing a node", (done) ->
    async.series([
      (callback) -> removeNode('my:service', 'fake-guid-1-1', callback)
      (callback) -> setTimeout(callback, 100) # delay a little bit
    ], (err) ->
      expect(err).to.not.exist
      getPool myServiceLocator, (err, locations) ->
        expect(err).to.not.exist
        expect(locations).to.deep.equal([
          '10.10.10.20:8080'
          '10.10.10.30:8080'
        ])
        done()
    )

  it "works after adding a node", (done) ->
    async.series([
      (callback) -> createNode('my:service', 'fake-guid-1-4', { address: '10.10.10.40', port: 8080 }, callback)
      (callback) -> setTimeout(callback, 100) # delay a little bit
    ], (err) ->
      expect(err).to.not.exist
      getPool myServiceLocator, (err, locations) ->
        expect(err).to.not.exist
        expect(locations).to.deep.equal([
          '10.10.10.20:8080'
          '10.10.10.30:8080'
          '10.10.10.40:8080'
        ])
        done()
    )

  it "works after removing the remaining nodes", (done) ->
    async.series([
      (callback) -> removeNode('my:service', 'fake-guid-1-2', callback)
      (callback) -> removeNode('my:service', 'fake-guid-1-3', callback)
      (callback) -> removeNode('my:service', 'fake-guid-1-4', callback)
      (callback) -> setTimeout(callback, 100) # delay a little bit
    ], (err) ->
      myServiceLocator (err, location) ->
        expect(err).to.exist
        done()
    )

  it "works after adding nodes to an empty pool", (done) ->
    async.series([
      (callback) -> createNode('my:service', 'fake-guid-1-5', { address: '10.10.10.50', port: 8080 }, callback)
      (callback) -> createNode('my:service', 'fake-guid-1-6', { address: '10.10.10.60', port: 8080 }, callback)
      (callback) -> setTimeout(callback, 100) # delay a little bit
    ], (err) ->
      expect(err).to.not.exist
      getPool myServiceLocator, (err, locations) ->
        expect(err).to.not.exist
        expect(locations).to.deep.equal([
          '10.10.10.50:8080'
          '10.10.10.60:8080'
        ])
        done()
    )

  it "works after ZK disconnects serving the remainder from cache", (done) ->
    async.series([
      (callback) -> simpleExec('zkServer stop', callback)
      (callback) -> setTimeout(callback, 100) # delay a little bit
    ], (err) ->
      expect(err).to.not.exist
      getPool myServiceLocator, (err, locations) ->
        expect(err).to.not.exist
        expect(locations).to.deep.equal([
          '10.10.10.50:8080'
          '10.10.10.60:8080'
        ])
        done()
    )

  it "reconnects when ZK comes back online", (done) ->
    async.series([
      (callback) -> simpleExec('zkServer start', callback)
      (callback) -> createNode('my:service', 'fake-guid-1-7', { address: '10.10.10.70', port: 8080 }, callback)
      (callback) -> setTimeout(callback, 100) # delay a little bit
    ], (err) ->
      expect(err).to.not.exist
      getPool myServiceLocator, (err, locations) ->
        expect(err).to.not.exist
        expect(locations).to.deep.equal([
          '10.10.10.50:8080'
          '10.10.10.60:8080'
          '10.10.10.70:8080'
        ])
        done()
    )







// Generated by CoffeeScript 1.3.1
(function() {
  var app, data, express, simpleDriver;

  express = require('express');

  simpleDriver = require('./simple.js');

  data = {};

  data.data1 = (function() {
    var i, now, pick, ret, w, _i;
    pick = function(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    };
    now = Date.now();
    w = 100;
    ret = [];
    for (i = _i = 0; _i < 400; i = ++_i) {
      ret.push({
        id: i,
        time: new Date(now + i * 13 * 1000),
        letter: 'ABC'[Math.floor(3 * i / 400)],
        number: pick([1, 10, 3, 4]),
        scoreA: i * Math.random() * Math.random(),
        scoreB: 10 * Math.random(),
        walk: w += Math.random() - 0.5 + 0.02
      });
    }
    return ret;
  })();

  app = express();

  app.disable('x-powered-by');

  app.use(express.compress());

  app.use(express.json());

  app.use(express["static"](__dirname + '/../static'));

  app.use(express["static"](__dirname + '/../target'));

  app.get('/', function(req, res) {
    return res.send('Welcome to facet');
  });

  app.post('/driver/simple', function(req, res) {
    var context, query, _ref;
    _ref = req.body, context = _ref.context, query = _ref.query;
    simpleDriver(data[context.data])(query, function(err, result) {
      if (err) {
        res.json(500, err);
        return;
      }
      return res.json(result);
    });
  });

  app.post('/driver/sql', function(req, res) {});

  app.post('/driver/druid', function(req, res) {});

  app.post('/pass/sql', function(req, res) {});

  app.post('/pass/druid', function(req, res) {});

  app.listen(9876);

  console.log('Listening on port 9876');

}).call(this);

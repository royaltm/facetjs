// Generated by CoffeeScript 1.3.1
var async, uniformizeResults;

async = require('async');

uniformizeResults = function(result) {
  var name, prop, ret, value, _ref;
  if (!(result != null ? result.prop : void 0)) {
    return result;
  }
  prop = {};
  _ref = result.prop;
  for (name in _ref) {
    value = _ref[name];
    if (!result.prop.hasOwnProperty(name)) {
      continue;
    }
    if (typeof value === 'number' && value !== Math.floor(value)) {
      prop[name] = value.toFixed(3);
    } else if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number' && (value[0] !== Math.floor(value[0]) || value[1] !== Math.floor(value[1]))) {
      prop[name] = [value[0].toFixed(3), value[1].toFixed(3)];
    } else {
      prop[name] = value;
    }
  }
  ret = {
    prop: prop
  };
  if (result.splits) {
    ret.splits = result.splits.map(uniformizeResults);
  }
  return ret;
};

exports.makeDriverTest = function(driverFns) {
  return function(_arg) {
    var drivers, query;
    drivers = _arg.drivers, query = _arg.query;
    return function(test) {
      var driversToTest;
      if (drivers.length < 2) {
        throw new Error("must have at least two drivers");
      }
      test.expect(drivers.length);
      driversToTest = drivers.map(function(driverName) {
        var driverFn;
        driverFn = driverFns[driverName];
        if (!driverFn) {
          throw new Error("no such driver " + driverName);
        }
        return function(callback) {
          driverFn(query, callback);
        };
      });
      return async.parallel(driversToTest, function(err, results) {
        var i;
        test.ifError(err);
        results = results.map(uniformizeResults);
        i = 1;
        while (i < drivers.length) {
          test.deepEqual(results[0], results[i], "results of '" + drivers[0] + "' and '" + drivers[i] + "' do not match");
          i++;
        }
        test.done();
      });
    };
  };
};

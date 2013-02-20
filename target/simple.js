// Generated by CoffeeScript 1.3.1
(function() {
  var applyFns, ascending, descending, flatten, simple, simpleDriver, sortFns, splitFns;

  flatten = function(ar) {
    return Array.prototype.concat.apply([], ar);
  };

  splitFns = {
    natural: function(_arg) {
      var attribute;
      attribute = _arg.attribute;
      return function(d) {
        return d[attribute];
      };
    },
    even: function(_arg) {
      var attribute, offset, size;
      attribute = _arg.attribute, size = _arg.size, offset = _arg.offset;
      return function(d) {
        var b;
        b = Math.floor((d[attribute] + offset) / size) * size;
        return [b, b + size];
      };
    },
    time: function(_arg) {
      var attribute, duration;
      attribute = _arg.attribute, duration = _arg.duration;
      switch (duration) {
        case 'second':
          return function(d) {
            var de, ds;
            ds = new Date(d[attribute]);
            ds.setUTCMilliseconds(0);
            de = new Date(ds);
            de.setUTCMilliseconds(1000);
            return [ds, de];
          };
        case 'minute':
          return function(d) {
            var de, ds;
            ds = new Date(d[attribute]);
            ds.setUTCSeconds(0, 0);
            de = new Date(ds);
            de.setUTCSeconds(60);
            return [ds, de];
          };
        case 'hour':
          return function(d) {
            var de, ds;
            ds = new Date(d[attribute]);
            ds.setUTCMinutes(0, 0, 0);
            de = new Date(ds);
            de.setUTCMinutes(60);
            return [ds, de];
          };
        case 'day':
          return function(d) {
            var de, ds;
            ds = new Date(d[attribute]);
            ds.setUTCHours(0, 0, 0, 0);
            de = new Date(ds);
            de.setUTCHours(24);
            return [ds, de];
          };
      }
    }
  };

  applyFns = {
    count: function() {
      return function(ds) {
        return ds.length;
      };
    },
    sum: function(_arg) {
      var attribute;
      attribute = _arg.attribute;
      return function(ds) {
        var d, sum, _i, _len;
        sum = 0;
        for (_i = 0, _len = ds.length; _i < _len; _i++) {
          d = ds[_i];
          sum += d[attribute];
        }
        return sum;
      };
    },
    average: function(_arg) {
      var attribute;
      attribute = _arg.attribute;
      return function(ds) {
        var d, sum, _i, _len;
        sum = 0;
        for (_i = 0, _len = ds.length; _i < _len; _i++) {
          d = ds[_i];
          sum += d[attribute];
        }
        return sum / ds.length;
      };
    },
    min: function(_arg) {
      var attribute;
      attribute = _arg.attribute;
      return function(ds) {
        var d, min, _i, _len;
        min = +Infinity;
        for (_i = 0, _len = ds.length; _i < _len; _i++) {
          d = ds[_i];
          min = Math.min(min, d[attribute]);
        }
        return min;
      };
    },
    max: function(_arg) {
      var attribute;
      attribute = _arg.attribute;
      return function(ds) {
        var d, max, _i, _len;
        max = -Infinity;
        for (_i = 0, _len = ds.length; _i < _len; _i++) {
          d = ds[_i];
          max = Math.max(max, d[attribute]);
        }
        return max;
      };
    },
    unique: function(_arg) {
      var attribute;
      attribute = _arg.attribute;
      return function(ds) {
        var count, d, seen, v, _i, _len;
        seen = {};
        count = 0;
        for (_i = 0, _len = ds.length; _i < _len; _i++) {
          d = ds[_i];
          v = d[attribute];
          if (!seen[v]) {
            count++;
            seen[v] = 1;
          }
        }
        return count;
      };
    }
  };

  ascending = function(a, b) {
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    } else if (a >= b) {
      return 0;
    } else {
      return NaN;
    }
  };

  descending = function(a, b) {
    if (b < a) {
      return -1;
    } else if (b > a) {
      return 1;
    } else if (b >= a) {
      return 0;
    } else {
      return NaN;
    }
  };

  sortFns = {
    natural: function(_arg) {
      var cmpFn, direction, prop;
      prop = _arg.prop, direction = _arg.direction;
      direction = direction.toUpperCase();
      if (!(direction === 'ASC' || direction === 'DESC')) {
        throw "direction has to be 'ASC' or 'DESC'";
      }
      cmpFn = direction === 'ASC' ? ascending : descending;
      return function(a, b) {
        return cmpFn(a.prop[prop], b.prop[prop]);
      };
    },
    caseInsensetive: function(_arg) {
      var cmpFn, direction, prop;
      prop = _arg.prop, direction = _arg.direction;
      direction = direction.toUpperCase();
      if (!(direction === 'ASC' || direction === 'DESC')) {
        throw "direction has to be 'ASC' or 'DESC'";
      }
      cmpFn = direction === 'ASC' ? ascending : descending;
      return function(a, b) {
        return cmpFn(String(a.prop[prop]).toLowerCase(), String(b.prop[prop]).toLowerCase());
      };
    }
  };

  simpleDriver = function(data, query) {
    var applyFn, cmd, propName, rootSegment, segment, segmentGroup, segmentGroups, sortFn, splitFn, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _len7, _m, _n, _o, _p;
    rootSegment = {
      _raw: data,
      prop: {}
    };
    segmentGroups = [[rootSegment]];
    for (_i = 0, _len = query.length; _i < _len; _i++) {
      cmd = query[_i];
      switch (cmd.operation) {
        case 'split':
          propName = cmd.prop;
          if (!propName) {
            throw new Error("'prop' not defined in apply");
          }
          splitFn = splitFns[cmd.bucket](cmd);
          if (!splitFn) {
            throw new Error("No such bucket `" + cmd.bucket + "` in split");
          }
          segmentGroups = flatten(segmentGroups).map(function(segment) {
            var bucketValue, buckets, d, key, keys, _j, _len1, _ref;
            keys = [];
            buckets = {};
            bucketValue = {};
            _ref = segment._raw;
            for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
              d = _ref[_j];
              key = splitFn(d);
              if (key == null) {
                throw new Error("Bucket returned undefined");
              }
              if (!buckets[key]) {
                keys.push(key);
                buckets[key] = [];
                bucketValue[key] = key;
              }
              buckets[key].push(d);
            }
            segment.splits = keys.map(function(key) {
              var prop;
              prop = {};
              prop[propName] = bucketValue[key];
              return {
                _raw: buckets[key],
                prop: prop
              };
            });
            delete segment._raw;
            return segment.splits;
          });
          break;
        case 'apply':
          propName = cmd.prop;
          if (!propName) {
            throw new Error("'prop' not defined in apply");
          }
          applyFn = applyFns[cmd.aggregate](cmd);
          if (!applyFn) {
            throw new Error("No such aggregate `" + cmd.aggregate + "` in apply");
          }
          for (_j = 0, _len1 = segmentGroups.length; _j < _len1; _j++) {
            segmentGroup = segmentGroups[_j];
            for (_k = 0, _len2 = segmentGroup.length; _k < _len2; _k++) {
              segment = segmentGroup[_k];
              segment.prop[propName] = applyFn(segment._raw);
            }
          }
          break;
        case 'combine':
          if (cmd.sort) {
            for (_l = 0, _len3 = segmentGroups.length; _l < _len3; _l++) {
              segmentGroup = segmentGroups[_l];
              sortFn = sortFns[cmd.sort.compare](cmd.sort);
              if (!sortFn) {
                throw new Error("No such compare `" + cmd.sort.compare + "` in combine.sort");
              }
              for (_m = 0, _len4 = segmentGroups.length; _m < _len4; _m++) {
                segmentGroup = segmentGroups[_m];
                segmentGroup.sort(sortFn);
              }
            }
          }
          if (cmd.limit != null) {
            for (_n = 0, _len5 = segmentGroups.length; _n < _len5; _n++) {
              segmentGroup = segmentGroups[_n];
              segmentGroup.splice(limit, segmentGroup.length - limit);
            }
          }
          break;
        default:
          throw new Error("Unknown operation '" + cmd.operation + "'");
      }
    }
    for (_o = 0, _len6 = segmentGroups.length; _o < _len6; _o++) {
      segmentGroup = segmentGroups[_o];
      for (_p = 0, _len7 = segmentGroup.length; _p < _len7; _p++) {
        segment = segmentGroup[_p];
        delete segment._raw;
      }
    }
    return rootSegment;
  };

  simple = function(data) {
    return function(query, callback) {
      var result;
      if (callback == null) {
        callback = function() {};
      }
      try {
        result = simpleDriver(data, query);
      } catch (e) {
        callback(e, null);
        return;
      }
      callback(null, result);
    };
  };

  if ((typeof facet !== "undefined" && facet !== null ? facet.driver : void 0) != null) {
    facet.driver.simple = simple;
  }

  if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
    module.exports = simple;
  }

}).call(this);

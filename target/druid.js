// Generated by CoffeeScript 1.3.1
(function() {
  var applyToAggregation, druid;

  applyToAggregation = function(segment, _arg) {
    var aggregate, attribute, prop, _query;
    prop = _arg.prop, aggregate = _arg.aggregate, attribute = _arg.attribute;
    _query = segment._query;
    _query.aggregations || (_query.aggregations = []);
    switch (aggregate) {
      case 'count':
        segment._sumProp = prop;
        return _query.aggregations.push({
          type: "doubleSum",
          name: prop,
          fieldName: 'count'
        });
      case 'sum':
        return _query.aggregations.push({
          type: "doubleSum",
          name: prop,
          fieldName: attribute
        });
      case 'average':
        return _query.aggregations.push({
          type: "doubleSum",
          name: prop,
          fieldName: attribute
        });
      case 'unique':
        throw 'todo';
        break;
    }
  };

  druid = function(_arg) {
    var dataSource, end, filters, requester, start;
    dataSource = _arg.dataSource, start = _arg.start, end = _arg.end, filters = _arg.filters, requester = _arg.requester;
    return function(query, callback) {
      var aggregate, attribute, cmd, intervals, prop, queryIfNeeded, rootSegment, segment, segments, _i, _j, _len, _len1;
      start = start.toISOString().replace('Z', '');
      end = end.toISOString().replace('Z', '');
      intervals = ["" + start + "/" + end];
      rootSegment = {
        _query: {
          dataSource: dataSource,
          intervals: intervals,
          queryType: "timeseries",
          granularity: "all"
        },
        prop: {}
      };
      segments = [rootSegment];
      queryIfNeeded = function() {
        return segments.forEach(function(segment) {
          if (!segment._query.aggregations) {
            return;
          }
        });
      };
      for (_i = 0, _len = query.length; _i < _len; _i++) {
        cmd = query[_i];
        switch (cmd.operation) {
          case 'split':
            queryIfNeeded();
            break;
          case 'apply':
            prop = cmd.prop, aggregate = cmd.aggregate, attribute = cmd.attribute;
            for (_j = 0, _len1 = segments.length; _j < _len1; _j++) {
              segment = segments[_j];
              applyToAggregation(segment, cmd);
            }
            break;
          case 'combine':
            null;

            break;
          default:
            throw new Error("Unknown operation '" + cmd.operation + "'");
        }
      }
      queryIfNeeded();
      return requester(initQuery, function(err, res) {
        return console.log(err, res);
      });
    };
  };

  if ((typeof facet !== "undefined" && facet !== null ? facet.driver : void 0) != null) {
    facet.driver.druid = druid;
  }

  if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
    module.exports = druid;
  }

}).call(this);
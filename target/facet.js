(function() {
  var FacetJob, Segment, arraySubclass, boxPosition, divideLength, facet, flatten, getCousinSegments, getProp, stripeTile,
    __slice = [].slice;

  arraySubclass = [].__proto__ ? function(array, prototype) {
    array.__proto__ = prototype;
    return array;
  } : function(array, prototype) {
    var property, _i, _len;
    for (_i = 0, _len = prototype.length; _i < _len; _i++) {
      property = prototype[_i];
      array[property] = prototype[property];
    }
    return array;
  };

  flatten = function(ar) {
    return Array.prototype.concat.apply([], ar);
  };

  Segment = (function() {

    function Segment(_arg) {
      var stage;
      this.parent = _arg.parent, this.node = _arg.node, stage = _arg.stage, this.prop = _arg.prop, this.splits = _arg.splits;
      if (typeof (stage != null ? stage.type : void 0) !== 'string') {
        throw "invalid stage";
      }
      this._stageStack = [stage];
      this.scale = {};
    }

    Segment.prototype.getStage = function() {
      return this._stageStack[this._stageStack.length - 1];
    };

    Segment.prototype.setStage = function(stage) {
      if (typeof (stage != null ? stage.type : void 0) !== 'string') {
        throw "invalid stage";
      }
      this._stageStack[this._stageStack.length - 1] = stage;
    };

    Segment.prototype.pushStage = function(stage) {
      if (typeof (stage != null ? stage.type : void 0) !== 'string') {
        throw "invalid stage";
      }
      this._stageStack.push(stage);
    };

    Segment.prototype.popStage = function() {
      if (this._stageStack.length < 2) {
        throw "must have at least one stage";
      }
      this._stageStack.pop();
    };

    return Segment;

  })();

  window.facet = facet = {};

  facet.split = {
    identity: function(attribute) {
      return {
        bucket: 'identity',
        attribute: attribute
      };
    },
    continuous: function(attribute, size, offset) {
      return {
        bucket: 'continuous',
        attribute: attribute,
        size: size,
        offset: offset
      };
    },
    time: function(attribute, duration) {
      if (duration !== 'second' && duration !== 'minute' && duration !== 'hour' && duration !== 'day') {
        throw new Error("Invalid duration '" + duration + "'");
      }
      return {
        bucket: 'time',
        attribute: attribute,
        duration: duration
      };
    }
  };

  facet.apply = {
    count: function() {
      return {
        aggregate: 'count'
      };
    },
    sum: function(attribute) {
      return {
        aggregate: 'sum',
        attribute: attribute
      };
    },
    average: function(attribute) {
      return {
        aggregate: 'sum',
        attribute: attribute
      };
    },
    min: function(attribute) {
      return {
        aggregate: 'min',
        attribute: attribute
      };
    },
    max: function(attribute) {
      return {
        aggregate: 'max',
        attribute: attribute
      };
    },
    unique: function(attribute) {
      return {
        aggregate: 'unique',
        attribute: attribute
      };
    }
  };

  getProp = function(segment, propName) {
    var _ref;
    if (!segment) {
      throw new Error("No such prop name '" + propName + "'");
    }
    return (_ref = segment.prop[propName]) != null ? _ref : getProp(segment.parent, propName);
  };

  facet.use = {
    prop: function(propName) {
      return function(segment) {
        return getProp(segment, propName);
      };
    },
    literal: function(value) {
      return function() {
        return value;
      };
    },
    fn: function() {
      var args, fn, _i;
      args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), fn = arguments[_i++];
      return function(segment) {
        if (typeof fn !== 'function') {
          throw new TypeError("second argument must be a function");
        }
        return fn.apply(this, args.map(function(arg) {
          return arg(segment);
        }));
      };
    },
    scaled: function(scaleName, acc) {
      return function(segment) {
        return segment.scale[scaleName](acc(segment));
      };
    },
    scale: {
      color: function(propName) {
        var s;
        s = d3.scale.category10();
        return function(segment) {
          var v;
          v = getProp(segment, propName);
          return s(v);
        };
      }
    }
  };

  divideLength = function(length, sizes) {
    var lengthPerSize, size, totalSize, _i, _len;
    totalSize = 0;
    for (_i = 0, _len = sizes.length; _i < _len; _i++) {
      size = sizes[_i];
      totalSize += size;
    }
    lengthPerSize = length / totalSize;
    return sizes.map(function(size) {
      return size * lengthPerSize;
    });
  };

  stripeTile = function(dim1, dim2) {
    var makeTransform;
    makeTransform = function(dim, value) {
      if (dim === 'width') {
        return "translate(" + value + ",0)";
      } else {
        return "translate(0," + value + ")";
      }
    };
    return function(_arg) {
      var gap, size, _ref;
      _ref = _arg != null ? _arg : {}, gap = _ref.gap, size = _ref.size;
      return function(parentSegment, segmentGroup) {
        var availableDim1, curDim1, dim1s, dimSoFar, i, maxGap, n, parentDim1, parentDim2, parentStage, segment, segmentStage, _i, _len;
        gap || (gap = 0);
        size || (size = function() {
          return 1;
        });
        n = segmentGroup.length;
        parentStage = parentSegment.getStage();
        if (parentStage.type !== 'rectangle') {
          throw new Error("Must have a rectangular stage (is " + parentStage.type + ")");
        }
        parentDim1 = parentStage[dim1];
        parentDim2 = parentStage[dim2];
        maxGap = Math.max(0, (parentDim1 - n * 2) / (n - 1));
        gap = Math.min(gap, maxGap);
        availableDim1 = parentDim1 - gap * (n - 1);
        dim1s = divideLength(availableDim1, segmentGroup.map(size));
        dimSoFar = 0;
        for (i = _i = 0, _len = segmentGroup.length; _i < _len; i = ++_i) {
          segment = segmentGroup[i];
          curDim1 = dim1s[i];
          segmentStage = {
            type: 'rectangle'
          };
          segmentStage[dim1] = curDim1;
          segmentStage[dim2] = parentDim2;
          segment.setStage(segmentStage);
          segment.node.attr('transform', makeTransform(dim1, dimSoFar)).attr(dim1, curDim1).attr(dim2, parentDim2);
          dimSoFar += curDim1 + gap;
        }
      };
    };
  };

  facet.layout = {
    overlap: function() {
      return {};
    },
    horizontal: stripeTile('width', 'height'),
    vertical: stripeTile('height', 'width'),
    tile: function() {}
  };

  getCousinSegments = function(segment, distance) {
    var cousinSegments, i, sourceSegment;
    sourceSegment = segment;
    i = 0;
    while (i < distance) {
      sourceSegment = sourceSegment.parent;
      if (!sourceSegment) {
        throw new Error("gone to far");
      }
      i++;
    }
    cousinSegments = [sourceSegment];
    i = 0;
    while (i < distance) {
      cousinSegments = flatten(cousinSegments.map(function(s) {
        return s.splits;
      }));
      i++;
    }
    return cousinSegments;
  };

  facet.scale = {
    linear: function(_arg) {
      var domain, include, range, rangeFn;
      domain = _arg.domain, range = _arg.range, include = _arg.include;
      if (range === 'width' || range === 'height') {
        rangeFn = function(segment) {
          return [0, segment.getStage()[range]];
        };
      } else if (typeof range === 'number') {
        rangeFn = function() {
          return [0, range];
        };
      } else if (Array.isArray(range) && range.length === 2) {
        rangeFn = function() {
          return range;
        };
      } else {
        throw new Error("bad range");
      }
      return function(segments) {
        var domainMax, domainMin, domainValue, rangeFrom, rangeTo, rangeValue, segment, _i, _len;
        domainMin = Infinity;
        domainMax = -Infinity;
        rangeFrom = -Infinity;
        rangeTo = Infinity;
        if (include != null) {
          domainMin = Math.min(domainMin, include);
          domainMax = Math.max(domainMax, include);
        }
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          domainValue = domain(segment);
          domainMin = Math.min(domainMin, domainValue);
          domainMax = Math.max(domainMax, domainValue);
          rangeValue = rangeFn(segment);
          rangeFrom = rangeValue[0];
          rangeTo = Math.min(rangeTo, rangeValue[1]);
        }
        if (!(isFinite(domainMin) && isFinite(domainMax) && isFinite(rangeFrom) && isFinite(rangeTo))) {
          throw new Error("we went into infinites");
        }
        return d3.scale.linear().domain([domainMin, domainMax]).range([rangeFrom, rangeTo]);
      };
    },
    log: function(_arg) {
      var domain, include, range, rangeFn;
      domain = _arg.domain, range = _arg.range, include = _arg.include;
      if (range === 'width' || range === 'height') {
        rangeFn = function(segment) {
          return [0, segment.getStage()[range]];
        };
      } else if (typeof range === 'number') {
        rangeFn = function() {
          return [0, range];
        };
      } else if (Array.isArray(range) && range.length === 2) {
        rangeFn = function() {
          return range;
        };
      } else {
        throw new Error("bad range");
      }
      return function(segments) {
        var domainMax, domainMin, domainValue, rangeFrom, rangeTo, rangeValue, segment, _i, _len;
        domainMin = Infinity;
        domainMax = -Infinity;
        rangeFrom = -Infinity;
        rangeTo = Infinity;
        if (include != null) {
          domainMin = Math.min(domainMin, include);
          domainMax = Math.max(domainMax, include);
        }
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          domainValue = domain(segment);
          domainMin = Math.min(domainMin, domainValue);
          domainMax = Math.max(domainMax, domainValue);
          rangeValue = rangeFn(segment);
          rangeFrom = rangeValue[0];
          rangeTo = Math.min(rangeTo, rangeValue[1]);
        }
        if (!(isFinite(domainMin) && isFinite(domainMax) && isFinite(rangeFrom) && isFinite(rangeTo))) {
          throw new Error("we went into infinites");
        }
        return d3.scale.log().domain([domainMin, domainMax]).range([rangeFrom, rangeTo]);
      };
    }
  };

  boxPosition = function(segment, stageWidth, left, width, right) {
    if ((left != null) && (width != null) && (right != null)) {
      throw new Error("Over-constrained");
    }
    if (left != null) {
      if (width != null) {
        return [left(segment), width(segment)];
      } else {
        return [left(segment), stageWidth - left(segment)];
      }
    } else if (right != null) {
      if (width != null) {
        return [stageWidth - right(segment) - width(segment), width(segment)];
      } else {
        return [0, stageWidth - right(segment)];
      }
    } else {
      if (width != null) {
        return [0, width(segment)];
      } else {
        return [0, stageWidth];
      }
    }
  };

  facet.stage = {
    rectToPoint: function(_arg) {
      var bottom, fx, fy, left, right, top, _ref;
      _ref = _arg != null ? _arg : {}, left = _ref.left, right = _ref.right, top = _ref.top, bottom = _ref.bottom;
      if (((left != null) && (right != null)) || ((top != null) && (bottom != null))) {
        throw new Error("Over-constrained");
      }
      fx = left != null ? function(w) {
        return left;
      } : right != null ? function(w) {
        return w - right;
      } : function(w) {
        return w / 2;
      };
      fy = top != null ? function(h) {
        return top;
      } : bottom != null ? function(h) {
        return h - bottom;
      } : function(h) {
        return h / 2;
      };
      return function(segment) {
        var stage;
        stage = segment.getStage();
        if (stage.type !== 'rectangle') {
          throw new Error("Must have a rectangle stage (is " + stage.type + ")");
        }
        segment.pushStage({
          type: 'point',
          x: fx(stage.width),
          y: fy(stage.height)
        });
      };
    },
    toPoint: function(_arg) {
      var bottom, fx, fy, left, right, top, _ref;
      _ref = _arg != null ? _arg : {}, left = _ref.left, right = _ref.right, top = _ref.top, bottom = _ref.bottom;
      if (((left != null) && (right != null)) || ((top != null) && (bottom != null))) {
        throw new Error("Over-constrained");
      }
      fx = left != null ? function(w, s) {
        return left(s);
      } : right != null ? function(w, s) {
        return w - right(s);
      } : function(w, s) {
        return w / 2;
      };
      fy = top != null ? function(h, s) {
        return top(s);
      } : bottom != null ? function(h, s) {
        return h - bottom(s);
      } : function(h, s) {
        return h / 2;
      };
      return function(segment) {
        var stage;
        stage = segment.getStage();
        if (stage.type !== 'rectangle') {
          throw new Error("Must have a rectangle stage (is " + stage.type + ")");
        }
        segment.pushStage({
          type: 'point',
          x: fx(stage.width, segment),
          y: fy(stage.height, segment)
        });
      };
    }
  };

  facet.plot = {
    rect: function(_arg) {
      var bottom, fill, height, left, opacity, right, stroke, top, width;
      left = _arg.left, width = _arg.width, right = _arg.right, top = _arg.top, height = _arg.height, bottom = _arg.bottom, stroke = _arg.stroke, fill = _arg.fill, opacity = _arg.opacity;
      return function(segment) {
        var h, stage, w, x, y, _ref, _ref1;
        stage = segment.getStage();
        if (stage.type !== 'rectangle') {
          throw new Error("Must have a rectangle stage (is " + stage.type + ")");
        }
        _ref = boxPosition(segment, stage.width, left, width, right), x = _ref[0], w = _ref[1];
        _ref1 = boxPosition(segment, stage.height, top, height, bottom), y = _ref1[0], h = _ref1[1];
        segment.node.append('rect').datum(segment).attr('x', x).attr('y', y).attr('width', w).attr('height', h).style('fill', fill).style('stroke', stroke).style('opacity', opacity);
      };
    },
    text: function(_arg) {
      var anchor, angle, baseline, color, size, text;
      color = _arg.color, text = _arg.text, size = _arg.size, anchor = _arg.anchor, baseline = _arg.baseline, angle = _arg.angle;
      return function(segment) {
        var node, stage, transformStr;
        stage = segment.getStage();
        if (stage.type !== 'point') {
          throw new Error("Must have a point stage (is " + stage.type + ")");
        }
        node = segment.node.append('text').datum(segment);
        transformStr = "translate(" + stage.x + ", " + stage.y + ")";
        if (angle != null) {
          transformStr += " rotate(" + (angle(segment)) + ")";
        }
        node.attr('transform', transformStr);
        if (typeof baseline === 'function') {
          node.attr('dy', function(segment) {
            var bv;
            bv = baseline.call(this, segment);
            if (bv === 'top') {
              return '.71em';
            } else if (bv === 'center') {
              return '.35em';
            } else {
              return null;
            }
          });
        }
        node.style('font-size', size).style('fill', color).style('text-anchor', anchor).text(text);
      };
    },
    circle: function(_arg) {
      var fill, radius, stroke;
      radius = _arg.radius, stroke = _arg.stroke, fill = _arg.fill;
      return function(segment) {
        var stage;
        stage = segment.getStage();
        if (stage.type !== 'point') {
          throw new Error("Must have a point stage (is " + stage.type + ")");
        }
        segment.node.append('circle').datum(segment).attr('cx', stage.x).attr('cy', stage.y).attr('r', radius).style('fill', fill).style('stroke', stroke);
      };
    }
  };

  facet.sort = {
    natural: function(attribute, direction) {
      if (direction == null) {
        direction = 'ascending';
      }
      return {
        compare: 'natural',
        attribute: attribute,
        direction: direction
      };
    },
    caseInsensetive: function(attribute, direction) {
      if (direction == null) {
        direction = 'ascending';
      }
      return {
        compare: 'caseInsensetive',
        attribute: attribute,
        direction: direction
      };
    }
  };

  FacetJob = (function() {

    function FacetJob(driver) {
      this.driver = driver;
      this.ops = [];
      this.knownProps = {};
    }

    FacetJob.prototype.split = function(propName, split) {
      split = _.clone(split);
      split.operation = 'split';
      split.prop = propName;
      this.ops.push(split);
      this.knownProps[propName] = true;
      return this;
    };

    FacetJob.prototype.layout = function(layout) {
      if (typeof layout !== 'function') {
        throw new TypeError("Layout must be a function");
      }
      this.ops.push({
        operation: 'layout',
        layout: layout
      });
      return this;
    };

    FacetJob.prototype.apply = function(propName, apply) {
      apply = _.clone(apply);
      apply.operation = 'apply';
      apply.prop = propName;
      this.ops.push(apply);
      this.knownProps[propName] = true;
      return this;
    };

    FacetJob.prototype.scale = function(name, distance, scale) {
      if ((scale == null) && typeof distance === 'function') {
        scale = distance;
        distance = 1;
      }
      this.ops.push({
        operation: 'scale',
        name: name,
        distance: distance,
        scale: scale
      });
      return this;
    };

    FacetJob.prototype.combine = function(_arg) {
      var combine, filter, limit, sort, _base, _ref, _ref1;
      _ref = _arg != null ? _arg : {}, filter = _ref.filter, sort = _ref.sort, limit = _ref.limit;
      combine = {
        operation: 'combine'
      };
      if (sort) {
        if (!this.knownProps[sort.prop]) {
          throw new Error("can not sort on unknown prop '" + sort.prop + "'");
        }
        combine.sort = sort;
        if ((_ref1 = (_base = combine.sort).compare) == null) {
          _base.compare = 'natural';
        }
      }
      if (limit != null) {
        combine.limit = limit;
      }
      this.ops.push(combine);
      return this;
    };

    FacetJob.prototype.stage = function(transform) {
      if (typeof transform !== 'function') {
        throw new TypeError("transform must be a function");
      }
      this.ops.push({
        operation: 'stage',
        transform: transform
      });
      return this;
    };

    FacetJob.prototype.unstage = function() {
      this.ops.push({
        operation: 'unstage'
      });
      return this;
    };

    FacetJob.prototype.plot = function(plot) {
      if (typeof plot !== 'function') {
        throw new TypeError("plot must be a function");
      }
      this.ops.push({
        operation: 'plot',
        plot: plot
      });
      return this;
    };

    FacetJob.prototype.getQuery = function() {
      return this.ops.filter(function(_arg) {
        var operation;
        operation = _arg.operation;
        return operation === 'split' || operation === 'apply' || operation === 'combine';
      });
    };

    FacetJob.prototype.render = function(selector, width, height) {
      var operations, parent;
      parent = d3.select(selector);
      if (parent.empty()) {
        throw new Error("could not find the provided selector");
      }
      if (!(width && height)) {
        throw new Error("bad size: " + width + " x " + height);
      }
      operations = this.ops;
      this.driver(this.getQuery(), function(err, res) {
        var cmd, distance, layout, name, parentSegment, plot, scale, scaleFn, segment, segmentGroup, segmentGroups, svg, transform, unifiedSegment, unifiedSegments, _i, _j, _k, _l, _len, _len1, _len10, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _o, _p, _q, _r, _s;
        if (err) {
          alert("An error has occurred: " + (typeof err === 'string' ? err : err.message));
          return;
        }
        svg = parent.append('svg').attr('width', width).attr('height', height);
        segmentGroups = [
          [
            new Segment({
              parent: null,
              node: svg,
              stage: {
                type: 'rectangle',
                width: width,
                height: height
              },
              prop: res.prop,
              splits: res.splits
            })
          ]
        ];
        for (_i = 0, _len = operations.length; _i < _len; _i++) {
          cmd = operations[_i];
          switch (cmd.operation) {
            case 'split':
              segmentGroups = flatten(segmentGroups).map(function(segment) {
                return segment.splits = segment.splits.map(function(sp) {
                  return new Segment({
                    parent: segment,
                    node: segment.node.append('g'),
                    stage: segment.getStage(),
                    prop: sp.prop,
                    splits: sp.splits
                  });
                });
              });
              break;
            case 'apply':
            case 'combine':
              null;
              break;
            case 'scale':
              name = cmd.name, distance = cmd.distance, scale = cmd.scale;
              for (_j = 0, _len1 = segmentGroups.length; _j < _len1; _j++) {
                segmentGroup = segmentGroups[_j];
                for (_k = 0, _len2 = segmentGroup.length; _k < _len2; _k++) {
                  segment = segmentGroup[_k];
                  if (segment.scale[name]) {
                    continue;
                  }
                  unifiedSegments = getCousinSegments(segment, distance);
                  scaleFn = scale(unifiedSegments);
                  for (_l = 0, _len3 = unifiedSegments.length; _l < _len3; _l++) {
                    unifiedSegment = unifiedSegments[_l];
                    unifiedSegment.scale[name] = scaleFn;
                  }
                }
              }
              break;
            case 'layout':
              layout = cmd.layout;
              for (_m = 0, _len4 = segmentGroups.length; _m < _len4; _m++) {
                segmentGroup = segmentGroups[_m];
                parentSegment = segmentGroup[0].parent;
                if (!parentSegment) {
                  throw new Error("You must split before calling layout");
                }
                layout(parentSegment, segmentGroup);
              }
              break;
            case 'stage':
              transform = cmd.transform;
              for (_n = 0, _len5 = segmentGroups.length; _n < _len5; _n++) {
                segmentGroup = segmentGroups[_n];
                for (_o = 0, _len6 = segmentGroup.length; _o < _len6; _o++) {
                  segment = segmentGroup[_o];
                  transform(segment);
                }
              }
              break;
            case 'unstage':
              for (_p = 0, _len7 = segmentGroups.length; _p < _len7; _p++) {
                segmentGroup = segmentGroups[_p];
                for (_q = 0, _len8 = segmentGroup.length; _q < _len8; _q++) {
                  segment = segmentGroup[_q];
                  segment.popStage();
                }
              }
              break;
            case 'plot':
              plot = cmd.plot;
              for (_r = 0, _len9 = segmentGroups.length; _r < _len9; _r++) {
                segmentGroup = segmentGroups[_r];
                for (_s = 0, _len10 = segmentGroup.length; _s < _len10; _s++) {
                  segment = segmentGroup[_s];
                  plot(segment);
                }
              }
              break;
            default:
              throw new Error("Unknown operation '" + cmd.operation + "'");
          }
        }
      });
      return this;
    };

    return FacetJob;

  })();

  facet.visualize = function(driver) {
    return new FacetJob(driver);
  };

  facet.ajaxPoster = function(_arg) {
    var context, prety, url;
    url = _arg.url, context = _arg.context, prety = _arg.prety;
    return function(query, callback) {
      return $.ajax({
        url: url,
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          context: context,
          query: query
        }, null, prety ? 2 : null),
        success: function(res) {
          callback(null, res);
        },
        error: function(xhr) {
          var err, text;
          text = xhr.responseText;
          try {
            err = JSON.parse(text);
          } catch (e) {
            err = {
              message: text
            };
          }
          callback(err, null);
        }
      });
    };
  };

  facet.verboseProxy = function(driver) {
    return function(query, callback) {
      console.log('Query:', query);
      driver(query, function(err, res) {
        console.log('Result:', res);
        callback(err, res);
      });
    };
  };

}).call(this);

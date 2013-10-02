`(typeof window === 'undefined' ? {} : window)['simpleDriver'] = (function(module, require){"use strict"; var exports = module.exports`

async = require('async')
driverUtil = require('./driverUtil')
{FacetFilter, FacetSplit, FacetApply, FacetCombine, FacetQuery} = require('./query')

# -----------------------------------------------------

filterFns = {
  true: ->
    return -> true

  false: ->
    return -> false

  is: ({attribute, value}) ->
    return (d) -> d[attribute] is value

  in: ({attribute, values}) ->
    return (d) -> d[attribute] in values

  contains: ({attribute, value}) ->
    return (d) -> d[attribute].indexOf(value) isnt -1

  match: ({attribute, expression}) ->
    expression = new RegExp(expression)
    return (d) -> expression.test(d[attribute])

  within: ({attribute, range}) ->
    if range[0] instanceof Date
      return (d) -> range[0] <= new Date(d[attribute]) < range[1]
    else
      return (d) -> range[0] <= Number(d[attribute]) < range[1]

  not: ({filter}) ->
    filter = makeFilterFn(filter)
    return (d) -> not filter(d)

  and: ({filters}) ->
    filters = filters.map(makeFilterFn)
    return (d) ->
      for filter in filters
        return false unless filter(d)
      return true

  or: ({filters}) ->
    filters = filters.map(makeFilterFn)
    return (d) ->
      for filter in filters
        return true if filter(d)
      return false
}

makeFilterFn = (filter) ->
  throw new TypeError("filter must be a FacetFilter") unless filter instanceof FacetFilter
  filterFn = filterFns[filter.type]
  throw new Error("filter type '#{filter.type}' not supported by driver") unless filterFn
  return filterFn(filter)

# ------------------------
splitFns = {
  identity: ({attribute}) ->
    return (d) -> d[attribute] ? null

  continuous: ({attribute, size, offset}) ->
    return (d) ->
      num = Number(d[attribute])
      return null if isNaN(num)
      b = Math.floor((num + offset) / size) * size - offset
      return [b, b + size]

  timeDuration: ({attribute, duration, offset}) ->
    throw new Error("not implemented yet") # todo

  timePeriod: ({attribute, period, timezone}) ->
    throw new Error('only UTC is supported by driver (for now)') unless timezone is 'Etc/UTC'
    switch period
      when 'PT1S'
        return (d) ->
          ds = new Date(d[attribute])
          return null if isNaN(ds)
          ds.setUTCMilliseconds(0)
          de = new Date(ds)
          de.setUTCMilliseconds(1000)
          return [ds, de]

      when 'PT1M'
        return (d) ->
          ds = new Date(d[attribute])
          return null if isNaN(ds)
          ds.setUTCSeconds(0, 0)
          de = new Date(ds)
          de.setUTCSeconds(60)
          return [ds, de]

      when 'PT1H'
        return (d) ->
          ds = new Date(d[attribute])
          return null if isNaN(ds)
          ds.setUTCMinutes(0, 0, 0)
          de = new Date(ds)
          de.setUTCMinutes(60)
          return [ds, de]

      when 'P1D'
        return (d) ->
          ds = new Date(d[attribute])
          return null if isNaN(ds)
          ds.setUTCHours(0, 0, 0, 0)
          de = new Date(ds)
          de.setUTCHours(24)
          return [ds, de]

      else
        throw new Error("period '#{period}' not supported by driver")

  tuple: ({splits}) ->
    tupleSplits = splits.map(makeSplitFn)
    return (d) -> tupleSplits.map((sf) -> sf(d))
}

makeSplitFn = (split) ->
  throw new TypeError("split must be a FacetSplit") unless split instanceof FacetSplit
  splitFn = splitFns[split.bucket]
  throw new Error("split bucket '#{split.bucket}' not supported by driver") unless splitFn
  return splitFn(split)


# ----------------------------
aggregateFns = {
  constant: ({value}) -> () ->
    return Number(value)

  count: (dataset) -> (ds) ->
    return ds.length

  sum: ({attribute}) -> (ds) ->
    sum = 0
    sum += Number(d[attribute]) for d in ds
    return sum

  average: ({attribute}) -> (ds) ->
    sum = 0
    sum += Number(d[attribute]) for d in ds
    return sum / ds.length

  min: ({attribute}) -> (ds) ->
    min = +Infinity
    min = Math.min(min, Number(d[attribute])) for d in ds
    if isNaN(min)
      min = +Infinity
      min = Math.min(min, (new Date(d[attribute])).valueOf()) for d in ds
    return min

  max: ({attribute}) -> (ds) ->
    max = -Infinity
    max = Math.max(max, Number(d[attribute])) for d in ds
    if isNaN(max)
      max = -Infinity
      max = Math.max(max, (new Date(d[attribute])).valueOf()) for d in ds
    return max

  uniqueCount: ({attribute}) -> (ds) ->
    seen = {}
    count = 0
    for d in ds
      v = d[attribute]
      if not seen[v]
        count++
        seen[v] = 1
    return count

  quantile: ({attribute, quantile}) -> (ds) ->
    return null unless ds.length
    points = ds.map((d) -> Number(d[attribute]))
    points.sort((a, b) -> a - b)
    return points[Math.floor(points.length * quantile)]
}

arithmeticFns = {
  add: ([lhs, rhs]) -> (ds) ->
    return lhs(ds) + rhs(ds)

  subtract: ([lhs, rhs]) -> (ds) ->
    return lhs(ds) - rhs(ds)

  multiply: ([lhs, rhs]) -> (ds) ->
    return lhs(ds) * rhs(ds)

  divide: ([lhs, rhs]) -> (ds) ->
    return lhs(ds) / rhs(ds)
}

makeApplyFn = (apply) ->
  throw new TypeError("apply must be a FacetApply") unless apply instanceof FacetApply
  if apply.aggregate
    aggregateFn = aggregateFns[apply.aggregate]
    throw new Error("aggregate '#{apply.aggregate}' unsupported by driver") unless aggregateFn
    dataset = apply.getDataset()
    rawApplyFn = aggregateFn(apply)
    if apply.filter
      filterFn = makeFilterFn(apply.filter)
      return (dss) -> rawApplyFn(dss[dataset].filter(filterFn))
    else
      return (dss) -> rawApplyFn(dss[dataset])
  else if apply.arithmetic
    arithmeticFn = arithmeticFns[apply.arithmetic]
    throw new Error("arithmetic '#{apply.arithmetic}' unsupported by driver") unless arithmeticFn
    return arithmeticFn(apply.operands.map(makeApplyFn))
  else
    throw new Error("apply must have an aggregate or an arithmetic")
  return

# -------------------
directionFns = {
  ascending: (a, b) ->
    a = a[0] if Array.isArray(a)
    b = b[0] if Array.isArray(b)
    return if a < b then -1 else if a > b then 1 else if a >= b then 0 else NaN

  descending: (a, b) ->
    a = a[0] if Array.isArray(a)
    b = b[0] if Array.isArray(b)
    return if b < a then -1 else if b > a then 1 else if b >= a then 0 else NaN
}

compareFns = {
  natural: ({prop, direction}) ->
    directionFn = directionFns[direction]
    throw new Error("arithmetic '#{direction}' unsupported by driver") unless directionFn
    return (a, b) -> directionFn(a.prop[prop], b.prop[prop])

  caseInsensetive: ({prop, direction}) ->
    directionFn = directionFns[direction]
    throw new Error("arithmetic '#{direction}' unsupported by driver") unless directionFn
    return (a, b) -> directionFn(String(a.prop[prop]).toLowerCase(), String(b.prop[prop]).toLowerCase())
}

makeCompareFn = (sortCompare) ->
  compareFn = compareFns[sortCompare.compare]
  throw new Error("compare '#{sortCompare.compare}' unsupported by driver") unless compareFn
  return compareFn(sortCompare)


combineFns = {
  slice: ({sort, limit}) ->
    if sort
      compareFn = makeCompareFn(sort)

    return (segments) ->
      if compareFn
        segments.sort(compareFn)

      if limit?
        driverUtil.inPlaceTrim(segments, limit)

      return

  matrix: () ->
    throw new Error("matrix combine not implemented yet")
}

makeCombineFn = (combine) ->
  throw new TypeError("combine must be a FacetCombine") unless combine instanceof FacetCombine
  combineFn = combineFns[combine.method]
  throw new Error("method '#{combine.method}' unsupported by driver") unless combineFn
  return combineFn(combine)


computeQuery = (data, query) ->
  rootRaw = {}

  commonFilterFn = makeFilterFn(query.getFilter())
  for datasetName in query.getDatasets()
    datasetFilterFn = makeFilterFn(query.getDatasetFilter(datasetName))
    rootRaw[datasetName] = data.filter(commonFilterFn).filter(datasetFilterFn)

  rootSegment = {
    prop: {}
    parent: null
    _raws: rootRaw
  }
  originalSegmentGroups = segmentGroups = [[rootSegment]]

  groups = query.getGroups()
  for {split, applies, combine} in groups
    if split
      propName = split.name
      parallelSplits = if split.bucket is 'parallel' then split.splits else [split]

      parallelSplitFns = {}
      for parallelSplit in parallelSplits
        parallelSplitFns[parallelSplit.getDataset()] = makeSplitFn(parallelSplit)

      segmentFilterFn = if split.segmentFilter then split.segmentFilter.getFilterFn() else null
      segmentGroups = driverUtil.filterMap driverUtil.flatten(segmentGroups), (segment) ->
        return if segmentFilterFn and not segmentFilterFn(segment)
        keys = []
        bucketsByDataset = {}
        bucketValue = {}
        for dataset, parallelSplitFn of parallelSplitFns
          buckets = {}
          for d in segment._raws[dataset]
            key = parallelSplitFn(d)
            throw new Error("bucket returned undefined") unless key? # ToDo: handle nulls
            keyString = String(key)

            if not bucketValue[keyString]
              keys.push(keyString)
              bucketValue[keyString] = key

            buckets[keyString] = [] unless buckets[keyString]
            buckets[keyString].push(d)
          bucketsByDataset[dataset] = buckets

        segment.splits = keys.map((keyString) ->
          prop = {}
          prop[propName] = bucketValue[keyString]

          raws = {}
          for dataset, buckets of bucketsByDataset
            raws[dataset] = buckets[keyString] or []

          return {
            _raws: raws
            prop
            parent: segment
          }
        )
        return segment.splits

    for apply in applies
      propName = apply.name
      applyFn = makeApplyFn(apply)
      for segmentGroup in segmentGroups
        for segment in segmentGroup
          segment.prop[propName] = applyFn(segment._raws)

    if combine
      combineFn = makeCombineFn(combine)
      for segmentGroup in segmentGroups
        combineFn(segmentGroup) # In place

  return driverUtil.cleanSegments(originalSegmentGroups[0][0] or {})


module.exports = (data) -> (request, callback) ->
  try
    throw new Error("request not supplied") unless request
    {context, query} = request
    throw new Error("query not supplied") unless query
    throw new TypeError("query must be a FacetQuery") unless query instanceof FacetQuery
    result = computeQuery(data, query)
  catch e
    callback({ message: e.message, stack: e.stack }); return

  callback(null, result)
  return

# -----------------------------------------------------
# Handle commonJS crap
`return module.exports; }).call(this,
  (typeof module === 'undefined' ? {exports: {}} : module),
  (typeof require === 'undefined' ? function (modulePath, altPath) {
    if (altPath) return window[altPath];
    var moduleParts = modulePath.split('/');
    return window[moduleParts[moduleParts.length - 1]];
  } : require)
)`

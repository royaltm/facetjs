
rangesIntersect = (range1, range2) ->
  if range2[1] < range1[0] or range2[0] > range1[1]
    return false
  else
    return range1[0] <= range2[1] and range2[0] <= range1[1]


smaller = (a, b) -> if a < b then a else b
larger  = (a, b) -> if a < b then b else a


specialJoin = (array, sep, lastSep) ->
  lengthMinus1 = array.length - 1
  return array.reduce (prev, now, index) -> prev + (if index < lengthMinus1 then sep else lastSep) + now


throwBadArgs = ->
  throw new Error("bad number of arguments")


filterTypePresedence = {
  'true': 1
  'false': 2
  'within': 3
  'is': 4
  'in': 5
  'fragments': 6
  'match': 7
  'not': 8
  'and': 9
  'or': 10
}

class FacetFilter
  @compare = (filter1, filter2) ->
    typeDiff = filterTypePresedence[filter1.type] - filterTypePresedence[filter2.type]
    return typeDiff if typeDiff isnt 0 or filter1.type in ['not', 'and', 'or']
    return -1 if filter1.attribute < filter2.attribute
    return +1 if filter1.attribute > filter2.attribute

    # ToDo: expand this to all filters
    if filter1.type is 'is'
      return -1 if filter1.value < filter2.value
      return +1 if filter1.value > filter2.value

    return 0

  constructor: ->
    @type = 'base'
    return

  _ensureType: (filterType) ->
    if not @type
      @type = filterType # Set the type if it is so far undefined
      return
    if @type isnt filterType
      throw new TypeError("incorrect filter type '#{@type}' (needs to be: '#{filterType}')")
    return

  toString: ->
    return "base filter"

  valueOf: ->
    throw new Error("base filter has no value")

  # Reduces a filter into a (potentially) simpler form the input is never modified
  # Specifically this function:
  # - flattens nested ANDs
  # - flattens nested ORs
  # - sorts lists of filters within an AND / OR by attribute
  simplify: ->
    return this # Base simplify is to do nothing

  # Separate filters into ones with a certain attribute and ones without
  # Such that the WithoutFilter AND WithFilter are semantically equivalent to the original filter
  #
  # @param {FacetFilter} filter - the filter to separate
  # @param {String} attribute - the attribute which to separate out
  # @return {null|Array} null|[WithoutFilter, WithFilter] - the separated filters
  extractFilterByAttribute: (attribute) ->
    throw new TypeError("must have an attribute") unless typeof attribute is 'string'
    if not @attribute or @attribute isnt attribute
      return [this]
    else
      return [new TrueFilter(), this]


class TrueFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      { @type } = arguments[0]
    else if arguments.length isnt 0
      throwBadArgs()
    @_ensureType('true')

  toString: ->
    return "Everything"

  valueOf: ->
    return { type: @type }



class FalseFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      { @type } = arguments[0]
    else if arguments.length isnt 0
      throwBadArgs()
    @_ensureType('false')

  toString: ->
    return "Nothing"

  valueOf: ->
    return { type: @type }



class IsFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      { @type, @attribute, @value } = arguments[0]
    else if arguments.length is 2
      [@attribute, @value] = arguments
    else
      throwBadArgs()
    @_ensureType('is')

  toString: ->
    return "#{@attribute} is #{@value}"

  valueOf: ->
    return { type: @type, attribute: @attribute, value: @value }


class InFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      { @type, @attribute, @values } = arguments[0]
    else if arguments.length is 2
      [@attribute, @values] = arguments
    else
      throwBadArgs()
    @_ensureType('in')
    throw new TypeError('values must be an array') unless Array.isArray(@values)

  toString: ->
    switch @values.length
      when 0 then return "Nothing"
      when 1 then return "#{@attribute} is #{@values[0]}"
      when 2 then return "#{@attribute} is either #{@values[0]} or #{@values[1]}"
      else return "#{@attribute} is one of: #{specialJoin(@values, ', ', ', or ')}"

  valueOf: ->
    return { type: @type, attribute: @attribute, values: @values }

  simplify: ->
    return if @values.length then this else new FalseFilter()



class FragmentsFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      { @type, @attribute, @fragments } = arguments[0]
    else if arguments.length is 2
      [@attribute, @fragments] = arguments
    else
      throwBadArgs()
    @_ensureType('fragments')
    throw new TypeError('fragments must be an array') unless Array.isArray(@fragments)

  toString: ->
    return "#{@attribute} contains #{specialJoin(@fragments.map((fragment) -> '\'' + fragment + '\''), ', ', ', and ')}"

  valueOf: ->
    return { type: @type, attribute: @attribute, fragments: @fragments }



class MatchFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      { @type, @attribute, @match } = arguments[0]
    else if arguments.length is 2
      [@attribute, @match] = arguments
    else
      throwBadArgs()
    @_ensureType('match')

  toString: ->
    return "#{@attribute} matches /#{@match}/"

  valueOf: ->
    return { type: @type, attribute: @attribute, match: @match }



class WithinFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      { @type, @attribute, @range } = arguments[0]
    else if arguments.length is 2
      [@attribute, @range] = arguments
    else
      throwBadArgs()
    @_ensureType('within')
    throw new TypeError('range must be an array of length 2') unless Array.isArray(@range) and @range.length is 2
    [r0, r1] = @range
    if typeof r0 is 'string' and typeof r1 is 'string'
      r0 = new Date(r0)
      r1 = new Date(r1)

    throw new Error('invalid range') if isNaN(r0) or isNaN(r1)

  toString: ->
    return "#{@attribute} is within #{@range[0]} and #{@range[1]}"

  valueOf: ->
    return { type: @type, attribute: @attribute, range: @range }



class NotFilter extends FacetFilter
  constructor: ->
    if arguments.length is 1
      if arguments[0] not instanceof FacetFilter
        @filter = FacetFilter.fromSpec(arguments[0].filter)
      else
        @filter = arguments[0]
    else
      throwBadArgs()
    @_ensureType('not')

  toString: ->
    return "not (#{@filter})"

  valueOf: ->
    return { type: @type, filter: @filter.valueOf() }

  simplify: ->
    return switch @filter.type
      when 'true' then new FalseFilter()
      when 'false' then new TrueFilter()
      when 'not' then @filter.filter.simplify()
      else new NotFilter(@filter.simplify())

  extractFilterByAttribute: (attribute) ->
    throw new TypeError("must have an attribute") unless typeof attribute is 'string'
    return null unless @filter.type in ['true', 'false', 'is', 'in', 'fragments', 'match', 'within']
    if @filter.type is ['true', 'false'] or @filter.attribute isnt attribute
      return [this]
    else
      return [new TrueFilter(), this]



class AndFilter extends FacetFilter
  constructor: (arg) ->
    if arguments.length is 1
      if Array.isArray(arg)
        @filters = arg
      else
        { @type, @filters } = arg
        throw new TypeError('filters must be an array') unless Array.isArray(@filters)
        @filters = @filters.map(FacetFilter.fromSpec)
    else
      throwBadArgs()
    @_ensureType('and')

  toString: ->
    if @filters.length > 1
      return "(#{@filters.join(') and (')})"
    else
      return String(@filters[0])

  valueOf: ->
    return { type: @type, filters: @filters.map((filter) -> filter.valueOf()) }

  _mergeFilters: (filter1, filter2) ->
    return new FalseFilter() if filter1.type is 'false' or filter2.type is 'false'
    return filter2 if filter1.type is 'true'
    return filter1 if filter2.type is 'true'
    return unless filter1.type is filter2.type and filter1.attribute is filter2.attribute
    switch filter1.type
      when 'within'
        if rangesIntersect(filter1.range, filter2.range)
          [start1, end1] = filter1.range
          [start2, end2] = filter2.range
          return new WithinFilter(filter1.attribute, [larger(start1, start2), smaller(end1, end2)])
        else
          return
      else
        return

  simplify: ->
    newFilters = []
    for filter in @filters
      filter = filter.simplify()
      if filter.type is 'and'
        Array::push.apply(newFilters, filter.filters)
      else
        newFilters.push(filter)

    newFilters.sort(FacetFilter.compare)

    if newFilters.length > 1
      mergedFilters = []
      acc = newFilters[0]
      i = 1
      while i < newFilters.length
        currentFilter = newFilters[i]
        merged = @_mergeFilters(acc, currentFilter)
        if merged
          acc = merged
        else
          mergedFilters.push(acc)
          acc = currentFilter
        i++
      mergedFilters.push(acc)
      newFilters = mergedFilters

    return switch newFilters.length
      when 0 then new TrueFilter()
      when 1 then newFilters[0]
      else new AndFilter(newFilters)

  extractFilterByAttribute: (attribute) ->
    throw new TypeError("must have an attribute") unless typeof attribute is 'string'
    remainingFilters = []
    extractedFilters = []
    for filter in @filters
      extract = filter.extractFilterByAttribute(attribute)
      return null if extract is null
      remainingFilters.push(extract[0])
      extractedFilters.push(extract[1]) if extract.length > 1

    return [
      (new AndFilter(remainingFilters)).simplify()
      (new AndFilter(extractedFilters)).simplify()
    ]



class OrFilter extends FacetFilter
  constructor: (arg) ->
    if arguments.length is 1
      if Array.isArray(arg)
        @filters = arg
      else
        { @type, @filters } = arg
        throw new TypeError('filters must be an array') unless Array.isArray(@filters)
        @filters = @filters.map(FacetFilter.fromSpec)
    else
      throwBadArgs()
    @_ensureType('or')

  toString: ->
    if @filters.length > 1
      return "(#{@filters.join(') or (')})"
    else
      return String(@filters[0])

  valueOf: ->
    return { type: @type, filters: @filters.map((filter) -> filter.valueOf()) }

  _mergeFilters: (filter1, filter2) ->
    return new TrueFilter() if filter1.type is 'true' or filter2.type is 'true'
    return filter2 if filter1.type is 'false'
    return filter1 if filter2.type is 'false'
    return unless filter1.type is filter2.type and filter1.attribute is filter2.attribute
    switch filter1.type
      when 'within'
        if rangesIntersect(filter1.range, filter2.range)
          [start1, end1] = filter1.range
          [start2, end2] = filter2.range
          return new WithinFilter(filter1.attribute, [smaller(start1, start2), larger(end1, end2)])
        else
          return new FalseFilter()
      else
        return

  simplify: ->
    newFilters = []
    for filter in @filters
      filter = filter.simplify()
      if filter.type is 'or'
        Array::push.apply(newFilters, filter.filters)
      else
        newFilters.push(filter)

    newFilters.sort(FacetFilter.compare)

    if newFilters.length > 1
      mergedFilters = []
      acc = newFilters[0]
      i = 1
      while i < newFilters.length
        currentFilter = newFilters[i]
        merged = @_mergeFilters(acc, currentFilter)
        if merged
          acc = merged
        else
          mergedFilters.push(acc)
          acc = currentFilter
        i++
      mergedFilters.push(acc)
      newFilters = mergedFilters

    return switch newFilters.length
      when 0 then new FalseFilter()
      when 1 then newFilters[0]
      else new OrFilter(newFilters)

  extractFilterByAttribute: (attribute) ->
    throw new TypeError("must have an attribute") unless typeof attribute is 'string'
    hasNoClaim = (filter) ->
      extract = filter.extractFilterByAttribute(attribute)
      return extract and extract.length is 1

    return if @filters.every(hasNoClaim) then [this] else null



# Make lookup
filterConstructorMap = {
  "true": TrueFilter
  "false": FalseFilter
  "is": IsFilter
  "in": InFilter
  "fragments": FragmentsFilter
  "match": MatchFilter
  "within": WithinFilter
  "not": NotFilter
  "and": AndFilter
  "or": OrFilter
}

FacetFilter.fromSpec = (filterSpec) ->
  FilterConstructor = filterConstructorMap[filterSpec.type]
  throw new Error("unsupported filter type: '#{filterSpec.type}'") unless FilterConstructor
  return new FilterConstructor(filterSpec)


# Export!
exports.FacetFilter = FacetFilter
exports.TrueFilter = TrueFilter
exports.FalseFilter = FalseFilter
exports.IsFilter = IsFilter
exports.InFilter = InFilter
exports.FragmentsFilter = FragmentsFilter
exports.MatchFilter = MatchFilter
exports.WithinFilter = WithinFilter
exports.NotFilter = NotFilter
exports.AndFilter = AndFilter
exports.OrFilter = OrFilter
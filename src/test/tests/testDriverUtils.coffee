driverUtil = require('../../driverUtil')
data = require('../data')

exports["flatten"] = (test) ->
  test.expect(2)
  test.deepEqual(driverUtil.flatten([]), [], "flatten works")
  test.deepEqual(driverUtil.flatten([[1,3], [3,6,7]]), [1,3,3,6,7], "flatten works")
  test.done()
  return

exports["inPlaceTrim"] = {
  "is in place": (test) ->
    test.expect(1)
    a = [1, 2, 3, 4, 5]
    test.strictEqual(a, driverUtil.inPlaceTrim(a, 3), "Not modified in place")
    test.done()
    return

  "trims correctly": (test) ->
    test.expect(1)
    test.deepEqual(driverUtil.inPlaceTrim([1, 2, 3, 4], 2), [1, 2], "Trim down")
    test.deepEqual(driverUtil.inPlaceTrim([1, 2, 3, 4], 0), [], "Trim down to 0")
    test.deepEqual(driverUtil.inPlaceTrim([1, 2, 3, 4], 10), [1, 2, 3, 4], "Trim above length")
    return
}

exports["Table"] = {
  "Basic Rectangular Table": (test) ->
    test.expect(4)
    query = data.diamond[1].query
    root = data.diamond[1].data
    table = new driverUtil.Table {
      root
      query
    }

    test.deepEqual(["Cut", "Count"], table.columns, "Columns of the table is incorrect")
    test.deepEqual([
      { Count: 1, Cut: 'A' }
      { Count: 2, Cut: 'B' }
      { Count: 3, Cut: 'C' }
      { Count: 4, Cut: 'D' }
      { Count: 5, Cut: 'E' }
      { Count: 6, Cut: 'F"' }
    ], table.data, "Data of the table is incorrect")
    test.deepEqual('"Cut","Count"\r\n"A","1"\r\n"B","2"\r\n"C","3"\r\n"D","4"\r\n"E","5"\r\n"F\"\"","6"',
      table.toTabular(','),
      "CSV of the table is incorrect")
    test.deepEqual('"Cut"\t"Count"\r\n"A"\t"1"\r\n"B"\t"2"\r\n"C"\t"3"\r\n"D"\t"4"\r\n"E"\t"5"\r\n"F\"\""\t"6"',
      table.toTabular('\t'),
      "TSV of the table is incorrect")
    test.done()
    return

  "Inheriting properties": (test) ->
    test.expect(3)
    query = data.diamond[2].query
    root = data.diamond[2].data
    table = new driverUtil.Table {
      root
      query
    }

    test.deepEqual(["Carat", "Cut", "Count"], table.columns, "Columns of the table is incorrect")
    test.deepEqual(data.diamond[2].tabular, table.data, "Data of the table is incorrect")
    test.deepEqual(data.diamond[2].csv, table.toTabular(','), "CSV of the table is incorrect")
    test.done()
    return
}

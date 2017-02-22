let pagedFind = require('./pagedFind')
let EventEmitter = require('events').EventEmitter

class BaseQueryService extends EventEmitter {
  constructor (collection, options) {
    super()
    this._collection = collection
    this._options = options || {}
  }

  get name () {
    return this._options.name
  }

  find (query, options) {
    options = options || {}

    return pagedFind(this._collection, query, options)
  }

  /**
  * Format data return by the find/findOne methods
  * Singular resources returned as {client: {}}
  * Plural resources returned as {client: {}, meta: {pages, total}}
  **/
  formatApiResponse (dbResult) {
    let response = {}
    if (dbResult instanceof Array) {
      response.meta = {}
      response[this.name()] = dbResult
    // list response always have results array
    } else if (dbResult.results instanceof Array) {
      response.meta = dbResult.meta || {}
      response[this.name()] = dbResult.results
    } else {
      response[this.name()] = dbResult
    }

    return response
  }

  findOne (query, options) {
    return this.find(query, options)
      .then((data) => {
        if (data.results.length > 1) {
          throw new Error(`findOne: More than one document return for query ${query}`)
        }
        return data.results.length === 1 ? data.results[0] : null
      })
  }

  count (query, options) {
    return this._collection.countAsync(query)
  }

  exists (query, options) {
    return this.count(query)
      .then((count) => {
        return count > 0
      })
  }

  aggregate (query) {
    return this._collection.aggregateAsync(query)
  }

  findByIds (tenantId, ids) {
    if (ids.length) {
      let clientsQuery = {
        TenantId: tenantId,
        _id: { $in: ids }
      }
      return this.find(clientsQuery, { noLimit: true })
    } else {
      return {
        results: []
      }
    }
  }

  findById (tenantId, id) {
    let caseQuery = {
      _id: id,
      TenantId: tenantId
    }
    return this.findOne(caseQuery)
  }
}

module.exports = BaseQueryService

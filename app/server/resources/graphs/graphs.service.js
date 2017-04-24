const db = require('../../db')

const constants = require('./graphs.constants')

let service = db.createQueryService('graphs')

/**
 * Get list of all graphs
 * @return {Promise}
 */
service.list = () => {
  return service.find({}, { noLimit: true })
}

/**
 * Get list of defaulf graps
 * @return {object[]}
 */
service.defaultGraphs = () => {
  return constants.graphs
}

module.exports = service

const ObjectID = require('mongoskin').ObjectID

exports.generate = function () {
  return ObjectID().toString()
}

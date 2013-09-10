
var worker = require('./worker')
  , runner = require('./runner')
  , provider = require('./provider')
  , webapp = require('./webapp')

/*
On a grand scale, the things that plugins should be able to do:
// app startup / plugin refresh
- add routes
- attach global listeners
- extend models
*/

module.exports = Loader

function Loader() {
  this.types = [worker, runner, provider, webapp]
  this.extensions = {}
}

Loader.prototype = {
  // find all extensions in dirs and organize them, requiring the
  // referenced files
  findExtensions: function (dirs, done) {
    utils.findExtensions(dirs, function (extensions) {
      var type
        , fname
      for (var i=0; i<this.types.length; i++) {
        type = this.types[i]
        this.extensions[type.name] = {}
        for (var i=0; i<extensions.length; i++) {
          fname = extensions[i][type.name]
          if (!fname) continue
          fname = path.resolve(path.join(extensions[i].dir, fname))
          try {
            this.extensions[type.name][extensions[i].id] = require(fname)
          } catch (e) {
            throw new Error('Failed to load ' + type.name + ' plugin "' + extensions[i].id + '"')
          }
        }
      }
    })
  }
}

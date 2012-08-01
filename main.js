//
// Loader for Strider extension modules.
//

var fs = require('fs'),
    path = require('path'),
    Step = require('step');


//
// ### Locate Strider Extensions
//
// Under a specified path **dir** [by default, process.cwd()/node_modules] look
// for directories containing file 'strider.json'.  These are considered
// Strider modules.
//
// **cb** is a function of signature cb(err, extensions) where extensions is an
// array of filesystems path on success and err is an error on failure.
//
function findExtensions(dir, cb) {

  var dir = dir || path.join(process.cwd(), "node_modules");

  var filename = "strider.json";

  var extensions = [];

  Step(
    function() {
        fs.readdir(dir, this);
    },
    function(err, entries) {
      if (err) {
        throw err;
      }
      var group = this.group();
      entries.forEach(function(module) {
        var p = path.join(dir, module, filename);
        var cb = group();
        fs.stat(p, function(err, stat) {
          cb(err,
            {stat:stat, path:p});
        });
      });
    },
    function(err, results) {
      results.forEach(function(r) {
        if (!r.stat) {
          return;
        }
        if (r.stat.isFile()) {
          extensions.push(r.path);
        }
      });
      cb(err, extensions);
    }
  );
}

//
//### Load a Strider extension
//
// **filename** is a filesystem location to a strider.json file. Extension is
// assumed to be contained in same directory as strider.json.
//
// **cb** is a function of signature function(err, extension) where extension
// is an extension object on success and err is an error on failure.
//
// Note that this function does not initialize the extension.
// 
function loadExtension(filename, cb) {
  Step(
    function() {
      fs.readFile(filename, this);
    },
    function(err, data) {
      if (err) {
        return cb(err, null);
      }
      try {
        var extensionConfig = JSON.parse(data);
      } catch(e) {
        return cb(e, null);
      }
      var extension = {
        webapp: require(filename.replace('strider.json', extensionConfig.webapp)),
        worker: require(filename.replace('strider.json', extensionConfig.worker)),
      };

      cb(null, extension);
    }
  );
}

module.exports = {
  findExtensions: findExtensions,
  loadExtension: loadExtension
};

//
// Loader for Strider extension modules.
//

var fs = require('fs'),
    path = require('path'),
    Step = require('step');


//
// ### Locate Strider Extensions
//
// Under a specified path **dir** look for directories containing file
// 'strider.json'.  These are considered Strider modules.
//
// **cb** is a function of signature cb(err, extensions) where extensions is an
// array of filesystems path on success and err is an error on failure.
//
function findExtensions(dir, cb) {

  var filename = "strider.json";

  var extensions = [];

  Step(
    function() {
      // find top-level module dirs
        fs.readdir(dir, this);
    },
    function(err, entries) {
      if (err) {
        throw err;
      }
      // Stat extension files in parallel
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
        // Ensure they are of type file not something else
        if (r.stat.isFile()) {
          extensions.push(r.path);
        }
      });
      cb(null, extensions);
    }
  );
}

//
//### Load a Strider extension
//
// **moduleDir* is a directory containing a strider.json file and a package.json file.
//
// **cb** is a function of signature function(err, extension) where extension
// is an extension object on success and err is an error on failure.
//
// Note that this function does not initialize the extension.
// 
function loadExtension(moduleDir, cb) {
  Step(
    function() {
      var striderFile = path.join(moduleDir, "strider.json");
      var packageFile = path.join(moduleDir, "package.json");
      fs.readFile(striderFile, this.parallel());
      fs.readFile(packageFile, this.parallel());
    },
    function(err, striderData, packageData) {
      if (err) {
        return cb(err, null);
      }
      // Parse extension JSON
      try {
        var extensionConfig = JSON.parse(striderData);
        var packageConfig = JSON.parse(packageData);
      } catch(e) {
        return cb(e, null);
      }
      var extension = {
        package: packageConfig
      };
      if (extensionConfig.webapp) {
        var webapp = extensionConfig.webapp;
        extension.webapp = require(path.resolve(path.join(moduleDir, webapp)));
      }
      if (extensionConfig.worker) {
        var worker = extensionConfig.worker;
        extension.worker = require(path.resolve(path.join(moduleDir, worker)));
      }

      cb(null, extension);
    }
  );
}

// Exported functions
module.exports = {
  findExtensions: findExtensions,
  loadExtension: loadExtension,
};

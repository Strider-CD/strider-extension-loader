//
// Loader for Strider extension modules.
//

var connect = require('connect'),
    fs = require('fs'),
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
            {stat:stat, path:path.join(dir, module)});
        });
      });
    },
    function(err, results) {
      if (!results)
        results = [];

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

//
// ### Initialize Strider Extensions
//
// Find, load and initialize extenions of type ***type*** under extension
// directory ***extdir*** ***type*** may be one of "webapp" or "worker".
//
// Context should be a Strider context object with keys:
//  - config (strider config object)
//  - emitter (global eventemitter)
//  - extensionRoutes (list of webapp routes)
//  - registerTransportMiddleware (function)
//
// ***appInstance*** should be an ExpressJS app instance, and is only needed
// for webapp extensions. Can be left null/undefined for worker extensions.
//
// ***cb*** is a callback to be executed when all modules are initialized.
//
function initExtensions(extdir, type, context, appInstance, cb) {
  Step(
    function() {
      console.log("Looking for %s-type extensions under %s", type, extdir);
      findExtensions(extdir, this);
    },
    function(err, extensions) {
      var group = this.group();
      extensions.forEach(function(ext) {
        var cb = group();
        loadExtension(ext, function(err, res) {
          cb(err, {ext:res, dir:ext});
        });
      });
    },
    function(err, loaded) {
      if (err) {
        console.error("Error loading extension: %s", err);
        process.exit(1);
      }
      // now to initialize
      var self = this;
      loaded.forEach(function(l) {
        if (l.ext === null || !l.ext[type]) {
          return;
        }
        // Keep track of which extensions are using which routes.
        // Put this here to allow use of a closure over path and extension.
        if (type === 'webapp') {
          // Extensions should use context.route.<method>() to add routes
          context.route = {
            get:function(p, f) {
              context.extensionRoutes.push(
                {method:"get", path:p, extension:l.dir});
              appInstance.get(p, f);
            },
            post:function(p, f) {
              context.extensionRoutes.push(
                {method:"post", path:p, extension:l.dir});
              appInstance.post(p, f);
            },
            delete:function(p, f) {
              context.extensionRoutes.push(
                {method:"delete", path:p, extension:l.dir});
              appInstance.delete(p, f);
            },
            put:function(p, f) {
              context.extensionRoutes.push(
                {method:"put", path:p, extension:l.dir});
              appInstance.put(p, f);
            }
          };
          // Add a static fileserver mounted at /ext/$module/ which maps to
          // moduledir/static
          appInstance.use('/ext/' + path.basename(l.dir),
              connect.static(path.join(l.dir), "static"));
        }
        if (type === 'worker' && typeof(l.ext.worker) === 'function') {
          l.ext.worker(context, self.parallel());
        }
        if (type === 'webapp' && typeof(l.ext.webapp) === 'function') {
          l.ext.webapp(context, self.parallel());
        }
      });
      if (loaded.length === 0) {
        // Bit odd, but necessary.
        this(null, []);
      }
    },
    function(err, initialized) {
      if (err) {
        console.log("Error loading extensions: %s", err);
        process.exit(1);
      }
      cb(null, initialized);
    }
  );
}


// Exported functions
module.exports = {
  findExtensions: findExtensions,
  initExtensions: initExtensions,
  loadExtension: loadExtension,
};

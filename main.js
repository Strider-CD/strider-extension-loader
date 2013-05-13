//
// Loader for Strider extension modules.
//

var async = require('async'),
    connect = require('connect'),
    fs = require('fs'),
    path = require('path'),
    Step = require('step');


//
// ### Locate Strider Extensions
//
// Under a specified path **dir** look for directories containing file
// 'strider.json'.  These are considered Strider modules. **dir** may be either a string or a list of strings.
//
// **cb** is a function of signature cb(err, extensions) where extensions is an
// array of filesystems path on success and err is an error on failure.
//
function findExtensions(dir, cb) {

  var filename = "strider.json";

  var extensions = [];

  // fs.readdir list of paths in parallel.
  // used when `dir` arg is an array.
  function readEntries(dirs, cb) {
    var funcs = []
    dirs.forEach(function(dir) {
      funcs.push(function(c) {
        fs.readdir(dir, function(err, entries) {
          var l = [];
          entries.forEach(function(entry) {
            l.push(path.join(dir, entry))
          })
          c(err, l)
        })
      })
    })
    async.parallel(funcs, function(err, results) {
        if (err) {
          return cb(err, null);
        }
        // Flatten results and return
        var flat = [].concat.apply([], results);
        cb(null, flat);
      }
    );
  }

  Step(
    function() {
      // find top-level module dirs
      if (Array.isArray(dir)) {
        // dir is a list of paths
        readEntries(dir, this)
      } else {
        // dir is a single path value
        var self = this;
        fs.readdir(dir, function(err, entries) {
          if (err || !entries) {
            return self(err, entries);
          }
          var l = [];
          entries.forEach(function(entry) {
            l.push(path.join(dir, entry))
          });
          self(err, l);
        });
      }
    },
    function(err, entries) {
      if (err) {
        throw err;
      }
      // Stat extension files in parallel
      var group = this.group();
      entries.forEach(function(module) {
        var p = path.join(module, filename);
        var cb = group();
        fs.stat(p, function(err, stat) {
          cb(err,
            {stat:stat, path:module});
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



var parseStriderData = function(json, typ,  ext){
  ext.id = ext.id || ((typ == "package") ? json.name : json.id)

  ext[typ] = json;

  for (var i in json){
    ext[i] = json[i];
  }
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
      if (err) return cb(err, null);

      // Parse extension JSON
      try {
        var extensionConfig = JSON.parse(striderData);
        var packageConfig = JSON.parse(packageData);
      } catch(e) {
        return cb(e, null);
      }

      var extension = {};

      parseStriderData(packageConfig, "package", extension);
      parseStriderData(extensionConfig, "strider", extension);

      if (!extension.id){
        console.error("\n\nExtension loaded that has no id. Extensions now require ID's",
          "- check if you're running an out of date plugin or contact the plugin author")
        return cb("No ID in " + moduleDir)
      }

      // load workers, webapps

      extensionConfig = extension.strider || {}
      if (extensionConfig.webapp) {
        var webapp = extensionConfig.webapp;
        extension.webapp = require(path.resolve(path.join(moduleDir, webapp)));
      }
      if (extensionConfig.worker) {
        var worker = extensionConfig.worker;
        extension.worker = require(path.resolve(path.join(moduleDir, worker)));
      }
      if (extensionConfig.templates){
        extension.templates = extensionConfig.templates;
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
  var  templates = {}

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
      var initCount = 0

      // now to initialize
      var self = this

      for (var i=0; i < loaded.length; i++) {
        var l = loaded[i];
        if (l.ext === null) {
          continue;
        }
        // Keep track of which extensions are using which routes.
        // Put this here to allow use of a closure over path and extension.
        if (type === 'webapp') {
          // Extensions should use context.route.<method>() to add routes
          context.route = {
            get:function(p, f) {
              context.extensionRoutes.push(
                {method:"get", path:p, extension:l.dir});
              appInstance.get.apply(appInstance, arguments);
            },
            post:function(p, f) {
              context.extensionRoutes.push(
                {method:"post", path:p, extension:l.dir});
              appInstance.post.apply(appInstance, arguments);
            },
            delete:function(p, f) {
              context.extensionRoutes.push(
                {method:"delete", path:p, extension:l.dir});
              appInstance.delete.apply(appInstance, arguments);
            },
            put:function(p, f) {
              context.extensionRoutes.push(
                {method:"put", path:p, extension:l.dir});
              appInstance.put.apply(appInstance, arguments);
            }
          };
          // Add a static fileserver mounted at /ext/$module/ which maps to
          // moduledir/static
          appInstance.use('/ext/' + path.basename(l.dir),
              connect.static(path.join(l.dir, "static")));
        }
        if (type === 'worker' && typeof(l.ext.worker) === 'function') {
          l.ext.worker(context, self.parallel());
          initCount++;
        }
        if (type === 'webapp' && typeof(l.ext.webapp) === 'function') {
          l.ext.webapp(context, self.parallel());
          initCount++;
        }
        if (l.ext.templates){
          for (var k in l.ext.templates){
            templates[k] = l.ext.templates[k]
            
            if (/\.html/.test(l.ext.templates[k])){
              templates[k] = l.dir + '/' + l.ext.templates[k];
            } 
          }
        }
      }
      if (initCount === 0) {
        // Bit odd, but necessary.
        this(null, []);
      }
    },
    function(err, initialized) {
      if (err) {
        console.log("Error loading extensions: %s", err);
        process.exit(1);
      }
      cb(null, initialized, templates);
    }
  );
}


// Exported functions
module.exports = {
  findExtensions: findExtensions,
  initExtensions: initExtensions,
  loadExtension: loadExtension,
};

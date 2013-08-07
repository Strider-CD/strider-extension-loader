//
// Loader for Strider extension modules.
//

var async = require('async'),
    connect = require('connect'),
    fs = require('fs'),
    path = require('path'),
    Step = require('step');


// p is file ? return json content : false
var checkStatFile = function(p, cb){
  fs.stat(p, function(err, stat) {
    if (err){
      if (err.code == "ENOENT")
        return cb(null, false)
      return cb(err);
    }
    if (!stat){
      return cb(null, false)
    }
    if (!stat.isFile())
      return cb(null, false)

    // TODO catch bad json?
    var json = JSON.parse(fs.readFileSync(p, "utf8"));
    return cb(null, json);
  })
}

var checkStrider = function(pth, cb){
  checkStatFile(path.join(pth, "strider.json"), function(err, res){
    if (err) return cb(err);
    if (!res) return cb(null, false);

    if (!res.id){
      console.error("Error in module: ", pth, " : strider.json must include an 'id'")
    }
    var out = [res.id || pth, res]
    cb(err, out)
  })
}

var checkPackageJson = function(pth, cb){
  var p = path.join(pth, "package.json")
  checkStatFile(p, function(err, exists){
    if (!err) return cb(err);
    if (!exists || !exists.strider) return cb(null, false);
    var res = [exists.name, exists.strider]
    return cb(null, res);
  })
}

var checkModule = function(pth, cb){
  checkStrider(pth, function(err, res){
    if (err) return cb(err);
    if (res) return cb(null, res)

    checkPackageJson(pth, function(err, res){
      if (err) return cb(err);
      if (res) return cb(null, res)

      return cb(null, false)
    })
  
  })
}

//
// ### Locate Strider Extensions
//
// Under a specified path **dir** look for directories containing file
// 'strider.json'.  These are considered Strider modules. **dir** may be either a string or a list of strings.
//
// Or look for package.json with a "strider" key inside. (Preferred way now)
//
// **cb** is a function of signature cb(err, extensions) where extensions is an
// {id : config} mapping on success and err is an error on failure.
//
function findExtensions(dir, cb) {

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
        var cb = group();
        checkModule(module, function(err, ext){
          if (ext){
            var out = ext[1]
            out.weight = out.weight || -1
            out.typ= "json"
            out.id = out.id || ext[0] || out.name
            out.dir = module
            extensions.push(out)
            return cb(null, out)
          }
          cb(err, false)
        })
      });
    }, function(err, bleh){
      if (err) return cb(err)
      cb(null, extensions);
    })
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
    function(err, loaded) {
      if (err) {
        console.error("Error loading extension: %s", err);
        process.exit(1);
      }
      var initCount = 0

      // now to initialize
      var self = this
      // Sort by weight
      loaded = loaded.sort(function (a, b) { return a.weight - b.weight; });
      for (var i=0; i < loaded.length; i++) {
        var l = loaded[i];
        // Keep track of which extensions are using which routes.
        // Put this here to allow use of a closure over path and extension.
        if (l.webapp) {
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
          try {
            l.ext.worker(context, self.parallel());
          } catch (e) {
            console.log("Error loading extension: %s in directory: %s", e, l.dir)
            process.exit(1)
          }
          initCount++;
        }
        if (type === 'webapp' && typeof(l.webapp) === 'function') {
          try {
            l.webapp(context, self.parallel());
          } catch (e) {
            console.log("Error loading extension: %s in directory: %s", e, l.dir)
            process.exit(1)
          }
          initCount++;
        }
        if (l.templates){
          for (var k in l.templates){
            templates[k] = l.templates[k]
            
            if (/\.html/.test(l.templates[k])){
              templates[k] = l.dir + '/' + l.templates[k];
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
};

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
    if (res){
      res[1].dir = pth;
      return cb(null, res)
    }

    checkPackageJson(pth, function(err, res){
      if (err) return cb(err);
      if (res){
        res[1].dir = pth
        return cb(null, res)
      }

      return cb(null, false)
    })
  
  })
}

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

var findModuleDirs = function(dir, cb) {
    // find top-level module dirs
    if (Array.isArray(dir)) {
      // dir is a list of paths
      readEntries(dir, cb)
    } else {
      // dir is a single path value
      fs.readdir(dir, function(err, entries) {
        if (err || !entries) {
          return cb(err, entries);
        }
        var l = [];
        entries.forEach(function(entry) {
          l.push(path.join(dir, entry))
        });
        cb(err, l);
      });
    }
}

var checkModules = function(modules, cb){
  async.map(modules || [], checkModule, cb);
}

var parseModules = function(modules, cb){
  var extensions = []
  modules.forEach(function(module){
    if (module){
      var out = module[1]
      out.weight = out.weight || -1
      out.typ= "json"
      out.id = out.id || module[0] || out.name
      extensions.push(out)
    }
  })
  return cb(null, extensions)
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


  findModuleDirs(dir, function(err, modules){
    checkModules(modules, function(err, extensions){
      parseModules(extensions, cb);
    })
  })
}


var fail = function(msg){
  console.error("Error loading extension: %s", err);
  process.exit(1);
}


var findAndSortExtensions = function(dir, cb){
  findExtensions(dir, function(err, loaded){
    if (err) return cb(err);

    // Sort by weight
    loaded = loaded.sort(function (a, b) { return a.weight - b.weight; });
    cb(null, loaded);
  });

}

var initWorker = function(l, context, cb){
  if (typeof(l.worker) === 'string') {
      l.worker = require(path.resolve(path.join(l.dir, l.worker)))
      l.worker = l.worker.worker || l.worker

    if (typeof(l.worker) === 'function') {
      try {
        l.worker(context, cb);
      } catch (e) {
        console.log("Error loading extension: %s in directory: %s", e, l.dir)
        process.exit(1)
      }
    } else {
      console.log("!! WORKER ISNT A FUNCTION", l)
    }
  } else {
    cb(null, null)
  }
}

var initWorkerExtensions = function(dir, ctx, cb){
  console.log("Looking for worker extensions under %s", dir);
  findAndSortExtensions(dir, function(err, loaded){
    if (err) return fail(err);

    var initWorkerCurried = function(l, cb){
      return initWorker(l, ctx, cb);
    }

    async.map(loaded, initWorkerCurried, function(err, loaded){
      cb(null, loaded || []);
    })
  })
}



var contextRoute = function(context, appInstance, l){
  return {
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
  }
};

var initWebAppExtensions = function(dir, context, appInstance, cb){

  var initWebApp = function(l, cb){
    if (l.webapp) {
      l.webapp = require(path.resolve(path.join(l.dir, l.webapp)))
      l.webapp = l.webapp.webapp || l.webapp

      // Extensions should use context.route.<method>() to add routes
      context.route = contextRoute(context, appInstance, l)

      // Add a static fileserver mounted at /ext/$module/ which maps to
      // moduledir/static
      appInstance.use('/ext/' + path.basename(l.dir),
          connect.static(path.join(l.dir, "static")));
    }

    if (l.templates){
      for (var k in l.templates){
        templates[k] = l.templates[k]

        if (/\.html/.test(l.templates[k])){
          templates[k] = l.dir + '/' + l.templates[k];
        }
      }
    }

    if (typeof(l.webapp) === 'function') {
      try {
        return l.webapp(context, cb);
      } catch (e) {
        fail("error loading extension: %s in directory: %s", e, l.dir)
      }
    } else {
      if (l.webapp){
        console.log("!! WEBAPP ISNT FUNCTION", l)
        cb(1)
      } else {
        return cb(null)
      }
    }
  }


  console.log("looking for webapp extensions under %s", dir);
  findAndSortExtensions(dir, function(err, loaded){
    if (err) return fail(err);
    async.map(loaded, initWebApp, function(err, loaded){
      cb(null, loaded || []);
    })
  })
}


// Exported functions
module.exports = {

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
//
  initWorkerExtensions : initWorkerExtensions,
  initWebAppExtensions: initWebAppExtensions,

  // Exposed only for unit tests...
  _findExtensions: findExtensions,
};

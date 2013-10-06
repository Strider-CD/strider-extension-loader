
var path = require('path')
  , fs = require('fs')

  , less = require('less')
  , async = require('async')

module.exports = {
  checkStatFile: checkStatFile,
  checkStrider: checkStrider,
  checkPackageJson: checkPackageJson,
  checkModule: checkModule,
  readDirAbs: readDirAbs,
  readDirsParallel: readDirsParallel,
  readDirs: readDirs,
  checkModules: checkModules,
  parseModules: parseModules,
  findExtensions: findExtensions,
  findAndSortExtensions: findAndSortExtensions,
  getConfig: getConfig
}

// config: {template: , style: , script: }
// done(html, css, js)
function getConfig(id, basedir, config, name, done) {
  if (arguments.length === 4) {
    done = name
    name = 'config'
  }
  async.parallel({
    html: function (next) {
      var failhard = !!config.template
      fs.readFile(path.join(basedir, config.template || 'config/' + name + '.html'), 'utf8', function (err, data) {
        next(failhard && err, data)
      })
    },
    js: function (next) {
      var failhard = !!config.script
      fs.readFile(path.join(basedir, config.script || 'config/' + name + '.js'), 'utf8', function (err, text) {
        if (!failhard && err) return next(null, '')
        next(err, text + '\n//# sourceUrl=' + id + '/' + path.join(basedir, config.script || 'config/' + name + '.js') + '\n')
      })
    },
    css: function (next) {
      var failhard = !!config.style
      fs.readFile(path.join(basedir, config.style || name + '.less'), 'utf8', function (err, text) {
        if (!failhard && err) return next(null, '')
        var source = '\n/** source: ' + id + '/' + config.style + '**/\n'
        if (err) return next(err)
        if (config.style.slice(-5) !== '.less') {
          return next(null, text + source)
        }
        var fpath = path.join(basedir, config.style || name + '.less')
        new (less.Parser)({
          paths: [path.dirname(fpath)],
          filename: fpath
        }).parse(text, function (err, tree) {
          if (err) return next(err)
          next(null, tree.toCSS() + source)
        })
      })
    }
  }, function (err, data) {
    return done(err, data.html, data.css, data.js)
  })
}

// p is file ? return json content : false
function checkStatFile(p, cb) {
  var fullPath = path.resolve(p)
    , json
  try {
    json = require(fullPath)
  } catch (e) {
    if (e.code == "MODULE_NOT_FOUND") {
      return cb(null,false);
    } else {
      console.error('require("' + fullPath + '") failed', e)
      return cb(e)
    }
  }
  return cb(null, json)
}

// checkStrider(pth, cb) -> cb(err, config)
// Check for strider.json. config === false if the file is not present
function checkStrider(pth, cb) {
  checkStatFile(path.join(pth, 'strider.json'), function(err, config){
    if (err) return cb(err);
    if (!config) return cb(null, false);
    if (!config.id){
      console.error("Error in module: ", pth, " : strider.json must include an 'id'")
      return cb(null, false)
    }
    cb(null, config)
  })
}

// checkPackageJson(pth, cb) -> cb(err, config)
// config is the strider section of the package.json or false
// config.id defaults to the name of the package
function checkPackageJson(pth, cb) {
  var p = path.join(pth, "package.json")
  checkStatFile(p, function(err, pack){
    if (err) return cb(err);
    if (!pack || !pack.strider) return cb(null, false)
    if (!pack.strider.id) {
      pack.strider.id = pack.name
    }
    return cb(null, pack.strider);
  })
}

// check for strider extension config in either strider.json or package.json
function checkModule(pth, cb) {
  checkStrider(pth, function(err, config){
    if (err) return cb(err);
    if (config){
      config.dir = pth
      return cb(null, config)
    }
    checkPackageJson(pth, function(err, config){
      if (err) return cb(err);
      if (config){
        config.dir = pth
        return cb(null, config)
      }
      return cb(null, false)
    })
  })
}

// return abs paths
function readDirAbs(dir, cb) {
  fs.readdir(dir, function(err, entries) {
    if (err || !entries) {
      return cb(err, null);
    }
    var items = [];
    entries.forEach(function(entry) {
      items.push(path.join(dir, entry))
    });
    return cb(null, items);
  });
}

// fs.readdir list of paths in parallel.
// used when `dir` arg is an array.
function readDirsParallel(dirs, cb) {
  var funcs = []
  dirs.forEach(function(dir) {
    funcs.push(readDirAbs.bind(null, dir));
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

// Get the contents of one or more directories
// if dir is an array, do this in parrallel.
function readDirs(dir, cb)  {
  // find top-level module dirs
  if (Array.isArray(dir)) {
    // dir is a list of paths
    readDirsParallel(dir, cb)
  } else {
    // dir is a single path value
    readDirAbs(dir, cb)
  }
}

function checkModules(modules, cb) {
  async.map(modules || [], checkModule, cb);
}

function parseModules(modules, cb) {
  var extensions = []
  modules.forEach(function(module){
    if (module){
      module.weight = module.weight || -1
      // what does this do?
      module.typ = "json"
      extensions.push(module)
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
  readDirs(dir, function(err, modules){
    checkModules(modules, function(err, extensions){
      parseModules(extensions, cb);
    })
  })
}

function findAndSortExtensions(dir, cb) {
  findExtensions(dir, function(err, loaded){
    if (err) return cb(err);

    // Sort by weight
    loaded = loaded.sort(function (a, b) { return a.weight - b.weight; });
    cb(null, loaded);
  });
}

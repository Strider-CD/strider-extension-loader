
var job = require('./job')
  , runner = require('./runner')
  , provider = require('./provider')
  , basic = require('./basic')

/*
On a grand scale, the things that plugins should be able to do:
// app startup / plugin refresh
- add routes
- attach global listeners
- extend models
*/

module.exports = Loader

function Loader() {
  this.types = {
    'job': job,
    'runner': runner,
    'provider': provider,
    'basic': basic
  }
  this.ids = {}
  this.extensions = {
    job: {},
    runner: {},
    provider: {},
    basic: {}
  }
}

Loader.prototype = {
  // find all extensions in dirs and organize them by type
  // load from `strider.json` or package.json's `strider` section
  collectExtensions: function (dirs, done) {
    var self = this
    utils.findExtensions(dirs, function (err, extensions) {
      if (err) return done(err)
      var type
        , fname
      for (var i=0; i<extensions.length; i++) {
        extensions[i].type = extensions[i].type || 'basic'
        if (self.ids[extensions[i].id]) {
          // XXX should we die hard, ignore, or warn?
          return done(new Error('Duplicate extension id! Your plugins are misconfigured.'))
        }
        self.ids[extensions[i].id] = true
        self.extensions[extensions[i].type][extensions[i].id] = extensions[i]
      }
      done()
    })
  },

  // initialize the "webapp" sections of all plugins.
  // initialization depends on the plugin type. See job.js,
  // provider.js, runner.js, basic.js
  initWebAppExtensions: function (context, done) {
    this.initExtensions('webapp', context, done)
  },

  // initialize the "webapp" sections of all plugins.
  // initialization depends on the plugin type. See job.js,
  // provider.js, runner.js, basic.js
  initWorkerExtensions: function (context, done) {
    this.initExtensions('worker', context, done)
  },

  // initTemplates(done) -> done(err, { "tplname": "template text", ... })
  //
  // find templates defined by plugins' strider.json config
  // looks like:
  // "templates": {
  //    "filetplname": "path/to/tpl.html",
  //    "inlinetplname": "<div>Hi</div>",
  //    ...
  // }
  // Template values that end in ".html" will be read from disk
  // relative to the plugin directory
  initTemplates: function (done) {
    var templates = {}
      , self = this
    this.allExtensions(function (type, id, plugin, next) {
      var tasks = []
      if (!plugin.templates) return next()
      for (var tpl in plugin.templates) {
        templates[tpl] = plugin.templates[tpl]
        if (!/\.html$/.test(plugin.templates[tpl])) continue

        var fname = path.join(plugin.dir, plugin.templates[tpl]);
        tasks.push(function (tpl, fname, next) {
          fs.readFile(fname, 'utf8', function (err, data) {
            if (err) return next(err)
            templates[tpl] = data
            next()
          })
        }.bind(tpl, fname))
      }
      if (!tasks.length) return next()
      async.parallel(tasks, next)
    }, function (err) {
      done(err, templates)
    })
  },

  // initStaticDirs(app, done) -> done(err)
  // go through webapp extensions and if `plugindir/static` is a
  // directory, serve up files under the path `/ext/pluginid`
  initStaticDirs: function (app, done) {
    var self = this
    this.allExtensions(function (type, id, plugin, next) {
      var staticDir = path.join(plugin.dir, 'static')
      fs.stat(staticDir, function (err, stat) {
        if (err || !stat || !stat.isDirectory()) return next()
        app.use('/ext/' + id, connect.static(staticDir))
        next()
      })
    }, done)
  },

  // Collect html, css and js from all plugins and compile the css and
  // js, writing it to @jspath and @csspath
  // done(err)
  initConfig: function (jspath, csspath, done) {
    var alljs = []
      , allcss = []
      , configs = {}
    this.allExtensions(function (type, id, plugin, next) {
      if (!plugin.config) return;
      if (!configs[type]) configs[type] = {}
      if (plugin.config === true) {
        plugin.config = {
          template: 'config/config.html',
          script: 'config/config.js',
          style: 'config/config.less'
        }
      }
      if (!plugin.config.controller) {
        plugin.config.controller = id[0].toUpperCase() + id.slice(1) + 'Controller'
      }
      plugin.config.title = plugin.title
      configs[type][id] = plugin.config
      utils.getConfig(id, plugin.config, function (err, html, css, js) {
        if (err) return next(err)
        plugin.config.html = html
        alljs.push(js)
        allcss.push(css)
      })
    }, function (err) {
      if (err) return done(err, configs)
      // wrap our javascripts
      var jspref = ';(function (angular) {\n'
        , jspost = '\n})(angular);\n'
        , jstext = jspref + alljs.join(jspost + jspref) + jspost
        , csstext = allcss.join('\n\n')
      fs.writeFile(jspath, jstext, 'utf8', function (err) {
        fs.writeFile(csspath, csstext, 'utf8', function (cerr) {
          done(err || cerr, configs)
        })
      })
    })
  },

  // private

  // initExtensions(subtype, context, done) -> done(err, {type: {id: retval, ...}, ...})
  // For each plugin
  //   this.types[type][subtype](id, plugin, context, next(err, retval))
  initExtensions: function (subtype, context, done) {
    var types = this.types
      , loaded = {}
    this.allExtensions(function (type, id, plugin, next) {
      if (!plugin[subtype]) return next()
      if ('string' === typeof plugin[subtype]) {
        try {
          plugin[subtype] = require(path.resolve(path.join(plugin.dir, plugin[subtype])))
        } catch (e) {
          e.message += '; error loading plugin ' + id
          return next(e)
        }
      }

      if (!loaded[type]) loaded[type] = {}
      if (!types[type][subtype]) {
        loaded[type][id] = plugin[subtype]
        return next()
      }
      types[type][subtype](id, plugin[subtype], context, function (err, initialized) {
        loaded[type][id] = initialized
        next(err)
      })
    }, function (err) {
      done(err, loaded)
    })
  },

  // allExtensions(each, done) -> done(err, [val, ...])
  // call `each(type, id, plugin, next(err, val))` for each plugin in parallel
  allExtensions: function (each, done) {
    var self = this
      , tasks = []
    Object.keys(this.extensions).forEach(function (type) {
      Object.keys(self.extensions[type]).forEach(function (id) {
        var plugin = self.extensions[type][id]
        tasks.push(function (next) {
          each(type, id, plugin, next)
        })
      })
    })
    async.parallel(tasks, done)
  }
}

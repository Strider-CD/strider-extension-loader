'use strict';

var job = require('./job')
  , runner = require('./runner')
  , provider = require('./provider')
  , basic = require('./basic')
  , utils = require('./utils')

  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , serveStatic = require('serve-static')

  , RESERVED = ['provider', 'config', 'api'];

/*
On a grand scale, the things that plugins should be able to do:
// app startup / plugin refresh
- add routes
- attach global listeners
- extend models
*/

module.exports = Loader;

function Loader(lesspaths, isNamespaced) {
  this.isNamespaced = isNamespaced;
  this.types = {
    'job': job,
    'runner': runner,
    'provider': provider,
    'basic': basic
  };
  this.ids = {};
  this.lesspaths = lesspaths || [];
  this.extensions = {
    job: {},
    runner: {},
    provider: {},
    basic: {}
  };
}

Loader.prototype = {
  // find all extensions in dirs and organize them by type
  // load from `strider.json` or package.json's `strider` section
  collectExtensions: function (dirs, done) {
    var self = this;
    utils.findExtensions(dirs, function (err, extensions) {
      if (err) return done(err);

      for (var i = 0; i < extensions.length; i++) {
        extensions[i].type = extensions[i].type || 'basic';
        extensions[i].id = extensions[i].id.toLowerCase();
        if (RESERVED.indexOf(extensions[i].id) !== -1) {
          return done(new Error('Extension id "' + extensions[i].id + '" is reserved. Your plugins are misconfigured.'));
        }
        if (self.ids[extensions[i].id]) {
          // XXX should we die hard, ignore, or warn?
          return done(new Error('Duplicate extension id! Your plugins are misconfigured.'));
        }
        self.ids[extensions[i].id] = true;
        self.extensions[extensions[i].type][extensions[i].id] = extensions[i];
      }
      done();
    });
  },

  // initialize the "webapp" sections of all plugins.
  // initialization depends on the plugin type. See job.js,
  // provider.js, runner.js, basic.js
  initWebAppExtensions: function (context, done) {
    this.initExtensions('webapp', context, done);
  },

  // initialize the "webapp" sections of all plugins.
  // initialization depends on the plugin type. See job.js,
  // provider.js, runner.js, basic.js
  initWorkerExtensions: function (context, done) {
    this.initExtensions('worker', context, done);
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
    var templates = {};

    this.allExtensions(function (type, id, plugin, next) {
      var tasks = [];
      if (!plugin.templates) return next();
      var task = function (tpl, fname, next) {
        fs.readFile(fname, 'utf8', function (err, data) {
          if (err) return next(err);
          templates[tpl] = data;
          next();
        });
      };
      for (var tpl in plugin.templates) {
        templates[tpl] = plugin.templates[tpl];
        if (!/\.html$/.test(plugin.templates[tpl])) continue;

        var fname = path.join(plugin.dir, plugin.templates[tpl]);
        tasks.push(task.bind(tpl, fname));
      }
      if (!tasks.length) return next();
      async.parallel(tasks, next);
    }, function (err) {
      done(err, templates);
    });
  },

  // initStaticDirs(app, done) -> done(err)
  // go through webapp extensions and if `plugindir/static` is a
  // directory, serve up files under the path `/ext/pluginid`
  initStaticDirs: function (app, done) {
    this.allExtensions(function (type, id, plugin, next) {
      var staticDir = path.join(plugin.dir, 'static');
      fs.stat(staticDir, function (err, stat) {
        if (err || !stat || !stat.isDirectory()) return next();
        app.use('/ext/' + id, serveStatic(staticDir));
        next();
      });
    }, done);
  },

  // Collect html, css and js from all plugins and compile the css and
  // js, writing it to @jspath and @csspath
  // done(err)
  initConfig: function (jspath, csspath, done) {
    if (arguments.length === 1) {
      done = jspath;
      jspath = csspath = null;
    }
    var alljs = []
      , allcss = []
      , configs = {}
      , self = this;

    this.allExtensions(function (type, id, plugin, next) {
      var namespace = self.isNamespaced ? 'Config.' : '';

      if (!plugin.config) {
        plugin.config = {};
      }
      if (!configs[type]) configs[type] = {};
      if (plugin.config === true) {
        plugin.config = {
          savebtn: true
        };
      }
      plugin.config = Object.assign({
        controller: namespace + type[0].toUpperCase() + type.slice(1) + 'Controller',
        /* Defaults. If they don't exist, however, no error is thrown.
        template: 'config/config.html',
        script: 'config/config.js',
        style: 'config/config.less',
        */
        icon: plugin.icon,
        title: plugin.title || id,
        id: id
      }, plugin.config);

      configs[type][id] = plugin.config;
      utils.getStatic(id, plugin.dir, plugin.config, self.lesspaths, function (err, html, css, js) {
        if (err) return next(err);
        plugin.config.html = html || '<h3>This plugin does not require any configuration</h3>';
        alljs.push(js);
        allcss.push(css);
        next();
      });
    }, function (err) {
      if (err) return done(err, configs);
      // wrap our javascripts
      var jstop = '// GENERATED from the plugins\' config files. Do not modify - go to the source.\n' +
                  '/* jshint undef: false */\n\n'
        , jspref = ';(function (angular) {\n'
        , jspost = '\n})(angular);\n'
        , jstext = jstop + jspref + alljs.join(jspost + jspref) + jspost
        , csstext = allcss.join('\n\n');
      if (jspath === null && csspath === null) {
        return done(null, jstext, csstext, configs);
      }
      fs.writeFile(jspath, jstext, 'utf8', function (err) {
        fs.writeFile(csspath, csstext, 'utf8', function (cerr) {
          done(err || cerr, configs);
        });
      });
    });
  },

  initUserConfig: function (jspath, csspath, done) {
    if (arguments.length === 1) {
      done = jspath;
      jspath = csspath = null;
    }
    var alljs = []
      , allcss = []
      , configs = {}
      , types = this.types
      , self = this;
    this.allExtensions(function (type, id, plugin, next) {
      var namespace = self.isNamespaced ? 'Account.' : '';
      var name = types[type].userConfig || 'user';
      var config = name + 'Config';

      if (!plugin[config]) return next();
      if (!configs[type]) configs[type] = {};
      if (plugin[config] === true) {
        plugin[config] = {
          savebtn: true
        };
      }
      plugin[config] = Object.assign({
        controller: namespace + type[0].toUpperCase() + type.slice(1) + 'Controller',
        /* Defaults. If they don't exist, however, no error is thrown.
        template: 'config/user.html',
        script: 'config/user.js',
        style: 'config/user.less',
        */
        inline_icon: plugin.inline_icon,
        title: plugin.title,
        id: id
      }, plugin[config]);

      configs[type][id] = plugin[config];
      utils.getStatic(id, plugin.dir, plugin[config], name, self.lesspaths, function (err, html, css, js) {
        if (err) return next(err);
        plugin[config].html = html;
        alljs.push(js);
        allcss.push(css);
        next();
      });
    }, function (err) {
      if (err) return done(err, configs);
      // wrap our javascripts
      var jstop = '// GENERATED from the plugins\' config files. Do not modify - go to the source.\n' +
                  '/* jshint undef: false */\n\n'
        , jspref = ';(function (angular) {\n'
        , jspost = '\n})(angular);\n'
        , jstext = jstop + jspref + alljs.join(jspost + jspref) + jspost
        , csstext = allcss.join('\n\n');
      if (jspath === null && csspath === null) {
        return done(null, jstext, csstext, configs);
      }
      fs.writeFile(jspath, jstext, 'utf8', function (err) {
        fs.writeFile(csspath, csstext, 'utf8', function (cerr) {
          done(err || cerr, configs);
        });
      });
    });
  },

  initStatusBlocks: function (jspath, csspath, done) {
    if (arguments.length === 1) {
      done = jspath;
      jspath = csspath = null;
    }
    var alljs = []
      , allcss = []
      , blocks = {}
      , self = this;

    this.allExtensions(function (type, id, plugin, next) {
      var config = plugin['build-status'];
      if (!config) return next();
      if (!blocks[type]) blocks[type] = {};

      blocks[type][id] = config;
      config.id = id;
      if (type === 'runner') {
        config.attrs['ng-show'] = 'job.runner.id === \'' + id + '\'' + (config.attrs['ng-show'] ? ' && ( ' + config.attrs['ng-show'] + ')' : '');
      }
      config.attrs['ng-show'] = 'show' + (config.attrs['ng-show'] ? ' && ' + config.attrs['ng-show'] : '');
      utils.getStatic(id, plugin.dir, config, 'build', self.lesspaths, function (err, html, css, js) {
        if (err) return next(err);
        config.html = html;
        alljs.push(js);
        allcss.push(css);
        next();
      });
    }, function (err) {
      if (err) return done(err, blocks);
      // wrap our javascripts
      var jstop = '// GENERATED from the plugins\' config files. Do not modify - go to the source.\n' +
                  '/* jshint undef: false */\n\n'
        , jspref = ';(function (angular) {\n'
        , jspost = '\n})(angular);\n'
        , jstext = jstop + jspref + alljs.join(jspost + jspref) + jspost
        , csstext = allcss.join('\n\n');
      if (jspath === null && csspath === null) {
        return done(null, jstext, csstext, blocks);
      }
      fs.writeFile(jspath, jstext, 'utf8', function (err) {
        fs.writeFile(csspath, csstext, 'utf8', function (cerr) {
          done(err || cerr, blocks);
        });
      });
    });
  },

  // private

  // initExtensions(subtype, context, done) -> done(err, {type: {id: retval, ...}, ...})
  // For each plugin
  //   this.types[type][subtype](id, plugin, context, next(err, retval))
  initExtensions: function (subtype, context, done) {
    var types = this.types
      , loaded = {};
    this.allExtensions(function (type, id, plugin, next) {
      if (!plugin[subtype]) return next();
      if ('string' === typeof plugin[subtype]) {
        try {
          plugin[subtype] = require(path.resolve(path.join(plugin.dir, plugin[subtype])));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('failed to load plugin', id, e.message, e.stack);
          e.message += '; error loading plugin ' + id;
          return next(e);
        }
      }

      if (!loaded[type]) loaded[type] = {};
      if (!types[type][subtype]) {
        loaded[type][id] = plugin[subtype];
        return next();
      }
      types[type][subtype](id, plugin[subtype], plugin, context, function (err, initialized) {
        loaded[type][id] = initialized;
        next(err);
      });
    }, function (err) {
      done(err, loaded);
    });
  },

  // allExtensions(each, done) -> done(err, [val, ...])
  // call `each(type, id, plugin, next(err, val))` for each plugin in parallel
  allExtensions: function (each, done) {
    var self = this
      , tasks = [];
    Object.keys(this.extensions).forEach(function (type) {
      Object.keys(self.extensions[type]).forEach(function (id) {
        var plugin = self.extensions[type][id];
        tasks.push(function (next) {
          each(type, id, plugin, next);
        });
      });
    });
    async.parallel(tasks, done);
  }
};

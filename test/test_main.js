var EventEmitter = require('events').EventEmitter,
    exec = require('child_process').exec,
    expect = require('chai').expect,
    fs = require('fs'),
    loader = require('../main'),
    _ = require('underscore')
    ,path = require('path')
    ,assert = require('assert')

function mkpath(dirname, mode) {
  if (mode === undefined) mode = 0x1ff ^ process.umask();
  var pathsCreated = [], pathsFound = [];
  var fn = dirname;
  while (true) {
    try {
      var stats = fs.statSync(fn);
      if (stats.isDirectory())
        break;
      throw new Error('Unable to create directory at '+fn);
    }
    catch (e) {
      if (e.code === 'ENOENT') {
        pathsFound.push(fn);
        fn = path.dirname(fn);
      }
      else {
        throw e;
      }
    }
  }
  for (var i=pathsFound.length-1; i>-1; i--) {
    var fn = pathsFound[i];
    fs.mkdirSync(fn, mode);
    pathsCreated.push(fn);
  }
  return pathsCreated;
};

describe("#findExtensions", function() {

  before(function(done) {
    mkpath("./node_modules_noext/foobar");
    mkpath("./node_modules_noext/foobar2");
    mkpath("./node_modules_ext/foobar");
    mkpath("./node_modules_ext/foobar-strider");
    var strider_json = {
      id: "foobar-strider",
      webapp: "webapp.js",
      worker: "worker.js"
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider/strider.json", JSON.stringify(strider_json));
    mkpath("./node_modules_ext2/foobar-strider2");
    var strider_json = {
      id: "foobar-strider2",
      webapp: "webapp.js",
      worker: "worker.js"
    };
    fs.writeFileSync("./node_modules_ext2/foobar-strider2/strider.json", JSON.stringify(strider_json));
    done();
  });

  it("should not find extensions when there aren't any", function(done) {
    loader._findExtensions('./node_modules_noext', function(err, extensions) {
      expect(extensions).to.be.empty;
      done();
    });

  });

  it("should find an extension when there is one", function(done) {
    loader._findExtensions('./node_modules_ext', function(err, extensions) {
      expect(extensions).to.have.length(1);
      expect(extensions[0].dir).to.contain('node_modules_ext/foobar-strider');
      done();
    });
  });

  it("should support array-type argument of extension paths", function(done) {
    loader._findExtensions(['./node_modules_ext', './node_modules_ext2'], function(err, extensions) {
      expect(extensions).to.have.length(2);
      var paths = _.pluck(extensions, 'dir')
      expect(paths).to.contain('node_modules_ext/foobar-strider');
      expect(paths).to.contain('node_modules_ext2/foobar-strider2');
      done();
    });
  });

  after(function(done) {
    exec("rm -rf node_modules_noext node_modules_ext node_modules_ext2", function() {
      done();
    });

  });

});
describe("#initExtensions", function() {
  before(function() {
    mkpath("./node_modules_ext2/foobar-strider");
    mkpath("./node_modules_ext2/foobar-strider-worker");
    mkpath("./node_modules_ext2/foobar-strider-webapp");
    mkpath("./node_modules_ext2/foobar-strider-webapp-routes");
    var strider_json = {
      id: "foo",
      webapp: "webapp.js",
      worker: "worker.js"
    };
    fs.writeFileSync("./node_modules_ext2/foobar-strider/webapp.js",
        "module.exports = function(ctx, cb) { ctx.registerTransportMiddleware(true); cb(null, null); };\n");
    fs.writeFileSync("./node_modules_ext2/foobar-strider/worker.js",
        "module.exports = function(ctx, cb) { ctx.registerTransportMiddleware(true); cb(null, null); };\n");
    fs.writeFileSync("./node_modules_ext2/foobar-strider/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext2/foobar-strider/package.json", fs.readFileSync("package.json"));
    var strider_json = {
      id : "foo",
      webapp: "webapp.js",
    };
    strider_json.weight = 10;
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp/webapp.js",
        "module.exports = function(ctx, cb) { ctx.registerTransportMiddleware(true); cb(null, null); };\n");
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp/package.json", fs.readFileSync("package.json"));

    var strider_json = {
      id: "foo",
      worker: "worker.js",
    };
    fs.writeFileSync("./node_modules_ext2/foobar-strider-worker/worker.js",
        "module.exports = function(ctx, cb) { ctx.registerTransportMiddleware(true); cb(null, null); };\n");
    fs.writeFileSync("./node_modules_ext2/foobar-strider-worker/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext2/foobar-strider-worker/package.json", fs.readFileSync("package.json"));

    var strider_json = {
      id: "foo",
      webapp: "webapp.js",
    };
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp-routes/webapp.js",
    "module.exports = function(ctx, cb) { ctx.registerTransportMiddleware(true); ctx.route.get('/foo', function(req, res) { res.end('ok') }); cb(null, null); };\n");
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp-routes/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp-routes/package.json", fs.readFileSync("package.json"));

  });

  it("should initialize worker extensions", function(done) {
    var emitter = new EventEmitter();
    var config = {};
    var l = [];
    function registerTransportMiddleware(m) {
      l.push(m);
    }
    var context = {
      config: config,
      emitter: emitter,
      extensionRoutes: [],
      registerTransportMiddleware: registerTransportMiddleware
    };
    loader.initWorkerExtensions("./node_modules_ext2", context, function(err, initialized) {
      expect(l).to.have.length(2);
      done();
    });
  });

  it("should initialize webapp extensions", function(done) {
    var emitter = new EventEmitter();
    var config = {};
    var urlpaths = [];
    var appInstance = {
      use: function(path) {
        urlpaths.push(path);
      },
      get: function(p, f) {},
      post: function(p, f) {},
      delete: function(p, f) {},
      put: function(p, f) {},
    };
    var l = [];
    function registerTransportMiddleware(m) {
      l.push(m);
    }
    var context = {
      config: config,
      emitter: emitter,
      extensionRoutes: [],
      registerTransportMiddleware: registerTransportMiddleware
    };
    loader.initWebAppExtensions("./node_modules_ext2", context, appInstance, function(err, initialized) {
      expect(l).to.have.length(3);
      // Verify the static paths are mapped for the two webapp extensions
      expect(urlpaths).to.contain("/ext/foobar-strider");
      expect(urlpaths).to.contain("/ext/foobar-strider-webapp");
      done();
    });
  });

  it("should continue without extensions", function(done) {
    var emitter = new EventEmitter();
    var config = {};
    var appInstance = {
      use: function() { },
      get: function(p, f) {},
      post: function(p, f) {},
      delete: function(p, f) {},
      put: function(p, f) {},
    };
    var context = {
      config: config,
      emitter: emitter,
      extensionRoutes: [],
    };
    loader.initWebAppExtensions("/tmp/nonexistant", context, appInstance, function(err, initialized) {
      expect(initialized).to.have.length(0);
      expect(err).to.eql(null);
      done();
    });
  });

  it("should initialize webapp extensions routes", function(done) {
    var emitter = new EventEmitter();
    var config = {};
    var urlpaths = [];
    var appInstance = {
      use: function(path) {
        urlpaths.push(path);
      },
      get: function(p, f) {},
      post: function(p, f) {},
      delete: function(p, f) {},
      put: function(p, f) {},
    };
    var l = [];
    function registerTransportMiddleware(m) {
      l.push(m);
    }
    var context = {
      config: config,
      emitter: emitter,
      extensionRoutes: [],
      registerTransportMiddleware: registerTransportMiddleware
    };
    loader.initWebAppExtensions("./node_modules_ext2", context, appInstance, function(err, initialized) {
      expect(l).to.have.length(3);
      expect(context.extensionRoutes).to.have.length(1);
      expect(context.extensionRoutes[0].path).to.eql('/foo');
      expect(context.extensionRoutes[0].method).to.eql('get');
      done();
    });
  });

  it("should initialize extensions in order of weight", function(done) {
    var emitter = new EventEmitter();
    var config = {};
    var urlpaths = [];
    var appInstance = {
      use: function(path) {
        urlpaths.push(path);
      },
      get: function(p, f) {},
      post: function(p, f) {},
      delete: function(p, f) {},
      put: function(p, f) {},
    };
    var l = [];
    function registerTransportMiddleware(m) {
      l.push(m);
    }
    var context = {
      config: config,
      emitter: emitter,
      extensionRoutes: [],
      registerTransportMiddleware: registerTransportMiddleware
    };
    loader.initWebAppExtensions("./node_modules_ext2", context, appInstance, function(err, initialized) {
      expect(l).to.have.length(3);
      // Verify the static paths are mapped for the two webapp extensions
      expect(urlpaths).to.contain("/ext/foobar-strider");
      expect(urlpaths).to.contain("/ext/foobar-strider-webapp");
      // Verify order
      expect(urlpaths[1]).to.eql("/ext/foobar-strider-webapp-routes");
      done();
    });
  });

  after(function(done) {
    exec("rm -rf node_modules_ext2", function() {
      done();
    });
  });

});



describe("#listWorkerExtensions", function() {

  before(function(done) {
    mkpath("./node_modules_noext/foobar");
    mkpath("./node_modules_noext/foobar2");
    mkpath("./node_modules_ext/foobar");
    mkpath("./node_modules_ext/foobar-strider");
    var strider_json = {
      id: "foobar-strider",
      webapp: "webapp.js",
      worker: "worker.js"
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider/strider.json", JSON.stringify(strider_json));
    mkpath("./node_modules_ext/foobar-strider2");
    var strider_json = {
      id: "foobar-strider2",
      webapp: "webapp.js",
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider2/strider.json", JSON.stringify(strider_json));
    done();
  });

  it("should get a list", function(done) {
    loader.listWorkerExtensions('./node_modules_ext', function(err, loaded){
      assert(!err)
      assert.equal(loaded.length, 1);
      done();
    })
  })



  after(function(done) {
    exec("rm -rf node_modules_noext node_modules_ext node_modules_ext2", function() {
      done();
    });
  })
})

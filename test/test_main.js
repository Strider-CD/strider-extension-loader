var EventEmitter = require('events').EventEmitter,
    exec = require('child_process').exec,
    expect = require('chai').expect,
    fs = require('fs'),
    loader = require('../main'),
    path = require('path');

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

  before(function() {
    mkpath("./node_modules_noext/foobar");
    mkpath("./node_modules_noext/foobar2");
    mkpath("./node_modules_ext/foobar");
    mkpath("./node_modules_ext/foobar-strider");
    var strider_json = {
      webapp: "webapp.js",
      worker: "worker.js"
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider/strider.json", JSON.stringify(strider_json));

  });

  it("should not find extensions when there aren't any", function(done) {
    loader.findExtensions('./node_modules_noext', function(err, extensions) {
      expect(extensions).to.be.empty;
      done();
    });

  });

  it("should find an extension when there is one", function(done) {
    loader.findExtensions('./node_modules_ext', function(err, extensions) {
      expect(extensions).to.have.length(1);
      expect(extensions).to.contain('node_modules_ext/foobar-strider');
      done();
    });
  });

  after(function(done) {
    exec("rm -rf node_modules_noext node_modules_ext", function() {
      done();
    });

  });

});


describe("#loadExtension", function() {
  before(function() {
    mkpath("./node_modules_ext/foobar");
    fs.writeFileSync("./node_modules_ext/foobar/strider.json", "{INVALID");
    mkpath("./node_modules_ext/foobar-strider");
    mkpath("./node_modules_ext/foobar-strider-worker");
    mkpath("./node_modules_ext/foobar-strider-webapp");
    var strider_json = {
      webapp: "webapp.js",
      worker: "worker.js"
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider/webapp.js", "exports.ok = function() { return true; };\n");
    fs.writeFileSync("./node_modules_ext/foobar-strider/worker.js", "exports.ok = function() { return true; };\n");
    fs.writeFileSync("./node_modules_ext/foobar-strider/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext/foobar-strider/package.json", fs.readFileSync("package.json"));
    var strider_json = {
      webapp: "webapp.js",
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider-webapp/webapp.js", "exports.ok = function() { return true; };\n");
    fs.writeFileSync("./node_modules_ext/foobar-strider-webapp/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext/foobar-strider-webapp/package.json", fs.readFileSync("package.json"));

    var strider_json = {
      worker: "worker.js",
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider-worker/worker.js", "exports.ok = function() { return true; };\n");
    fs.writeFileSync("./node_modules_ext/foobar-strider-worker/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext/foobar-strider-worker/package.json", fs.readFileSync("package.json"));

  });

  it("should fail on invalid path", function(done) {

    loader.loadExtension("BADPATH", function(err, extension) {
      expect(err).to.exist;
      expect(extension).to.be.null;
      done();

    });
  });

  it("should fail on invalid JSON", function(done) {
    loader.loadExtension("./node_modules_ext/foobar/", function(err, extension) {
      expect(err).to.exist;
      expect(extension).to.be.null;
      done();
    });
  });

  it("should correctly load extension", function(done) {
    loader.loadExtension("./node_modules_ext/foobar-strider/", function(err, extension) {
      expect(err).not.to.exist;
      expect(extension).to.exist;
      expect(extension.webapp.ok()).to.be.true;
      expect(extension.worker.ok()).to.be.true;
      expect(extension.package.name).to.eql("strider-extension-loader");
      done();
    });
  });

  it("should load worker-only extensions", function(done) {
    loader.loadExtension("./node_modules_ext/foobar-strider-worker/", function(err, extension) {
      expect(err).not.to.exist;
      expect(extension).to.exist;
      expect(extension.webapp).not.to.exist;
      expect(extension.worker.ok()).to.be.true;
      expect(extension.package.name).to.eql("strider-extension-loader");
      done();
    });
  });

  it("should load webapp-only extensions", function(done) {
    loader.loadExtension("./node_modules_ext/foobar-strider-webapp/", function(err, extension) {
      expect(err).not.to.exist;
      expect(extension).to.exist;
      expect(extension.worker).not.to.exist;
      expect(extension.webapp.ok()).to.be.true;
      expect(extension.package.name).to.eql("strider-extension-loader");
      done();
    });


  });

  after(function(done) {
    exec("rm -rf node_modules_ext", function() {
      done();
    });
  });

});

describe("#initExtensions", function() {
  before(function() {
    mkpath("./node_modules_ext2/foobar-strider");
    mkpath("./node_modules_ext2/foobar-strider-worker");
    mkpath("./node_modules_ext2/foobar-strider-webapp");
    var strider_json = {
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
      webapp: "webapp.js",
    };
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp/webapp.js",
        "module.exports = function(ctx, cb) { ctx.registerTransportMiddleware(true); cb(null, null); };\n");
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext2/foobar-strider-webapp/package.json", fs.readFileSync("package.json"));

    var strider_json = {
      worker: "worker.js",
    };
    fs.writeFileSync("./node_modules_ext2/foobar-strider-worker/worker.js",
        "module.exports = function(ctx, cb) { ctx.registerTransportMiddleware(true); cb(null, null); };\n");
    fs.writeFileSync("./node_modules_ext2/foobar-strider-worker/strider.json", JSON.stringify(strider_json));
    fs.writeFileSync("./node_modules_ext2/foobar-strider-worker/package.json", fs.readFileSync("package.json"));

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
    loader.initExtensions("./node_modules_ext2", "worker", context, null, function(err, initialized) {
      expect(l).to.have.length(2);
      done();
    });
  });

  it("should initialize webapp extensions", function(done) {
    var emitter = new EventEmitter();
    var config = {};
    var appInstance = {};
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
    loader.initExtensions("./node_modules_ext2", "webapp", context, null, function(err, initialized) {
      expect(l).to.have.length(2);
      done();
    });
  });

  after(function(done) {
    exec("rm -rf node_modules_ext2", function() {
      done();
    });
  });

});

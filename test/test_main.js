var exec = require('child_process').exec,
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
      expect(extensions).to.contain('node_modules_ext/foobar-strider/strider.json');
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
    var strider_json = {
      webapp: "webapp.js",
      worker: "worker.js"
    };
    fs.writeFileSync("./node_modules_ext/foobar-strider/webapp.js", "exports.ok = function() { return true; };\n");
    fs.writeFileSync("./node_modules_ext/foobar-strider/worker.js", "exports.ok = function() { return true; };\n");
    fs.writeFileSync("./node_modules_ext/foobar-strider/strider.json", JSON.stringify(strider_json));


  });

  it("should fail on invalid path", function(done) {

    loader.loadExtension("BADPATH", function(err, extension) {
      expect(err).to.exist;
      expect(extension).to.be.null;
      done();

    });
  });

  it("should fail on invalid JSON", function(done) {
    loader.loadExtension("./node_modules_ext/foobar/strider.json", function(err, extension) {
      expect(err).to.exist;
      expect(extension).to.be.null;
      done();
    });
  });

  it("should correctly load extension", function(done) {
    loader.loadExtension("./node_modules_ext/foobar-strider/strider.json", function(err, extension) {
      expect(err).not.to.exist;
      expect(extension).to.exist;
      expect(extension.webapp.ok()).to.be.true;
      expect(extension.worker.ok()).to.be.true;
      done();
    });
  });

  after(function(done) {
    exec("rm -rf node_modules_ext", function() {
      done();
    });

  });

});

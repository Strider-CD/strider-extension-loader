'use strict';

var EventEmitter = require('events').EventEmitter,
  exec = require('child_process').exec,
  expect = require('chai').expect,
  fs = require('fs'),
  loader = require('../main'),
  findExtensions = require('../lib/utils.js').findExtensions,
  lodashMap = require('lodash.map'),
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
}

describe('#findExtensions', function() {

  before(function(done) {
    mkpath('./node_modules_noext/foobar');
    mkpath('./node_modules_noext/foobar2');
    mkpath('./node_modules_ext/foobar');
    mkpath('./node_modules_ext/foobar-strider');
    var strider_json = {
      id: 'foobar-strider',
      webapp: 'webapp.js',
      worker: 'worker.js'
    };
    fs.writeFileSync('./node_modules_ext/foobar-strider/strider.json', JSON.stringify(strider_json));
    mkpath('./node_modules_ext2/foobar-strider2');
    var strider_json = {
      id: 'foobar-strider2',
      webapp: 'webapp.js',
      worker: 'worker.js'
    };
    fs.writeFileSync('./node_modules_ext2/foobar-strider2/strider.json', JSON.stringify(strider_json));
    done();
  });

  it('should not find extensions when there aren\'t any', function(done) {
    findExtensions('./node_modules_noext', function(err, extensions) {
      expect(extensions).to.be.empty;
      done();
    });

  });

  it('should find an extension when there is one', function(done) {
    findExtensions('./node_modules_ext', function(err, extensions) {
      expect(extensions).to.have.length(1);
      expect(extensions[0].dir).to.contain('node_modules_ext/foobar-strider');
      done();
    });
  });

  it('should support array-type argument of extension paths', function(done) {
    findExtensions(['./node_modules_ext', './node_modules_ext2'], function(err, extensions) {
      expect(extensions).to.have.length(2);
      var paths = lodashMap(extensions, 'dir');
      expect(paths).to.contain('node_modules_ext/foobar-strider');
      expect(paths).to.contain('node_modules_ext2/foobar-strider2');
      done();
    });
  });

  after(function(done) {
    exec('rm -rf node_modules_noext node_modules_ext node_modules_ext2', function() {
      done();
    });

  });

});
describe('#Loader', function() {
  before(function() {
    mkpath('./node_modules_ext2/foobar-strider');
    mkpath('./node_modules_ext2/foobar-strider-worker');
    mkpath('./node_modules_ext2/foobar-strider-webapp');
    mkpath('./node_modules_ext2/foobar-strider-webapp-routes');
    var strider_json = {
      id: 'foobar-strider',
      webapp: 'webapp.js',
      worker: 'worker.js'
    };
    fs.writeFileSync('./node_modules_ext2/foobar-strider/webapp.js',
      'module.exports = function(ctx, cb) { cb(null, null); };\n');
    fs.writeFileSync('./node_modules_ext2/foobar-strider/worker.js',
      'module.exports = function(ctx, cb) { cb(null, null); };\n');
    fs.writeFileSync('./node_modules_ext2/foobar-strider/strider.json', JSON.stringify(strider_json));
    fs.writeFileSync('./node_modules_ext2/foobar-strider/package.json', fs.readFileSync('package.json'));
    var strider_json = {
      id : 'foobar-strider-webapp',
      webapp: 'webapp.js',
    };
    strider_json.weight = 10;
    fs.writeFileSync('./node_modules_ext2/foobar-strider-webapp/webapp.js',
      'module.exports = function(ctx, cb) { cb(null, null); };\n');
    fs.writeFileSync('./node_modules_ext2/foobar-strider-webapp/strider.json', JSON.stringify(strider_json));
    fs.writeFileSync('./node_modules_ext2/foobar-strider-webapp/package.json', fs.readFileSync('package.json'));

    var strider_json = {
      id: 'foobar-strider-worker',
      worker: 'worker.js',
    };
    fs.writeFileSync('./node_modules_ext2/foobar-strider-worker/worker.js',
      'module.exports = function(ctx, cb) { cb(null, null); };\n');
    fs.writeFileSync('./node_modules_ext2/foobar-strider-worker/strider.json', JSON.stringify(strider_json));
    fs.writeFileSync('./node_modules_ext2/foobar-strider-worker/package.json', fs.readFileSync('package.json'));

    var strider_json = {
      id: 'foobar-strider-route',
      webapp: 'webapp.js',
    };
    fs.writeFileSync('./node_modules_ext2/foobar-strider-webapp-routes/webapp.js',
      'module.exports = function(ctx, cb) { ctx.app.get(\'/foo\', function(req, res) { res.end(\'ok\') }); cb(null, null); };\n');
    fs.writeFileSync('./node_modules_ext2/foobar-strider-webapp-routes/strider.json', JSON.stringify(strider_json));
    fs.writeFileSync('./node_modules_ext2/foobar-strider-webapp-routes/package.json', fs.readFileSync('package.json'));

  });

  describe('#collectExtensions()', function() {
    it('should collect all extensions', function(done) {
      var l = new loader();
      l.collectExtensions('./node_modules_ext2', function(err, initialized) {
        expect(Object.keys(l.extensions.basic)).to.have.length(4);
        done();
      });
    });
  });

  describe('#initWebAppExtensions()', function() {

    it('should initialize basic webapp extensions', function(done) {
      var emitter = new EventEmitter();
      var config = {};
      var urlpaths = [];

      var appInstance = {
        use: function(path) {
          urlpaths.push(path);
        },
        get: function(p, f) {
          urlpaths.push(p);
        },
        post: function(p, f) {},
        delete: function(p, f) {},
        put: function(p, f) {},
      };
      var context = {
        app: appInstance
      };
      var l = new loader();
      l.collectExtensions('./node_modules_ext2', function(err, initialized) {
        expect(Object.keys(l.extensions.basic)).to.have.length(4);
        l.initWebAppExtensions(context, function(err, initialized) {
          expect(err).to.be.null;
          expect(urlpaths).to.contain('/foo');
          done();
        });
      });
    });
  });

  after(function(done) {
    exec('rm -rf node_modules_ext2', function() {
      done();
    });
  });

});



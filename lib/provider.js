'use strict';

var namespace = require('./namespace');

module.exports = {
  webapp: webapp,
  worker: worker,
  userConfig: 'account'
};

function worker(id, plugin, striderjson, context, done) {
  plugin.hosted = striderjson.hosted;
  done(null, plugin);
}

function defExtend(dest, src) {
  for (var key in src) {
    if (!src[key]) continue;
    dest[key] = src[key];
  }
}

// routes, globalRoutes
function webapp(id, plugin, striderjson, context, done) {
  if (plugin.appConfig) {
    defExtend(plugin.appConfig, context.config.plugins[id] || {});
  }
  if (plugin.routes) {
    providerRoutes(id, plugin, context);
  }
  if (plugin.globalRoutes) {
    globalRoutes(id, plugin, context);
  }
  if (plugin.auth) {
    plugin.auth(context.passport, context);
  }
  plugin.hosted = striderjson.hosted;
  return done(null, plugin);
}

function providerRoutes(id, plugin, context) {
  var mid = context.middleware;
  var app = namespace(context.app, '/:org/:repo/api/' + id, mid.project, mid.projectProvider);
  app.anon = namespace(context.app, '/:org/:repo/api/' + id, mid.anonProject, mid.projectProvider);
  plugin.routes(app, context);
}

function globalRoutes(id, plugin, context) {
  var app = namespace(context.app, '/ext/' + id);
  plugin.globalRoutes(app, context);
}

'use strict';

var namespace = require('./namespace');

module.exports = {
  webapp: webapp
};

function webapp(id, plugin, striderjson, context, done) {
  var config = context.config.runners && context.config.runners[id];

  /*
  if (plugin.appConfig) {
    schema.plugin(function (schema, options) {
      schema.add(plugin.appConfig, 'runners.' + id)
    })
  }
  */
  // setup routes
  if (plugin.globalRoutes) {
    globalRoutes(id, plugin, context);
  }
  // passport authentication
  if (plugin.auth) {
    plugin.auth(context.passport, context);
  }
  plugin.create(context.emitter, config, context, done);
}

function globalRoutes(id, plugin, context) {
  var app = namespace(context.app, '/ext/' + id);
  plugin.globalRoutes(app, context);
}

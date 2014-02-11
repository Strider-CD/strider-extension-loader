
var namespace = require('./namespace')

module.exports = {
  webapp: webapp
}

function defExtend(dest, src) {
  for (var key in src) {
    if (!src[key]) continue;
    dest[key] = src[key]
  }
}

// schema
// {
//    routes: function (app, context) {}
//    globalRoutes: function (app, context) {}
//    listen: function (io, context) {}
// }
function webapp(id, plugin, striderjson, context, done) {
  if (plugin.appConfig) {
    defExtend(plugin.appConfig, context.config.plugins[id] || {})
  }
  // setup routes
  if (plugin.routes) {
    jobRoutes(id, plugin, context)
  }
  if (plugin.globalRoutes) {
    globalRoutes(id, plugin, context)
  }
  if (plugin.auth) {
    plugin.auth(context.passport, context)
  }
  // listen to global events; most job plugins shouldn't need this
  if (plugin.listen) {
    plugin.listen(context.emitter, context)
  }
  done(null, plugin.config)
}

function jobRoutes(id, plugin, context) {
  var mid = context.middleware
  var app = namespace(context.app, '/:org/:repo/api/' + id, mid.project, mid.projectPlugin.bind(null, id))
  app.anon = namespace(context.app, '/:org/:repo/api/' + id, mid.anonProject, mid.projectProvider)
  plugin.routes(app, context)
}

function globalRoutes(id, plugin, context) {
  var mid = context.middleware
    , app = namespace(context.app, '/ext/' + id)
  plugin.globalRoutes(app, context)
}

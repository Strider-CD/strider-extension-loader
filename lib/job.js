
var namespace = require('./namespace')

module.exports = {
  webapp: webapp
}

// schema
// {
//    routes: function (app, context) {}
//    globalRoutes: function (app, context) {}
//    listen: function (io, context) {}
// }
function webapp(id, plugin, context, done) {
  // setup routes
  if (plugin.routes) {
    jobRoutes(id, plugin, context)
  }
  if (plugin.globalRoutes) {
    globalRoutes(id, plugin, context)
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
  plugin.routes(app, context)
}

function globalRoutes(id, plugin, context) {
  var mid = context.middleware
    , app = namespace(context.app, '/ext/' + id)
  plugin.globalRoutes(app, context)
}


var namespace = require('./namespace')

module.exports = {
  webapp: webapp
}

// routes, globalRoutes
function webapp(id, plugin, context, done) {
  if (plugin.routes) {
    providerRoutes(id, plugin, context)
  }
  if (plugin.globalRoutes) {
    globalRoutes(id, plugin, context)
  }
  return done(null, plugin)
}

function providerRoutes(id, plugin, context) {
  var mid = context.middleware
  var app = namespace(context.app, '/:org/:repo/api/' + id, mid.project, mid.projectProvider)
  plugin.routes(app, context)
}

function globalRoutes(id, plugin, context) {
  var mid = context.middleware
    , app = namespace(context.app, '/ext/' + id)
  plugin.globalRoutes(app, context)
}


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
  context.app.namespace(
    '/:org/:repo/api/' + id,
    mid.getProject,
    mid.projectProvider,
    function () {
      plugin.routes(context.app, context)
    })
}

function globalRoutes(id, plugin, context) {
  var mid = context.middleware
  context.app.namespace(
    '/ext/' + id,
    function () {
      plugin.routes(context.app, context)
    })
}

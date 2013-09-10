
module.exports = {
  webapp: webapp
}

function webapp(id, plugin, context, done) {
  if (plugin.routes) {
    providerRoutes(id, plugin, context)
  }
  return done(null, plugin)
}

function providerRoutes(id, plugin, context) {
  var mid = context.middleware
  context.app.namespace(
    '/ext/' + id,
    function () {
      plugin.routes(context.app, context)
    })
}

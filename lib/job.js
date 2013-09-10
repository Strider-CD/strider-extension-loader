
module.exports = {
  webapp: webapp
}

// schema
// {
//    routes: function (app, context) {}
//    listen: function (io, context) {}
// }
function webapp(id, plugin, context, old_context, done) {
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
  context.app.namespace(
    '/:org/:repo/api/' + id,
    mid.getProject,
    mid.pluginProject.bind(null, id)
    function () {
      plugin.routes(context.app, context)
    })
}

function globalRoutes(id, plugin, context) {
  var mid = context.middleware
  context.app.namespace(
    '/ext/' + id,
    function () {
      plugin.globalRoutes(context.app, context)
    })
}

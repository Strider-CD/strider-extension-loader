
module.exports = {
  webapp: webapp
}

// schema
// {
//    routes: function (app) {}
//    listen: function (io) {}
// }
function webapp(id, plugin, context, old_context, done) {
  // setup routes
  if (plugin.routes) {
    jobRoutes(id, plugin, context)
  }
  // listen to global events; most job plugins shouldn't need this
  if (plugin.listen) {
    plugin.listen(context.emitter)
  }
  done()
}

function jobRoutes(id, plugin, context) {
  if (!worker) return
  var mid = context.middleware
  context.app.namespace(
    '/:org/:repo/api/' + id,
    mid.getProject,
    mid.pluginProject.bind(null, id)
    function () {
      plugin.routes(app)
    })
}

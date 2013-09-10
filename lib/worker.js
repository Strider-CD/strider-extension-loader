
module.exports = {
  webapp: webapp
}

function init(name, plugin, context, old_context) {
  if ('function' === typeof plugin) {
    console.warn('Old style plugin')
    return
  }
  // setup routes
  if (plugin.routes) {
    workerRoutes(context, name, plugin)
  }
  // listen to global events; most workers shouldn't need this
  if (plugin.listen) {
    plugin.listen(context.emitter)
  }
}

function workerRoutes(name, plugin, context) {
  if (!worker) return
  var mid = context.middleware
  context.app.namespace(
    '/:org/:repo/api/' + name,
    mid.getProject,
    mid.pluginProject.bind(null, name)
    function () {
      worker.routes(app)
    })
}

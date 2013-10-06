
var namespace = require('./namespace')

module.exports = {
  webapp: webapp,
  worker: worker,
  userConfig: 'account'
}

function worker(id, plugin, striderjson, context, done) {
  plugin.hosted = striderjson.hosted
  done(null, plugin)
}

// routes, globalRoutes
function webapp(id, plugin, striderjson, context, done) {
  if (plugin.routes) {
    providerRoutes(id, plugin, context)
  }
  if (plugin.globalRoutes) {
    globalRoutes(id, plugin, context)
  }
  if (plugin.addLink) {
    context.app.get('/account/new/' + id, context.auth.requireUser, plugin.addLink)
  }
  plugin.hosted = striderjson.hosted
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

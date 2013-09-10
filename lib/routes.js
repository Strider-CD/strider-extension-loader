
module.exports = {
  addRoutes: addRoutes
}

function getNewWorker(config) {
  if (typeof(config.worker) === 'string') {
    config.worker = require(path.resolve(path.join(config.dir, config.worker)))
    config.worker = config.worker.worker || config.worker
  }
  if (typeof(config.worker) === 'function') {
    console.warn('Old-style plugin; not initializing routes', config)
    return;
  }
  if (!config.worker || !config.worker.init) {
    console.warn('Unknown plugin format!', config, config.worker)
    return;
  }
  return config.worker
}

function workerRoutes(app, config) {
  var worker = getNewWorker(config)
  if (!worker) return
  app.namespace(
    '/:org/:repo/api/' + config.id,
    getProject,
    pluginProject.bind(null, config.id)
    function () {
      worker.routes(app)
    })
}

// adding routes
exports.addRoutes = function (app, workers) {
  var workers = common.availableWorkers
  for (var i=0; i<workers.length; i++) {
}

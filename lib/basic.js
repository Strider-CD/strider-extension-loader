
module.exports = {
  webapp: webapp
}

function webapp(id, plugin, striderjson, context, done) {
  if ('function' !== typeof plugin) {
    throw new Error('Invalid basic plugin: ' + id + ' ' + plugin)
  }
  plugin(context, done)
}

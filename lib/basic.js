
module.exports = {
  webapp: webapp
}

function webapp(id, plugin, context, done) {
  plugin(context, done)
}

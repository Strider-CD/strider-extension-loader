
module.exports = {
  webapp: webapp
}

function webapp(id, plugin, striderjson, context, done) {
  var config = context.config.runners && context.config.runners[id]
    , schema = context.models.StriderSchema
  if (plugin.appConfig) {
    schema.plugin(function (schema, options) {
      schema.add(plugin.appConfig, 'runners.' + id)
    })
  }
  plugin.create(context.emitter, config, context, done)
}


var methods = require('methods').concat(['del'])

module.exports = namespace

function join(one, two) {
  if (one[one.length - 1] === '/') one = one.slice(0, -1)
  if (two[0] !== '/') two = '/' + two
  return one + two
}

function namespace(app, prefix) {
  var middleware = [].slice.call(arguments, 2)
  function route(method) {
    var args = [].slice.call(arguments, 1)
    return app[method].apply(app, [join(prefix, args.shift())].concat(middleware.concat(args)))
  }
  var rep = {}
  for (var i=0; i<methods.length; i++) {
    rep[methods[i]] = route.bind(null, methods[i])
  }
  return rep
}

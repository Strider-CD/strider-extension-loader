# Strider Extension Loader

[![Build Status](https://hosted.stridercd.com/51f050cf04568a0c00000008/strider-cd/strider-extension-loader/badge)](https://hosted.stridercd.com/Strider-CD/strider-extension-loader/)

[Strider](https://github.com/Strider-CD/strider) is an extensible CI system, written
in node. Strider extensions are simply NPM packages with additional metadata contained
in a file named `strider.json`. This metadata tells Strider which JavaScript source files
should be loaded and initialized.

Hence, to install a new Strider extension, you can just `npm install` it in your strider
repositiory.

This is a small Node.JS library for loading Strider extensions.

## Strider Extensions

### Extension types

- runner: runs the jobs, like strider-docker-runner
- provider: gets the source code for a project, like strider-github or strider-hg
- job: effects the way a job runs, runs tests, sets up the environment, like strider-node or strider-sauce
- basic: does whatever you want

### Webapp vs Worker

There are two environments where plugins are loaded, webapp and worker.

#### Webapp environment

Effects the way the strider webapp works, how it looks, etc. You can
define templates, serve static files, listen to global strider events,
and other great things.

#### Worker environment

This code is loaded for each job that is run, by the process that is
running the job. This may be the same process as the webapp (as when
using strider-simple-runner), or it might be somewhere else
entirely. Accordingly, it is recommended that you net depend on
network connections unless absolutely necessary. In many cases, you
can pass a message up to the strider app and handle it in your
`webapp` code.

### Strider.json

To declare your npm package as a strider plugin, include a
`strider.json` in the base directory. Alternatively, you can have a
`strider` section to your `package.json`.

`strider.json` schema:

```
{
  "id": "pluginid", // must be unique.
  "type": "runner | provider | job | basic", // defaults to basic
  "webapp": "filename.js", // things that should be loaded in the webapp environment
  "worker": "filename.js", // things that should be loaded in the worker environment
  "templates": {
    "tplname": "<div>Hello {{ name }}</div>",
    "tplname": "path/to/tpl.html"
  }
}
```

Additionally, if there is a `/static/` directory, the files within it
will be accessible at the path `/ext/:pluginid`.

### Runner

Runner plugins do not get loaded in the worker environment.

```
exports = {
  config: {}, // mongoose schema. This will be per-project config
  create: function (emitter, options, callback) {  }
}
```

The runner object is expected to handle the following events:

- `job.new (job)` see strider-runner-core for a description of the `job` data
- `job.cancel (jobid)` if the runner has the specified job, either
  queued or in process, stop it and fire the `job.canceled` event

Runners are only expected to handle a job if `job.project.runner.id`
identifies it as belonging to this runner.

The runner object is expected to emit the following events:

- `browser.update (eventname, data)` this is for proxying internal
  `job.status` events up to the browser
- `job.queued (jobid, time)`
- `job.done (data)`

### Provider

#### Webapp

#### Worker

### Job
### Basic

There are several types of Strider extensions: worker, webapp and template.

### Workers

Strider workers are extensions that tell Strider how to execute builds. Builds are comprised of four phases: prepare, test, deploy and cleanup.

Some good examples of Strider worker extensions are:

- [Custom Worker](https://github.com/Strider-CD/strider-custom)
- [Go Strider](https://github.com/Strider-CD/go-strider)

Strider worker extensions specify a `worker` in their `strider.json` - this is a node
module that exposes an object conforming to the following structure:

```js
module.exports = {
  // an object that defines the schema for plugin config, definied on
  // a per-project basis. use Mongoose schema format
  config: {
    optionOne: String,
    optionTwo: {type: Boolean, default: true}
  },
  // Initialize the plugin for a job
  //   config: taken from DB config extended by flat file config
  //   job:    see strider-runner-core for a description of this object
  //   cb(err, initialized plugin)
  init: function (config, job, cb) {
    cb(null, {
      // string or list - to be added to the PATH
      path: '/add/to/path',
      // any extra env variables. These will be present throughout execution
      env: {
        CUSTOM: 1
      },
      // listen to job events. See strider-runner-core for a listing of events
      listen: null || function (io) {},
      // For each phase that you want to deal with, provide either a shell
      // string or fn(context, done) (or nothing)
      prepare: 'npm install',
      test: 'npm test',
      cleanup: 'rm -rf node_modules'
    });
  },
  // if provided, autodetect is run if the project has *no* plugin
  // configuration at all. This object is passed to `gumshoe`
  autodetect: {
    filename: 'package.json',
    exists: true,
    language: 'node.js',
    framework: null
  },
  // all routes will be namespaced (via express-namespace) to /:org/:name/api/:plugin
  // req.project is the project object from the DB
  // req.pluginConfig is the db config for this project
  routes: function (app, models) {
    app.get('/', function (req, res) {
      res.send('My Custom Plugin! Responding to project ' + req.project.name);
    })
  },
  // these are namespaced globally, under /api/:plugin
  globalRoutes: function (app, models) {
    app.get('/', function (req, res) {
      res.send('My Custom Plugin!');
    })
  }
}
```

### API

The `context` object passed to each build hook function provides the following public API:

**Functions**

- `forkProc` - Fork a process and run a UNIX command in it, automatically harvesting STDIO. **note** You must use `shellWrap` on your command before executing it.
- `striderMessage` - Add a log message to the job output.
- `shellWrap` - Wrap a shell command for use by `forkProc`.

**Data**

- `events` - EventEmitter which may be used for inter-extension co-ordination. This EventEmitter is reset on each job run.
- `workingDir` - Absolute path to the root of the current code repository.
- `jobData` - JSON object containing the job details.

The `callback` function passed to each build hook accepts a status value. This
status value is modeled on the UNIX exit code status. 0 means the build hook
completed successfully, non-zero means the buildhook failed.

### Webapps

Another type of extension adds endpoints and content to Strider.

This is achieved with a webapp module specified in strider.json which exposes a function
as follows:


```javascript
module.exports = function(ctx, cb) {

  // Add routes to strider:
  ctx.route.get("/foo/bar", function(req, res, next){
    // This is an express3 route
  })

  // you can use authentication middleware and param validation:

  ctx.route.post("foo/bar"
    , ctx.auth.requireUser
    , ctx.middleware.require_params(["url"])
    , function(req, res, next){
      res.send("Hi", req.currentUser.user.email)
    })

  //  you can register 'blocks' to be inserted at
  //  specific points in existing pages. Any element with a class
  // with the 'StriderBlock_' prefix can be specified here:

  ctx.registerBlock('HeaderBrand', function(context, cb){
    // context has a lot of useful stuff on it:

    var email = context.currentUser.user.email

    // You can do some async processing here, but bear in mind
    // you'll be blocking the page load.

    cb(null, "<h1>FooStrider</h1>");
  })


  // [Note] ctx.registerPanel as seen in the sauce webapp is a legacy method
  // that will eventually disappear and should be rewritten as:
  // ctx.registerBlock("ProjectConfigPanel", foo)

  cb(null) // No errors in extension
}
```

#### Templates

Because writing a bunch of `registerBlock` calls for simple pieces of template
overrides is a little tedious, you can also use the following shortcut in your
strider.json:

```javascript
{"templates": {
    "HeaderBrand" : "<h1>An HTML String</h1>"
  , "FooterTOS" : "./path/to/TOS.html"
  }
}
```
These are either inline strings or paths to static HTML. There is no templating
available for these at present.

*Note* If more than one override is specified for a block, then the first one
will be used. At the moment this means that extensions can squash each other.
If you want to simply 'append' to a block, use the `registerBlock` method
and make sure that you prefix the html you return with:
`ctx.content` which will contain either the default html, or the content from
previous extensions.

#### Static Files

If you have additional static files, you can create a `static` directory in
your extension. These files will be available at `/ext/$modulename/...`

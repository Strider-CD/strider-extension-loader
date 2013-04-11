# Strider Extension Loader

[Strider](https://github.com/Strider-CD/strider) is an extensible CI system, written
in node. Strider extensions are simply NPM packages with additional metadata contained
in a file named `strider.json`. This metadata tells Strider which JavaScript source files
should be loaded and initialized.

Hence, to install a new Strider extension, you can just `npm install` it in your strider
repositiory.

This is a small Node.JS library for loading Strider extensions.

## Strider Extensions

There are several types of Strider extensions: worker, webapp and template.

### Workers

Strider workers are extensions that tell Strider how to execute builds. Builds are comprised of four phases: prepare, test, deploy and cleanup.

Some good examples of Strider worker extensions are:

- [Custom Worker](https://github.com/Strider-CD/strider-custom)
- [Go Strider](https://github.com/Strider-CD/go-strider)

Strider worker extensions specify a `worker` in their `strider.json` - this is a node
module that exposes a function that Strider will call with a context:

```javascript
module.exports = function(ctx, cb){
    console.log("my extension has loaded!")
    cb(null, null)
}
```

### Build Hooks

Workers have four build hooks they can add, which run in order and map to the four Strider build phases:

- **prepare**. Prepare is generally tasked with installing dependencies (e.g. `npm install` or building a Python virtual env + `pip install`). Prepare is always executed first. If prepare fails, `test` and `deploy` will not
be run and the build will be considered to have failed.
- **test**. Execute the tests (e.g. `npm test` or `python setup.py test`). Test is only executed after a successful `prepare`. If `test` fails, `deploy` will not be run and the build will be considered to have failed.
- **deploy**. Deploy code (e.g. push to Heroku or dotCloud or run a custom Fabric script). Deploy is only executed after a successful `test`. If `deploy` fails, the build will be considered to have failed.
- **cleanup**. Cleanup is always executed regardless of whether or not any other hooks have failed.

Build hooks can either be a `string` value or a `function`. If a build hook is a `string` value, it is treated as if it were a UNIX shell command. This is a convenient way to write simple build hooks. For more complicated hooks, pass a `function` that takes a `context` and a `callback`:

```javascript

function prepare(ctx, cb) {
    ctx.striderMessage('my custom prepare function')
    cb(0)
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

### Adding Build Hooks

Worker plugins add build hooks in their initialization function:

```javascript

module.exports = function(ctx, cb) {

    ctx.addBuildHook({
        prepare: function(ctx, cb) {
            ctx.striderMessage('my prepare build hook')
            cb(0)
        },
        test: function(ctx, cb) {
            ctx.striderMessage('my test build hook')
            cb(0)
        },
        deploy: function(ctx, cb) {
            ctx.striderMessage('my deploy build hook')
            cb(0)
        },
        cleanup: function(ctx, cb) {
            ctx.striderMessage('my cleanup build hook')
            cb(0)
        },
    })

    console.log("my extension loaded!")
    cb(null, null)
}

```

The `addBuildHooks` function may be used to conveniently add an array of build hooks at once:

```javascript

module.exports = function(ctx, cb) {

    ctx.addBuildHooks([
        {prepare: firstPrepareFunction},
        {prepare: secondPrepareFunction}
    })

    console.log("my extension loaded!")

    cb(null, null)
}
```

### Conditional Build Hooks

Strider will run all build hooks registered by all plugins on each build. What if you only want to run your build hook under certain conditions?

It is up to the individual build hook to determine what to do. If for example a `test` build hook should only run when the `RUN_MY_HOOK` environment variable is set to `myvalue` it could implement the following logic:

```javascript

module.exports = function(ctx, cb) {
    
    ctx.addBuildHook({test: function(ctx, cb) {
        if (process.env.RUN_MY_HOOK && process.env.RUN_MY_HOOK === 'myvalue') {
            // do my thing
        } else {
            // no-op this build hook by returning 'success' while not doing anything
            return cb(0)
        }
    })
}
```

Since builds hooks are so frequently dependent upon various conditions, Strider supports a special class of build hook called a Detection Rule.

### Simpler Conditional Build Hooks with Detection Rules

Detection Rules are build hooks which are only executed when a condition
matches. Rules are JavaScript objects which allow you to describe the match
conditions using simple predicates. This is powered by the Gumshoe library (https://github.com/niallo/gumshoe).

For example, with a Detection Rule, you can very easily register build hooks for a node.js project. The condition
for a node.js project is `has a file named package.json in project root`. This can be described in a Detection Rule like so:

```javascript
var rule = {filename:"package.json", exists:true, language:"node.js", prepare:"npm install", test:"npm test"}
```

Rules are merely objects with some properties. Strider provides a set of special, reserved property names which are evaluated as predicates:

- `filename`: This is the filename relative to the working copy root to look for. Each rule must have a `filename` property or Strider will complain. Value may be a glob as supported by the [node-glob](https://github.com/isaacs/node-glob) library.
- `grep`: `filename` must exist and content must match the regular expression provided as value to `grep`
- `exists`: Boolean value. `true` means `filename` must exist, `false` means `filename` must not exist. This does not care what kind of file it is.
- `jsonKeyExists`: String value. This is the name of a key in the JSON data which must exist in `filename`. Nested keys can be specified using dot notation. For example, "foo.bar" would match `{"foo":{"bar":1}}`.

When a rule matches, Strider looks for build hooks in the result and sets those.

Detection rules are added via the `addDetectionRule` and `addDetectionRules` functions on the initialization context:


```javascript
// Add one detection rule
ctx.addDetectionRule({
      filename: "**.foo", exists: true // If the repo contains a file with a foo extension
    , language: "FooBar"
    , framework: "Foo"
    , prepare: "make foo"
    , test: "foo test"
    })

// Add multiple detection rules at once
ctx.addDetectionRules([
    {
      filename: "**.foo", exists: true // If the repo contains a file with a foo extension
    , language: "FooBar"
    , framework: "Foo"
    , prepare: "make foo"
    , test: "foo test"
    },
    {
      filename: "package.json", exists: true, // If the repo contains a file named 'package.json'
    , test:"npm test"
    , prepare:"npm install"
    }
])
```


### Webapps

Another type of extension adds endpoints and content to Strider.

This is achieved with a webapp module specified in strider.json which exposes a function
as follows:


```javascript
module.exports = function(ctx, cb) {

  // Add routes to strider:
  ctx.routes.get("/foo/bar", function(req, res, next){
    // This is an express3 route
  })

  // you can use authentication middleware and param validation:

  ctx.routes.post("foo/bar"
    , ctx.middleware.require_auth
    , ctx.middleware.require_params(["url"])
    , function(req, res, next){
      res.send("Hi", req.currentUser.user.email)
    })


  //  you can register 'blocks' to be inserted at
  //  specific points in existing pages. Any element with a class
  // with the 'StriderBlock_' prefix can be specified here:

  ctx.registerBlock('HeaderBrand', function(context){
    // context has a lot of useful stuff on it:

    var email = context.currentUser.user.email

    return "<h1>FooStrider</h1>");
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



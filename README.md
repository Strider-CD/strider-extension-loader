# Strider Extension Loader

[Strider](https://github.com/Strider-CD/strider) is an extensible CI system, written
in node. Strider extensions are simply NPM packages with additional metadata contained
in a file named `strider.json`. This metadata tells Strider which JavaScript source files
should be loaded and initialized.

Hence, to install a new Strider extension, you can just `npm install` it in your strider
repositiory.

This is a small Node.JS library for loading Strider extensions.


## Strider Extensions

There are several types of Strider extensions, namely:

### Workers

Strider workers are extensions that tell Strider how to execute tests or deploys. Some
good examples of Strider worker extensions are:

- [Custom Worker](https://github.com/Strider-CD/strider-custom)
- [Go Strider](https://github.com/Strider-CD/go-strider)
- [Simple Worker](https://github.com/Strider-CD/strider-simple-worker)

Strider worker extensions specify a `worker` in their `strider.json` - this is a node
module that exposes a function that Strider will call with a context:

```javascript
module.exports = function(ctx, cb){
  ...
}
```

The most common thing that you will want to do in that function, is to specify how
to test and deploy certain types of file - this is done with a method called
`addDetectionRule` :


```javascript
ctx.addDetectionRule({
      filename: "**.foo", exists: true // If the repo contains a file with a foo extension
    , language: "FooBar"
    , framework: "Foo"
    , prepare: "make foo"
    , test: "foo test"
    })
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


  // [TODO @peterbraden] you can register 'blocks' to be inserted at
  //  specific points in existing pages. Any element with a class
  // with the 'StriderBlock_' prefix can be specified here:

  ctx.registerBlock('HeaderBrand', function(context, cb){
    // context has a lot of useful stuff on it:

    var email = context.currentUser.user.email

    // You can do async operations etc. in here, but the page won't
    // be served until you call the cb. The callback takes rendered
    // html string:
    cb(null, "<h1>FooStrider</h1>"); //(first argument is an error)
  })


  // [Note] ctx.registerPanel as seen in the sauce webapp is a legacy method
  // that will eventually disappear and should be rewritten as:
  // ctx.registerBlock("ProjectConfigPanel", foo)




  cb(null) // No errors in extension
}
```

#### [TODO: @peterbraden] Templates

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



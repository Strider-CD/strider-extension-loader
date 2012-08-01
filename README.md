### Strider Extension Loader

This is a small Node.JS library for loading Strider extensions. Strider
extensions are simply NPM packages with additional metadata contained in a file
named "strider.json". This metadata tells Strider which JavaScript source files
should be loaded and initialized to extend the web application server and
worker process respectively.

Hence, to install a new Strider extension, you can just `npm install` it.

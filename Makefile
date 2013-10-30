
test: lint test-only

lintfiles := *.js *.json lib

lint:
	@./node_modules/.bin/jshint --verbose --extra-ext $(lintfiles)
	@echo "Linted"

test-only:
	@./node_modules/.bin/mocha -R tap

.PHONY: test test-only lint

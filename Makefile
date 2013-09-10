
test: lint test-only

lintfiles := *.js *.json lib

lint:
	@./node_modules/.bin/jshint --verbose --extra-ext $(lintfiles)
	@echo "Linted"

test-only:
	@echo "No tests"

.PHONY: test test-only lint

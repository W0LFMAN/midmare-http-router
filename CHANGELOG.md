### v1.1.1
* Added Query string default empty object

### v1.1.0
* BREAKING CHANGES
* Now router can't ber used without midmare application

### v1.0.4
* Type fixes

### v1.0.3
* Added simple query parser & body parser
* Added tests


### v1.0.2
* Added github actions publish

### v1.0.1
* Created tests
* Created TravisCI
* Eslint added
* Added license
* Added gulp

### v1.0.0
* Created `HttpRouter` nested by router.
* Changed functionality of `HttpRouter`.
* Extended `context` inside http router. Now you can use `ctx.[body, header, headers, set, get, status, message, remove, has, type, length, send, end, json]`

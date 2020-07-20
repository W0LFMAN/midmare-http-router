[![npm version](https://badge.fury.io/js/midmare-http-router.svg)](https://www.npmjs.com/midmare-http-router)
[![Build Status](https://travis-ci.com/W0LFMAN/midmare-http-router.svg?branch=master)](https://travis-ci.com/W0LFMAN/midmare-http-router)
[![codecov.io](https://codecov.io/github/W0LFMAN/midmare-http-router/coverage.svg?branch=master)](https://codecov.io/github/W0LFMAN/midmare-http-router?branch=master)

```js
const { createServer } = require('http');
const { default: mid } = require('midmare');
const { Router: { HttpRouter, delegateHttp } } = require('midmare-http-router');

// HTTP ROUTER
const app = mid();
const httpRouter = new HttpRouter();

// Use named function declaration to 
httpRouter.process('/', function get(ctx) {
    ctx.status = 200;
    ctx.body = { ololo:1 };
});
app.use(httpRouter).init();

// Be sure that you use `delegateHttp` on app.
// delegateHttp make app understand that at some moment you will get request response object. And it will be injected to context.
createServer(delegateHttp(app)).listen(3000);
```
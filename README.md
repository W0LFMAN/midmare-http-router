[![npm version](https://badge.fury.io/js/midmare-http-router.svg)](https://www.npmjs.com/midmare-http-router)
[![Build Status](https://travis-ci.com/W0LFMAN/midmare-http-router.svg?branch=master)](https://travis-ci.com/W0LFMAN/midmare-http-router)
[![codecov.io](https://codecov.io/github/W0LFMAN/midmare-http-router/coverage.svg?branch=master)](https://codecov.io/github/W0LFMAN/midmare-http-router?branch=master)

```js
const { createServer } = require('http');
const { Router: { HttpRouter } } = require('midmare-http-router');

// HTTP ROUTER

const httpRouter = new HttpRouter();

// Use named function declaration to 
httpRouter.process('/', function get(ctx) {
    ctx.status = 200;
    ctx.body = { ololo:1 };
});

createServer(httpRouter.routes()).listen(3000);
```
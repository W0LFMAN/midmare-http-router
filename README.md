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
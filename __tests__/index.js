const fs = require('fs');
const http = require('http');
const assert = require('assert');
const request = require('supertest');
const {Router: {HttpRouter, delegateHttp}} = require('../');
const {default: mid} = require('midmare');

describe('Midmare HttpRouter test: ', () => {
  it('should delegate request,response objects to ctx in Application', async function () {
    const app = mid();
    
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      assert(ctx.request instanceof http.IncomingMessage, 'Error: Request object must be in context');
      assert(ctx.response instanceof http.ServerResponse, 'Error: Response object must be in context');
    });
    
    app
      .use(router.routes())
      .init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(200);
  });
  
  it('should response "Hello world!"', async () => {
    const app = mid();
    
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.status = 200;
      ctx.message = 'OK';
      ctx.type = 'text/plain';
      ctx.body = 'Hello World!';
      
      assert.strictEqual(ctx.status, 200);
      assert.strictEqual(ctx.type, 'text/plain');
      assert.strictEqual(ctx.message, 'OK');
      assert.strictEqual(ctx.body, 'Hello World!');
      assert.strictEqual(ctx.url, '/');
    });
    
    app
      .use(router.routes())
      .init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(200);
  });
  
  it('should response 404', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.body = 'Hello World!';
    });
    
    app
      .use(router.routes())
      .init();
    
    await request(delegateHttp(app))
      .get('/ololo')
      .expect(404);
    
  });
  
  it('should use `send` & `end` methods', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/route/1', function get(ctx) {
      ctx.end('Hello World!1');
    });
    
    router.process('/route/2', function get(ctx) {
      ctx.send('Hello World!2');
    });
    
    app
      .use(router.routes()).init();
    
    const res1 = await request(delegateHttp(app))
      .get('/route/1');
    
    const res2 = await request(delegateHttp(app))
      .get('/route/2');
    
    expect(res1.text).toEqual('Hello World!1');
    expect(res2.text).toEqual('Hello World!2');
  });
  
  it('should redirect: ', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/route', function get(ctx) {
      ctx.redirect('/');
    });
    
    router.process('/route/2', function get(ctx) {
      ctx.redirect('back');
    });
    
    app.use(router.routes()).init();
    
    const res1 = await request(delegateHttp(app))
      .get('/route');
    
    const res2 = await request(delegateHttp(app))
      .get('/route/2');
    
    expect(res1.status).toEqual(302);
    expect(res2.status).toEqual(302);
  });
  
  it('should handle end: ', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/route', function get(ctx) {
      ctx.status = 200;
      ctx.body = fs.createReadStream('LICENSE');
      ctx.req.socket.on('finish', () => {
        assert.strictEqual(!ctx.writable, true);
      });
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/route')
      .expect(200);
  });
  
  it('should force response buffer: ', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/route', function get(ctx) {
      ctx.status = 200;
      ctx.body = Buffer.from('Hello World!');
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/route')
      .expect(200);
  });
  
  it('should response 500', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/', function get() {
      throw new Error;
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(500)
  });
  
  it('should respond `bin`', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.body = Buffer.from('bin');
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(200);
    
    await request(delegateHttp(app))
      .get('/not-matched')
      .expect(404);
    
  });
  
  it('should body be string', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      
      ctx.set({
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength('some-string')
      });
      ctx.body = 'some-string';
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(200)
  });
  
  it('should body be html', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.set('Content-Type', 'text/html');
      ctx.set('Some-Ololo', ['123', 321]);
      ctx.body = '<h1>Hello World</h1>';
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(200);
  });
  
  it('should body be null', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.body = null;
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(204);
  });
  
  it('should body be json', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.type = '';
      ctx.body = {ololo: 1};
    });
    
    app.use(router).init();
    
    await request(delegateHttp(app))
      .get('/')
      .expect(200);
  });
  
  it('should parse body & query string', async () => {
    const app = mid();
    const router = new HttpRouter();
    
    router.process('/body/query', function post(ctx) {
      ctx.status = 200;
      ctx.type = 'json';
      ctx.json({
        body: ctx.data,
        query: ctx.query
      });
      
    });
    
    router.process('/', function head(ctx) {
      ctx.body = 'HEAD';
      ctx.remove('Content-Length');
    });
    
    app.use(router).init();
    
    const server = require('http').createServer(delegateHttp(app)).listen();
    
    await request(server)
      .post('/body/query?a=1&b=2&c=3&doubleVal=4&doubleVal=4')
      .send({"z": 999, "x": 998, "y": 997})
      .set('Accept', 'application/json')
      .expect(200);
    
    await request(server)
      .post('/body/query?r=1&b=2&c=3&doubleVal=4&doubleVal=4')
      .send('Bad JSON')
      .expect(200);
    
    await request(server)
      .head('/')
      .expect(200);
    
    
    server.close();
  });
  
});

const fs = require('fs');
const assert = require('assert');
const request = require('supertest');
const { Router: { HttpRouter } } = require('../');

describe('Midmare HttpRouter test: ',  () => {
  it('should response "Hello world!"', async () => {
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
    
    await request(router.routes())
      .get('/')
      .expect(200);
  });
  
  it('should response 404', async () => {
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.body = 'Hello World!';
    });
    
    
    await request(router.routes())
      .get('/ololo')
      .expect(404);
  });
  
  it('should use `send` & `end` methods', async () => {
    const router = new HttpRouter();
    
    router.process('/route/1', function get(ctx) {
      ctx.end('Hello World!1');
    });
  
    router.process('/route/2', function get(ctx) {
      ctx.send('Hello World!2');
    });
    
    const routes = router.routes();
    
    const res1 = await request(routes)
      .get('/route/1');
  
    const res2 = await request(routes)
      .get('/route/2');
    
    expect(res1.text).toEqual('Hello World!1');
    expect(res2.text).toEqual('Hello World!2');
  });
  
  it('should redirect: ',  async () => {
    const router = new HttpRouter();
  
    router.process('/route', function get(ctx) {
      ctx.redirect('/');
    });
  
    router.process('/route/2', function get(ctx) {
      ctx.redirect('back');
    });
  
    const routes = router.routes();
  
    const res1 = await request(routes)
      .get('/route');
  
    const res2 = await request(routes)
      .get('/route/2');
    
    expect(res1.status).toEqual(302);
    expect(res2.status).toEqual(302);
  });
  
  it('should handle end: ', async () => {
    const router = new HttpRouter();
    
    router.process('/route', function get(ctx) {
      ctx.status = 200;
      ctx.body = fs.createReadStream('LICENSE');
      ctx.req.socket.on('finish', () => {
        assert.strictEqual(ctx.responded, true);
      });
    });
    
    await request(router.routes())
      .get('/route')
      .expect(200);
  });
  
  it('should force response buffer: ', async () => {
    const router = new HttpRouter();
    
    router.process('/route', function get(ctx) {
      ctx.status = 200;
      ctx.body = Buffer.from('Hello World!');
      ctx.__handleEnd();
    });
    
    await request(router.routes())
      .get('/route')
      .expect(200);
  });
  
  it('should response 500', async () => {
    const router = new HttpRouter();
    
    router.process('/', function get() {
      throw new Error;
    });
    
    await request(router.routes())
      .get('/')
      .expect(500)
  });
  
  it('should respond `bin`',  async () => {
    const router = new HttpRouter();
  
    router.process('/', function get(ctx) {
      ctx.body = Buffer.from('bin');
    });
  
    await request(router.routes())
      .get('/')
      .expect(200);
  });
  
  it('should body be string', async () => {
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
  
      ctx.set({
        'Content-Type': 'text/plain'
      });
      ctx.body = 'some-string';
    });
    
    await request(router.routes())
      .get('/')
      .expect(200)
  });
  
  it('should body be html', async () => {
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.set('Content-Type', 'text/html');
      ctx.set('Some-Ololo', ['123', 321]);
      ctx.body = '<h1>Hello World</h1>';
    });
    
    await request(router.routes())
      .get('/')
      .expect(200);
  });
  
  it('should body be null', async () => {
     const router = new HttpRouter();
  
     router.process('/', function get(ctx) {
       ctx.body = null;
     });
  
     await request(router.routes())
       .get('/')
       .expect(204);
  });
  
  it('should body be json', async () => {
    const router = new HttpRouter();
    
    router.process('/', function get(ctx) {
      ctx.type = '';
      ctx.body = { ololo: 1 };
      assert.strictEqual(ctx.length, '');
    });
    
    await request(router.routes())
      .get('/')
      .expect(200);
  });
  
});
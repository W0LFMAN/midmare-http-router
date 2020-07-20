import * as url from "url";
import * as http from "http";
import * as assert from "assert";
import * as qs from 'querystring';
import * as Midmare from "midmare";
import {Stream} from "stream";
import {Application} from "midmare/dist";

export namespace Router {
    export function delegateHttp(app: Application.Application): Midmare.Application.Callback {
        return <Data extends any>(request: http.IncomingMessage | Midmare.Router.Path, response: http.ServerResponse | Data, ctx: Midmare.Context.Context | NodeJS.Dict<any>) => {
            if(request instanceof http.IncomingMessage && response instanceof http.ServerResponse)
                return app.handler(url.parse(request.url || '').pathname || '', null, { request, response });
            else return app.handler(request as Midmare.Router.Path, response, ctx);
        };
    }

    export class HttpRouter extends Midmare.Router.Router {
        constructor(options: Midmare.Router.IOptions) {
            super(options);

            this.use(async (ctx, next) => {
                try {
                    await next();
                } catch (err) {
                    ctx.status = 500;
                    ctx.message = 'Server Error';
                    ctx.json({
                        status: 500,
                        error: {
                            name: err.name,
                            message: err.message,
                            stack: err.stack
                        },
                    });
                }
            });

            // query string parser
            this
                .use(async (ctx, next) => {
                    const {query} = url.parse(ctx.url);

                    if (query) {
                        ctx.query = qs.parse(query);
                    }

                    await next();
                })
                .use(async (ctx, next) => {
                    if (ctx.method === 'POST') {
                        ctx.data = await new Promise((resolve, reject) => {
                            const body: Buffer[] = [];

                            ctx.req.on('data', chunk => {
                                body.push(chunk);
                            });

                            ctx.req.on('error', reject);

                            ctx.req.on('end', () => {
                                const result = Buffer.concat(body).toString('utf-8');
                                try {
                                    resolve(JSON.parse(result));
                                } catch (e) {
                                    resolve(result);
                                }
                            });
                        });

                        return await next();
                    }
                    return await next();
            })
        }

        protected upgrade(ctx: Midmare.Context.Context, request: http.IncomingMessage, response: http.ServerResponse): Midmare.Context.Context {
            Object.defineProperties(ctx, {
                originRequest: {
                    value: request,
                    configurable: false
                },
                originResponse: {
                    value: response,
                    configurable: false
                },
                req: {
                    value: request,
                    configurable: false
                },
                res: {
                    value: response,
                    configurable: false
                },
                request: {
                    value: request,
                    configurable: false
                },
                response: {
                    value: response,
                    configurable: false
                },
                method: {
                    get() {
                        return request.method;
                    },
                    configurable: false
                },
                url: {
                    get() {
                        return request.url;
                    },
                    configurable: false,
                },
                path: {
                    get() {
                        return url.parse(request.url!).pathname;
                    },
                    configurable: false,
                },
                headerSent: {
                    get() {
                        return response.headersSent;
                    },
                    configurable: false,
                },
                status: {
                    get() {
                        return response.statusCode;
                    },
                    set(code) {
                        assert(
                            code >= 100 && code <= 999 &&
                            Number.isInteger(code) &&
                            Number.isFinite(code),
                            new Error(`Invalid status code: ${code}, must be a number & in range 100 ~ 999.`)
                        );
                        response.statusCode = code;
                    },
                    configurable: false,
                },
                message: {
                    get() {
                        return response.statusMessage;
                    },
                    set(val) {
                        assert(typeof val === 'string', new TypeError('statusMessage must a string type.'))
                        response.statusMessage = val;
                    },
                    configurable: false,
                },
                body: {
                    get() {
                        return this._body;
                    },
                    set(value) {
                        this._body = value;

                        if (this._body === null) {
                            this.status = 204;
                            this.remove('Content-Type');
                            this.remove('Content-Length');
                            this.remove('Transfer-Encoding');
                            return;
                        }

                        const hasContentType = !this.has('Content-Type');


                        if (Buffer.isBuffer(value)) {
                            if (hasContentType) this.type = 'bin';
                            this.length = value.length;
                            return;
                        }

                        if (this._body instanceof Stream) {
                            response.socket.once('finish', () => {
                                response.destroy();
                            });

                            if (this.body !== value) {
                                value.once('error', err => ctx.error(err));
                                // overwriting
                                if (this.body !== null) this.remove('Content-Length');
                            }

                            if (hasContentType) this.type = 'bin';
                            return;
                        }

                        if (typeof value === 'string') {
                            if (hasContentType) this.type = /^\s*</.test(value) ? 'html' : 'text';
                            this.length = Buffer.byteLength(value);
                            return;
                        }

                        this.remove('Content-Length');
                        this.type = 'json';
                    },
                    configurable: false
                },
                remove: {
                    value: function (field) {
                        if (this.headerSent) return;
                        response.removeHeader(field);
                    },
                    configurable: false
                },
                set: {
                    value: function set(field, val) {
                        if (this.headerSent) return;

                        if (arguments.length === 2) {
                            if (Array.isArray(val)) val = val.map(v => typeof v === 'string' ? v : String(v));
                            else if (typeof val !== 'string') val = String(val);
                            response.setHeader(field, val);
                        } else {
                            for (const key in field) {
                                this.set(key, field[key]);
                            }
                        }
                    },
                    configurable: false
                },
                get: {
                    value: function (field) {
                        const headers = typeof response.getHeaders === 'function'
                            ? response.getHeaders()
                            : {} as http.OutgoingHttpHeaders;

                        if (!field) return headers;
                        return headers[field.toLowerCase()] || '';
                    },
                    configurable: false
                },
                has: {
                    value: function (field) {
                        return typeof response.hasHeader === 'function'
                            ? response.hasHeader(field)
                            : field.toLowerCase() in this.headers;
                    },
                    configurable: false
                },
                type: {
                    get() {
                        const contentType = this.get('Content-Type');
                        if (!contentType) return '';
                        return contentType.split(';', 1)[0];
                    },
                    set(contentType) {
                        if (contentType) {
                            this.set('Content-Type', contentType);
                        } else {
                            this.remove('Content-Type');
                        }
                    },
                    configurable: false,
                },
                length: {
                    get() {
                        if (this.has('Content-Length')) {
                            return parseInt(this.get('Content-Length'), 10) || 0;
                        }

                        if (!this.body || this.body instanceof Stream) return undefined;
                        if ('string' === typeof this.body) return Buffer.byteLength(this.body);
                        if (Buffer.isBuffer(this.body)) return this.body.length;
                        return Buffer.byteLength(JSON.stringify(this.body));
                    },
                    set(len) {
                        this.set('Content-Length', len);
                    },
                    configurable: false,
                },
                respond: {
                    value: true,
                    writable: true
                },
                writable: {
                    get() {
                        return !(response.writableEnded || response.finished); /* `finished` for NodeJS <= 10 */
                    },
                    configurable: false,
                },
                send: {
                    value(data) {
                        response.end(data);
                    },
                    configurable: false
                },
                end: {
                    value(data) {
                        response.end(data);
                    },
                    configurable: false
                },

                json: {
                    value(data) {
                        response.end(JSON.stringify(data));
                    },
                    configurable: false
                },
                redirect: {
                    value(url, alt) {
                        if ('back' === url) url = ctx.get('Referrer') || alt || '/';
                        this.set('Location', url);

                        this.status = 302;

                        // text
                        this.type = 'text/plain; charset=utf-8';
                        this.body = `Redirecting to ${url}.`;
                    },
                    configurable: false
                }
            });

            return ctx;
        }

        // Simple http routes handling.
        public routes(): Midmare.Application.Callback {
            const routes: Midmare.Middleware.Middleware = (ctx: Midmare.Context.Context, next?: Midmare.Middleware.NextCallback) => {
                next = typeof next === 'function' ? next : (err?: Error) => err ? ctx.error(err) : ctx.next && ctx.next();

                ctx = this.upgrade(
                    Midmare.Context.Context.clone(ctx),
                    ctx.request,
                    ctx.response
                );

                const executor = (ctx: Midmare.Context.Context, next: Midmare.Middleware.NextCallback): any => {
                    const method = ctx.method ? ctx.method.toLowerCase() : ctx.method;
                    const path = this.options.routerPath || ctx.routerPath || ctx.path;

                    const matched = this.match(path);

                    if (ctx.matched) {
                        ctx.matched.push.apply(ctx.matched, matched.path);
                    } else {
                        ctx.matched = matched.path;
                    }

                    if (!matched.route && next) return next();
                    else if(!matched.route) return Promise.resolve();

                    const matchedRoutes = matched.path;
                    const mostSpecificRoute = matchedRoutes[matchedRoutes.length - 1];
                    ctx._matchedRoute = mostSpecificRoute.path;
                    if (mostSpecificRoute.name) {
                        ctx._matchedRouteName = mostSpecificRoute.name;
                    }

                    const routeChain = matchedRoutes.reduce((memo: Midmare.Middleware.Middleware[], route: Midmare.Route.Route) => {
                        memo.push((ctx, next) => {
                            ctx.captures = route.captures(path);
                            ctx.params = route.params(ctx.captures, ctx.params);
                            ctx.routerName = route.name;
                            return next();
                        });

                        return memo.concat(route.stack.filter(mw => mw.method === method || !mw.method));
                    }, [] as Midmare.Middleware.Middleware[]);

                    return Midmare.Application.Application.createCompose([...routeChain, ctx => {
                        ctx.status = 404;
                        ctx.body = {status: 404, message: 'Not Found'};
                    }])(ctx);
                };

                executor(ctx, next).then(() => {
                    if (ctx.writable && ctx.respond !== false) {
                        if ([204, 205, 304].includes(ctx.status)) {
                            ctx.body = null;
                            ctx.end();
                        }

                        if (ctx.method === 'HEAD') {
                            if (!ctx.headersSent && !ctx.has('Content-Length')) {
                                const len = ctx.length;
                                if (Number.isInteger(ctx.length)) ctx.length = len;
                            }
                            return ctx.end();
                        }

                        if (ctx._body instanceof Stream) return ctx.body!.pipe(ctx.response);

                        if ([null, undefined].includes(ctx._body)) {
                            ctx.remove('Content-Type');
                            ctx.remove('Transfer-Encoding');
                            return ctx.response.end();
                        }

                        if (Buffer.isBuffer(ctx._body)) return ctx.response.end(ctx._body);
                        if (typeof ctx._body === 'string') return ctx.response.end(ctx._body);

                        ctx.body = JSON.stringify(ctx._body);
                        if (!ctx.response.headersSent) {
                            ctx.length = Buffer.byteLength(ctx.body);
                        }
                        ctx.response.end(ctx.body);
                    }
                });
            };

            routes.router = this;
            routes.http = true;

            return routes;
        }
    }
}

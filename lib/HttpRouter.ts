import * as url from "url";
import * as http from "http";
import * as assert from "assert";
import * as Midmare from "midmare";
import {Stream} from "stream";

export namespace Router {
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
        }

        protected extendContext(ctx: Midmare.Context.Context, request: http.IncomingMessage, response: http.ServerResponse): Midmare.Context.Context {
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
                    configurable: false,
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

                        if (value === null) {
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

                        if (value instanceof Stream) {
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
                    configurable: false,
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
                        return this.get('Content-Length');
                    },
                    set(len) {
                        this.set('Content-Length', len);
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
                },
                __handleEnd: {
                    value() {
                        if(!response.writableEnded) {
                            if (this._body instanceof Stream) return this._body.pipe(response);

                            if (this._body === null) return response.end();
                            if (Buffer.isBuffer(this._body)) return response.end(this._body);
                            if (typeof this._body === 'string') return response.end(this._body);


                            this.body = JSON.stringify(this._body);
                            if (!response.headersSent) {
                                ctx.length = Buffer.byteLength(this._body);
                            }
                            response.end(this.body);
                        }
                    },
                    enumerable: false,
                    configurable: false
                }
            });
            return ctx;
        }

        // Simple http routes handling.
        public routes(): Midmare.Application.Callback {
            return (request: http.IncomingMessage, response: http.ServerResponse) => {
                const ctx: Midmare.Context.Context = Object.create(new Midmare.Context.Context({
                    path: url.parse(request.url!).pathname,
                    app: {options: {}} as Midmare.Application.Application
                }));

                this.extendContext(ctx, request, response);

                ((ctx: Midmare.Context.Context, next?: Midmare.Middleware.NextCallback): void => {
                    next = next || ctx.next || ((err: Error) => { ctx.error(err || new Error('No `ctx.next`.')); });
                    const method = ctx.method ? ctx.method.toLowerCase() : ctx.method;
                    const path = this.options.routerPath || ctx.routerPath || ctx.path;

                    this.use(ctx => {
                        ctx.status = 404;
                        ctx.json({
                            status: 404,
                            message: 'NotFound'
                        });
                    });

                    const matched = this.match(path);

                    if (ctx.matched) {
                        ctx.matched.push.apply(ctx.matched, matched.path);
                    } else {
                        ctx.matched = matched.path;
                    }

                    if (!matched.route) return next!();

                    const matchedRoutes = matched.path;
                    const mostSpecificRoute = matchedRoutes[matchedRoutes.length - 1];
                    ctx._matchedRoute = mostSpecificRoute.path;
                    if (mostSpecificRoute.name) {
                        ctx._matchedRouteName = mostSpecificRoute.name;
                    }

                    const routeChain = matchedRoutes.reduce((memo, route) => {
                        memo.push((ctx, next) => {
                            ctx.captures = route.captures(path);
                            ctx.params = route.params(ctx.captures, ctx.params);
                            ctx.routerName = route.name;
                            return next();
                        });
                        return memo.concat(route.stack.filter(mw => mw.method === method || !mw.method));
                    }, [] as Midmare.Middleware.Middleware[]);

                    return Midmare.Application.Application.createCompose(routeChain)(ctx, next)
                        .then(() => ctx.__handleEnd()).catch(ctx.error);
                })(ctx);
            };
        }
    }
}

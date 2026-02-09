import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("energi-extractor");

export function withSpan<T>(name: string, fn: (span: Span) => T): T {
  return tracer.startActiveSpan(name, (span) => {
    let result: T;
    try {
      result = fn(span);
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
      span.end();
      throw e;
    }
    if (result instanceof Promise) {
      return result
        .catch((e) => {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
          throw e;
        })
        .finally(() => span.end()) as T;
    }
    span.end();
    return result;
  });
}

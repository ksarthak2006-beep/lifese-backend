/**
 * Senior Production Telemetry
 * Tracks API performance, errors, and throughput in real-time.
 */

const metrics = {
    requests: 0,
    errors: 0,
    latency: [],
};

export const telemetryMiddleware = (req, res, next) => {
    const start = process.hrtime();
    metrics.requests++;

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const ms = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);

        if (res.statusCode >= 400) metrics.errors++;

        // Log performance for slow requests (>200ms)
        if (parseFloat(ms) > 200) {
            console.warn(`🐢 [Slow Request] ${req.method} ${req.url} took ${ms}ms`);
        }
    });

    next();
};

export const getMetrics = (req, res) => {
    res.json({
        uptime: process.uptime(),
        ...metrics,
        avgLatency: metrics.latency.length
            ? (metrics.latency.reduce((a, b) => a + b, 0) / metrics.latency.length).toFixed(2)
            : '0.00'
    });
};

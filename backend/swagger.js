const swaggerJSDoc = require('swagger-jsdoc');


const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Jobblo API',
        version: '1.0.0',
        description: 'Swagger documentation for Jobblo',
    },
    servers: [
        {
            url: process.env.PORT || 'http://localhost:5000',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT token with Bearer prefix, e.g. "Bearer eyJhb..."',
            },
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'token',
                description: 'Use cookie named "token" for authentication',
            },
        },
    },
    // Global security applies to all routes unless overridden
    security: [
        { bearerAuth: [] },
        { cookieAuth: [] }
    ],
};

const options = {
    swaggerDefinition,
    apis: ['./routes/*.js'], // Reads JSDoc comments in route files
};

module.exports = swaggerJSDoc(options);

const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Jobblo API',
        version: '1.0.0',
        description: 'Swagger-dokumentasjon for Jobblo',
    },
    servers: [
        {
            url: 'http://localhost:5000',
        },
    ],
};

const options = {
    swaggerDefinition,
    apis: ['./routes/*.js'], // Leser kommentarer i dine route-filer
};

module.exports = swaggerJSDoc(options);

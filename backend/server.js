const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
const port = 5000;

app.use(express.json());

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Test-endepunkt for å sjekke at API-et kjører
 *     responses:
 *       200:
 *         description: API fungerer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Jobblo test-API kjører! 🚀
 */
app.get('/api/test', (req, res) => {
    res.json({ message: 'Jobblo test-API kjører! 🚀' });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(port, () => {
    console.log(`Jobblo test-API kjører på http://localhost:${port}`);
    console.log(`Swagger-docs på http://localhost:${port}/api/docs`);
});

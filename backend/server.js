const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
require('dotenv').config({ path: __dirname + '/.env' });

const connectDB = require('./db');
connectDB()
  .then(() => console.log('✅  MongoDB connected'))
  .catch(err => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

const app = require('./app');
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
  console.log(`🚀  Jobblo API listening on http://localhost:${port}`);
  console.log(`Swagger-docs på http://localhost:${port}/api/docs`);
});

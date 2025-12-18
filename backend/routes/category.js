const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const {authenticate ,requireAdmin} = require('../middleware/auth');
/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: Kategori-ID
 *         name:
 *           type: string
 *           description: Kategorinavn
 *         slug:
 *           type: string
 *           description: URL-vennlig versjon
 *         description:
 *           type: string
 *           description: Beskrivelse
 *         icon:
 *           type: string
 *           description: Ikon for UI
 *         isActive:
 *           type: boolean
 *           description: Om kategorien er aktiv
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Opprett en ny kategori
 *     tags: [Kategorier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Kategorinavn
 *               description:
 *                 type: string
 *                 description: Beskrivelse
 *               icon:
 *                 type: string
 *                 description: Ikon for UI
 *     responses:
 *       201:
 *         description: Kategori opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Ugyldig input eller kategori eksisterer allerede
 */
router.post('/', authenticate, requireAdmin, categoryController.createCategory);

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Hent alle aktive kategorier
 *     tags: [Kategorier]
 *     responses:
 *       200:
 *         description: Liste over kategorier
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 */
router.get('/', categoryController.getAllCategories);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Hent en spesifikk kategori
 *     tags: [Kategorier]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kategori-ID
 *     responses:
 *       200:
 *         description: Kategori funnet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         description: Kategori ikke funnet
 */
router.get('/:id', categoryController.getCategoryById);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Oppdater en kategori
 *     tags: [Kategorier]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kategori-ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Kategori oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         description: Kategori ikke funnet
 */
router.put('/:id', authenticate, requireAdmin, categoryController.updateCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Slett en kategori
 *     tags: [Kategorier]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kategori-ID
 *     responses:
 *       200:
 *         description: Kategori slettet
 *       404:
 *         description: Kategori ikke funnet
 */
router.delete('/:id', authenticate, requireAdmin, categoryController.deleteCategory);

module.exports = router;
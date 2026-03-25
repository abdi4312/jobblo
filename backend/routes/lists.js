const express = require("express");
const router = express.Router();
const listController = require("../controllers/listController");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, listController.getUserLists);
router.get("/:listId", authenticate, listController.getListById);
router.post("/", authenticate, listController.createList);
router.put("/:listId", authenticate, listController.updateList);
router.post("/add-service", authenticate, listController.addServiceToList);
router.post(
  "/:listId/contributors",
  authenticate,
  listController.addContributors,
);
router.delete(
  "/:listId/contributors/:userId",
  authenticate,
  listController.removeContributor,
);
router.delete(
  "/remove-service/:listId/:serviceId",
  authenticate,
  listController.removeServiceFromList,
);
router.delete("/:listId", authenticate, listController.deleteList);
router.post("/:listId/follow", authenticate, listController.toggleFollowList);

module.exports = router;

const express = require("express");
const router = express.Router();
const { body, validationResult, oneOf } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const { flatten } = require("./utils");

module.exports = (app, client) => {
  router.get("/assets", (req, res) => {
    const cursor = client.resourcesCollection.find({}, {});
    cursor.toArray((err, items) => {
      if (err) return console.error(err);
      return res.json(items);
    });
  });

  router.get("/assets/:id", (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    client.resourcesCollection.findOne({ id }, (err, result) => {
      if (err) return res.status(400).json({ error: err.message });

      return res.status(200).json(result);
    });
  });

  router.delete("/assets/:id", (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    client.resourcesCollection.deleteOne({ id }, (err, result) => {
      if (err) return res.status(400).json({ error: err.message });

      return res.status(200).json(result);
    });
  });

  router.post(
    "/assets",
    body("title").isString(),
    body("description").isString(),
    body("images").isArray(),
    body("images.*.url").isString(),
    body("images.*.height").isNumeric(),
    body("images.*.width").isNumeric(),
    body("images.*.type").isString().optional(),
    body("type")
      .isString()
      .isIn(["Plugin", "3D Asset", "2D Asset", "SFX", "VFX", "Other"]),
    body("tags").isArray(),
    body("tags.*.name").isString(),
    body("tags.*.path").isString(),
    body("category").isString().isIn(["UE4", "Unity", "Misc", "General"]),
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const asset = {
        id: uuidv4(),
        title: req.body.title,
        description: req.body.description,
        images: req.body.images,
        type: req.body.type,
        tags: req.body.tags,
        category: req.body.category,
        addedAt: new Date().getTime(),
      };

      client.resourcesCollection.insertOne(asset, (err, result) => {
        if (err) return res.status(400).json({ error: err.message });

        return res.status(201).json(asset);
      });
    }
  );

  router.patch(
    "/assets/:id",
    oneOf([
      body("title").isString(),
      body("description").isString(),
      body("images").isArray(),
      body("images.*.url").isString(),
      body("images.*.height").isNumeric(),
      body("images.*.width").isNumeric(),
      body("images.*.type").isString().optional(),
      body("type")
        .isString()
        .isIn(["Plugin", "3D Asset", "2D Asset", "SFX", "VFX", "Other"]),
      body("category").isString().isIn(["UE4", "Unity", "Misc", "General"]),
    ]),
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const id = req.params.id;
      if (!id) return res.status(400).json({ error: "Invalid ID" });

      client.resourcesCollection.updateOne(
        { id },
        { $set: flatten(req.body) },
        (err, _) => {
          if (err) return res.status(400).json({ error: err.message });

          client.resourcesCollection.findOne({ id }, (err2, result) => {
            if (err2) return res.status(400).json({ error: err2.message });

            return res.status(200).json(result);
          });
        }
      );
    }
  );

  return router;
};

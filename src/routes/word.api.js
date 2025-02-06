const express = require("express");

const { generateWords } = require("../utils/getWords");
const router = express.Router();

router.get("/random", async (req, res) => {
  try {
    const randomWords = generateWords();
    res.status(200).json(randomWords);
  } catch (err) {
    res.status(404).json(err);
  }
});

module.exports = router;

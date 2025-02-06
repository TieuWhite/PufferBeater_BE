const express = require("express");
const Result = require("../models/Result");
const User = require("../models/User");
const router = express.Router();

router.get("/leaderboard", async (req, res) => {
  try {
    const results = await Result.find()
      .populate("player1", "username")
      .populate("player2", "username");

    const sortedResults = results.sort((a, b) => {
      const maxScoreA = Math.max(a.player1Score, a.player2Score);
      const maxScoreB = Math.max(b.player1Score, b.player2Score);
      return maxScoreA - maxScoreB;
    });

    res.status(200).json(sortedResults);
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ message: "Failed to fetch results" });
  }
});

router.get("/history", async (req, res) => {
  const { name } = req.query;
  try {
    const user = await User.findOne({ username: name });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matches = await Result.find({ _id: { $in: user.matchHistory } })
      .populate("player1", "username")
      .populate("player2", "username")
      .sort({ createdAt: -1 });

    res.status(200).json(matches);
  } catch (error) {
    console.error("Error fetching user history:", error);
    res.status(500).json({ message: "Failed to fetch user history" });
  }
});

module.exports = router;

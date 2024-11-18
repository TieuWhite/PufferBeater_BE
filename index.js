require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const randomWords = require("random-words");

const app = express();
jsonParser = bodyParser.json();

app.use(jsonParser);
// app.use("/api/solo", require("./routes/solo.api"));
app.get("/random-words", (req, res) => {
  const words = randomWords({ exactly: 10 });
  3;
  res.json({ words });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB");
    const PORT = process.env.PORT;
    app.listen(PORT, () => {
      console.log(`server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

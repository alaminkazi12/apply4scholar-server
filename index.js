const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Apply4scholar is working");
});

app.listen(port, () => {
  console.log(`Apply4scholar server is running on port ${port}`);
});

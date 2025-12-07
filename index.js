const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const port = process.env.PORT || 3000;

app.use(express.json());

app.use(
  cors({
    origin: process.env.CLIENT_DOMAIN || "http://localhost:5173",
    credentials: true,
  })
);

// MongoDB
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.e1tbnr7.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("tutor_bazar_db");
    const userCollection = db.collection("users");

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.createdAt = new Date();

      const userExists = await userCollection.findOne({ email: user.email });

      if (userExists) {
        return res.send({ message: "user exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });
  } catch (err) {
    console.log(err);
  }
}

run(); // <-- এখানে ঠিক আছে

// default route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});

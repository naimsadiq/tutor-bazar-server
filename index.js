const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const studentPostCollection = db.collection("student-post");
    const teacherProfilesCollection = db.collection("teacher_profiles");

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

    app.get("/student-post", async (req, res) => {
      try {
        const email = req.query.email;
        console.log(email);

        // IMPORTANT: যদি email না থাকে → রিকোয়েস্ট ব্লক করুন
        if (!email) {
          return res.status(400).send({
            error: true,
            message: "Email query parameter is required",
          });
        }

        console.log("User Email:", email);

        const result = await studentPostCollection
          .find({ studentEmail: email })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("GET /student-post Error:", error);
        res.status(500).send({
          error: true,
          message: "Failed to fetch the tutor request",
        });
      }
    });

    app.get("/student-post", async (req, res) => {
      try {
        const result = await studentPostCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("GET /student-post Error:", error);
        res.status(500).send({
          error: true,
          message: "Failed to fetch tutor requests",
        });
      }
    });

    app.get("/student-post/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await studentPostCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error("GET /student-post/:id Error:", error);
        res.status(500).send({
          error: true,
          message: "Failed to fetch the tutor request",
        });
      }
    });
    

    // Get last 6 tutor requests
    app.get("/student-post-latest", async (req, res) => {
      try {
        const latestRequests = await studentPostCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send(latestRequests);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch latest tutor requests",
          error: error.message,
        });
      }
    });

    app.post("/student-post", async (req, res) => {
      try {
        const data = req.body;
        data.createdAt = new Date();
        const result = await studentPostCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ error: true, message: error.message });
      }
    });

    app.get("/teacher-profile", async (req, res) => {
      try {
        const result = await teacherProfilesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ error: true, message: error.message });
      }
    });

    app.get("/teacher-profile/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await teacherProfilesCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error("GET /student-post/:id Error:", error);
        res.status(500).send({
          error: true,
          message: "Failed to fetch the tutor request",
        });
      }
    });

    // Get last 6 tutor requests
    app.get("/teacher-profile-latest", async (req, res) => {
      try {
        const latestRequests = await teacherProfilesCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send(latestRequests);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch latest tutor requests",
          error: error.message,
        });
      }
    });

    app.post("/teacher-profile", async (req, res) => {
      try {
        const teacherData = req.body;
        const result = await teacherProfilesCollection.insertOne(teacherData);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ error: true, message: error.message });
      }
    });
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.dir); // <-- এখানে ঠিক আছে
// default route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});

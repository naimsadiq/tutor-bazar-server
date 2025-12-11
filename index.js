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

    //create User
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

    //Get All Users
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // update a user's role
    app.patch("/update-role", async (req, res) => {
      const { email, role } = req.body;
      const result = await userCollection.updateOne(
        { email },
        { $set: { role } }
      );
      // await sellerRequestsCollection.deleteOne({ email })

      res.send(result);
    });

    app.get("/student-post", async (req, res) => {
      try {
        const { email, role } = req.query;
        // role = "admin", "student", "public"

        let query = {};

        // 1️⃣ Student → নিজের সব পোস্ট (status চেক করবে না)
        if (role === "student" && email) {
          query.studentEmail = email;
        }

        // 2️⃣ Admin → সব পোস্ট দেখবে (কোনো ফিল্টার চাই না)
        if (role === "admin") {
          // admin এর জন্য query empty থাকবে
        }

        // 3️⃣ Homepage বা Public → শুধুমাত্র active পোস্ট
        if (role === "public") {
          query.status = "active";
        }

        const result = await studentPostCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("GET /student-post Error:", error);
        res.status(500).send({
          error: true,
          message: "Failed to fetch student posts",
        });
      }
    });

    // admin accept post
    app.patch("/student-post/accept/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: { status: "active" },
        };

        const result = await studentPostCollection.updateOne(filter, updateDoc);

        res.send({
          success: true,
          message: "Post accepted successfully",
          result,
        });
      } catch (error) {
        console.error("Accept Error:", error);
        res.status(500).send({ error: true, message: "Failed to accept post" });
      }
    });

    // admin reject post
    app.patch("/student-post/reject/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: { status: "blocked" },
        };

        const result = await studentPostCollection.updateOne(filter, updateDoc);

        res.send({
          success: true,
          message: "Post rejected successfully",
          result,
        });
      } catch (error) {
        console.error("Reject Error:", error);
        res.status(500).send({ error: true, message: "Failed to reject post" });
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
          .find({ status: "active" }) // শুধু active status
          .sort({ createdAt: -1 }) // সর্বশেষ তৈরি হওয়া অনুযায়ী
          .limit(6) // সর্বাধিক 6টি ডাটা
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

    // app.get("/teacher-profile", async (req, res) => {
    //   try {
    //     const result = await teacherProfilesCollection.find().toArray();
    //     res.send(result);
    //   } catch (error) {
    //     console.log(error);
    //     res.status(500).send({ error: true, message: error.message });
    //   }
    // });

    app.get("/teacher-profile", async (req, res) => {
      try {
        const { email, role } = req.query;
        const roleType = role || "public";

        let query = {};

        if (roleType === "teacher" && email) {
          query.teacherEmail = email;
        } else if (roleType === "public") {
          query.status = "active";
        }
        // admin: query empty → সব দেখাবে

        const result = await teacherProfilesCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("GET /teacher-profile Error:", error);
        res.status(500).send({
          error: true,
          message: "Failed to fetch teacher profiles",
        });
      }
    });

    // admin accept post
    app.patch("/teacher-profile/accept/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: { status: "active" },
        };

        const result = await teacherProfilesCollection.updateOne(
          filter,
          updateDoc
        );

        res.send({
          success: true,
          message: "Post accepted successfully",
          result,
        });
      } catch (error) {
        console.error("Accept Error:", error);
        res.status(500).send({ error: true, message: "Failed to accept post" });
      }
    });

    // admin reject post
    app.patch("/teacher-profile/reject/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: { status: "blocked" },
        };

        const result = await teacherProfilesCollection.updateOne(
          filter,
          updateDoc
        );

        res.send({
          success: true,
          message: "Post rejected successfully",
          result,
        });
      } catch (error) {
        console.error("Reject Error:", error);
        res.status(500).send({ error: true, message: "Failed to reject post" });
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
          .find({ status: "active" }) // শুধু active status
          .sort({ createdAt: -1 }) // সর্বশেষ তৈরি হওয়া অনুযায়ী
          .limit(6) // সর্বাধিক 6টি ডাটা
          .toArray();

        res.send(latestRequests);
      } catch (error) {
        console.error("GET /teacher-profile-latest Error:", error);
        res.status(500).send({
          message: "Failed to fetch latest active tutor requests",
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

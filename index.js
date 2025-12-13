const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
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
    const appliedTutorsCollection = db.collection("applied-tutors");
    const appliedStudentsCollection = db.collection("applied-students");
    const teacherProfilesCollection = db.collection("teacher_profiles");
    const paymentsCollection = db.collection("payments");

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

    //get student post
    app.get("/applied-tutors", async (req, res) => {
      const { email } = req.query; // email query param
      const tutors = await appliedTutorsCollection
        .find({ studentEmail: email }) // backend ফিল্ড name check করুন
        .toArray();
      res.send(tutors);
    });

    //student post apply
    app.post("/apply-tutor", async (req, res) => {
      try {
        const application = req.body;

        // duplicate check (এক টিউশন-এ একই টিউটর দ্বিতীয়বার apply করতে না পারে)
        const exists = await appliedTutorsCollection.findOne({
          tutorEmail: application.tutorEmail,
          tuitionId: application.tuitionId,
        });

        if (exists) {
          return res.status(400).send({ message: "Already applied!" });
        }

        application.status = "pending";
        application.appliedAt = new Date();

        const result = await appliedTutorsCollection.insertOne(application);

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // check teacher profile exists
    app.get("/teacher-profile-exists", async (req, res) => {
      const { email } = req.query;
      // console.log(email);

      if (!email) {
        return res.status(400).send({ exists: false });
      }

      const profile = await teacherProfilesCollection.findOne({
        teacherEmail: email, // 🔥 IMPORTANT
      });

      // console.log(profile);

      res.send({ exists: !!profile });
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
          $set: { status: "rejected" },
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

    //teacher earning get
    // teacher income details
    app.get("/teacher-income-details", async (req, res) => {
      const { email } = req.query;

      if (!email) {
        return res.send({ payments: [], totalIncome: 0 });
      }

      const payments = await paymentsCollection
        .find({
          tutorEmail: email,
          paymentStatus: "paid",
        })
        .sort({ date: -1 }) // latest first
        .toArray();

      const totalIncome = payments.reduce((sum, item) => sum + item.amount, 0);

      res.send({
        payments,
        totalIncome,
      });
    });

    //get teacher accept student apply
    app.patch("/apply-student/accept/:id", async (req, res) => {
      try {
        const appliedStudentId = req.params.id;

        // 1️⃣ Update appliedStudentsCollection (student application)
        const updateStudentResult = await appliedStudentsCollection.updateOne(
          { _id: new ObjectId(appliedStudentId) },
          { $set: { status: "approved" } }
        );

        // 2️⃣ Fetch the tutorId from applied student doc
        const appliedStudentDoc = await appliedStudentsCollection.findOne({
          _id: new ObjectId(appliedStudentId),
        });

        if (!appliedStudentDoc) {
          return res.status(404).send({ message: "Applied student not found" });
        }

        const tutorId = appliedStudentDoc.tutorId;

        // 3️⃣ Update teacherProfilesCollection (e.g., mark teacher status if needed)
        const updateTeacherResult = await teacherProfilesCollection.updateOne(
          { _id: new ObjectId(tutorId) },
          { $set: { status: "approved" } } // optional, just example
        );

        res.send({
          success: true,
          message: "Application accepted successfully",
          updateStudentResult,
          updateTeacherResult,
        });
      } catch (error) {
        console.error("Accept Error:", error);
        res
          .status(500)
          .send({ error: true, message: "Failed to accept application" });
      }
    });

    //get teacher reject student apply
    app.patch("/apply-student/reject/:id", async (req, res) => {
      try {
        const appliedStudentId = req.params.id;

        // 1️⃣ Update appliedStudentsCollection (student application)
        const updateStudentResult = await appliedStudentsCollection.updateOne(
          { _id: new ObjectId(appliedStudentId) },
          { $set: { status: "rejected" } }
        );

        // 2️⃣ Fetch the tutorId from applied student doc
        const appliedStudentDoc = await appliedStudentsCollection.findOne({
          _id: new ObjectId(appliedStudentId),
        });

        if (!appliedStudentDoc) {
          return res.status(404).send({ message: "Applied student not found" });
        }

        const tutorId = appliedStudentDoc.tutorId;

        // 3️⃣ Update teacherProfilesCollection (e.g., mark teacher status if needed)
        const updateTeacherResult = await teacherProfilesCollection.updateOne(
          { _id: new ObjectId(tutorId) },
          { $set: { status: "active" } } // optional, just example
        );

        res.send({
          success: true,
          message: "Application accepted successfully",
          updateStudentResult,
          updateTeacherResult,
        });
      } catch (error) {
        console.error("Accept Error:", error);
        res
          .status(500)
          .send({ error: true, message: "Failed to accept application" });
      }
    });

    //get teacher profile apply
    app.get("/apply-student", async (req, res) => {
      const { tutorEmail, studentEmail } = req.query;

      try {
        let query = {};

        if (tutorEmail) {
          query.tutorEmail = tutorEmail;
        } else if (studentEmail) {
          query.studentEmail = studentEmail;
        } else {
          return res.status(400).send({
            message: "Please provide tutorEmail or studentEmail in query",
          });
        }

        const result = await appliedStudentsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // Teacher Profile - Student Apply
    app.post("/apply-student", async (req, res) => {
      try {
        const appliedStudentData = req.body; // studentEmail, tutorId, tutorName ইত্যাদি

        // Duplicate check: একই tutor-এ একই student apply করতে পারবে না
        const exists = await appliedStudentsCollection.findOne({
          studentEmail: appliedStudentData.studentEmail,
          tutorId: appliedStudentData.tutorId,
        });

        if (exists) {
          return res.status(400).send({ message: "Already applied!" });
        }

        // Add default fields
        appliedStudentData.status = "pending";
        appliedStudentData.appliedAt = new Date();

        // Save to DB
        const result = await appliedStudentsCollection.insertOne(
          appliedStudentData
        );

        res.send({ success: true, message: "Request sent!", data: result });
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
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

    //payment history
    // 📌 Get Payment History
    app.get("/payment-history", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({
            error: true,
            message: "Email is required",
          });
        }

        const payments = await paymentsCollection
          .find({ studentEmail: email })
          .sort({ date: -1 }) // Latest first
          .toArray();

        res.send(payments);
      } catch (error) {
        console.error("Payment History Error:", error);
        res.status(500).send({
          error: true,
          message: "Failed to load payment history",
        });
      }
    });

    //payment create
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.price) * 100;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",

          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amount,
                product_data: {
                  name: `${paymentInfo.subject} Tuition Fee`,
                  images: paymentInfo.image ? [paymentInfo.image] : [],
                },
              },
              quantity: 1,
            },
          ],

          customer_email: paymentInfo.studentEmail,

          metadata: {
            paymentType: paymentInfo.paymentType,
            applyId: String(paymentInfo.applyId),
            tuitionId: String(paymentInfo.tuitionId),
            tutorEmail: String(paymentInfo.tutorEmail),
            subject: String(paymentInfo.subject),
            classLevel: String(paymentInfo.classLevel),
          },

          success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_DOMAIN}/tuition/${paymentInfo.tuitionId}`,
        });

        console.log("Stripe session metadata:", session.metadata); // <-- এখন ঠিক জায়গায়
        res.send({ url: session.url });
      } catch (error) {
        console.error("Stripe Checkout Error:", error);
        res.status(500).send({ error: true, message: error.message });
      }
    });

    //payment succes
    app.post("/payment-success", async (req, res) => {
      try {
        const { sessionId } = req.body;

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const paymentType = session.metadata?.paymentType; //⭐ কোন পেমেন্ট ধরার জন্য

        // Duplicate check
        const existingOrder = await paymentsCollection.findOne({
          transactionId: session.payment_intent,
        });

        if (existingOrder) {
          return res.send({
            transactionId: session.payment_intent,
            paymentId: existingOrder._id,
          });
        }

        // --------------------------
        // ⭐ 1️⃣ TUITION PAYMENT FLOW
        // --------------------------
        if (paymentType === "tuitionPayment") {
          const tuitionId = session.metadata.tuitionId;
          const selectedTutorEmail = session.metadata.tutorEmail;

          // Save Payment
          const paymentInfo = {
            paymentType,
            tuitionId,
            subject: session.metadata.subject,
            classLevel: session.metadata.classLevel,
            transactionId: session.payment_intent,
            studentEmail: session.customer_details.email,
            amount: session.amount_total / 100,
            paymentStatus: "paid",
            date: new Date(),
            tutorEmail: selectedTutorEmail,
          };

          const result = await paymentsCollection.insertOne(paymentInfo);

          // Tuition Update
          await studentPostCollection.updateOne(
            { _id: new ObjectId(tuitionId) },
            {
              $set: {
                status: "paid",
                selectedTutor: selectedTutorEmail,
                paidAt: new Date(),
              },
            }
          );

          // Approve tutor
          await appliedTutorsCollection.updateOne(
            { tuitionId, tutorEmail: selectedTutorEmail },
            { $set: { status: "approved", approvedAt: new Date() } }
          );

          return res.send({
            success: true,
            type: "tuitionPayment",
            message: "Tuition payment processed successfully",
            transactionId: session.payment_intent,
            paymentId: result.insertedId,
          });
        }

        // -------------------------------
        // ⭐ 2️⃣ APPLIED-STUDENT PAYMENT FLOW
        // -------------------------------
        if (paymentType === "applyStudentPayment") {
          const applyId = session.metadata.applyId;

          // Payment save
          const paymentInfo = {
            paymentType,
            applyId,
            subject: session.metadata.subject,
            classLevel: session.metadata.classLevel,
            transactionId: session.payment_intent,
            studentEmail: session.customer_details.email,
            amount: session.amount_total / 100,
            paymentStatus: "paid",
            date: new Date(),
            tutorEmail: session.metadata.tutorEmail,
          };

          const result = await paymentsCollection.insertOne(paymentInfo);

          // 👇 applied-students Collection Update
          const updateResult = await appliedStudentsCollection.updateOne(
            { _id: new ObjectId(applyId) },
            {
              $set: {
                status: "paid",
                paidAt: new Date(),
              },
            }
          );

          return res.send({
            success: true,
            type: "applyStudentPayment",
            message: "Applied student payment completed.",
            transactionId: session.payment_intent,
            paymentId: result.insertedId,
            updated: updateResult.modifiedCount,
          });
        }

        res.status(400).send({ error: true, message: "Invalid payment type" });
      } catch (error) {
        console.error("Payment Success Error:", error);
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

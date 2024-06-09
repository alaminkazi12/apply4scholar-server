const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const e = require("express");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

// middlewares to pass data
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "http://studyscribe-a50b5.web.app",
      // "http://studyscribe-a50b5.firebaseapp.com",
      // "https://studyscribe.netlify.app",
    ],
    credentials: true,
  })
);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r90hnej.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = async (req, res, next) => {
  console.log("called", req.host, req.method, req.url);
  next();
};

const verifyToken = async (req, res, next) => {
  const toekn = req.cookies?.token;
  console.log(req.cookies);
  console.log("Value of the middleware", toekn);
  if (!toekn) {
    return res.status(401).send({ message: "not authorized" });
  }
  jwt.verify(toekn, process.env.TOKEN_SECRET, (err, decoded) => {
    // err
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "not authorized" });
    }
    console.log("value in the token", decoded);
    req.user = decoded;
  });
  next();
};

// jwt related api
app.post("/jwt", logger, async (req, res) => {
  const user = req.body;
  console.log(user);
  const token = jwt.sign(user, process.env.TOKEN_SECRET, {
    expiresIn: "1hr",
  });
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    })
    .send({ success: true });
});

app.post("/logout", async (req, res) => {
  const user = req.body;
  console.log("Logged out", user);
  res.clearCookie("token", { maxAge: 0 }).send({ success: true });
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const apply4scholar = client.db("apply4scholar");
    const scholarshipsCollection = apply4scholar.collection("scholarships");
    const usersCollection = apply4scholar.collection("users");
    const paymnetCollection = apply4scholar.collection("payments");
    const applicationCollection = apply4scholar.collection("application");
    const reviewCollection = apply4scholar.collection("review");

    // verify user role middlewares

    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyModerator = async (req, res, next) => {
      const email = req.user.email;
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      const isModerator = user?.role === "moderator";
      if (!isModerator) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyAdminOrModerator = async (req, res, next) => {
      const email = req.user?.email;
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      const isModerator = user?.role === "moderator";
      const isAdmin = user?.role === "admin";
      if (!isModerator || !isModerator) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // scholarship related api

    app.get("/scholarships", async (req, res) => {
      const result = await scholarshipsCollection.find().toArray();
      res.send(result);
    });

    app.post(
      "/scholarship",
      logger,
      verifyToken,
      verifyAdminOrModerator,
      async (req, res) => {
        const query = req.body;
        const result = await scholarshipsCollection.insertOne(query);
        res.send(result);
      }
    );

    app.get("/scholarships/:id", logger, verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await scholarshipsCollection.findOne(query);
      res.send(result);
    });

    app.get("/top-scholarship", async (req, res) => {
      const options = {
        sort: {
          application_fees: 1,
          post_date: -1,
        },
        limit: 6,
      };
      const result = await scholarshipsCollection.find({}, options).toArray();
      res.send(result);
    });

    app.put("/scholarship", async (req, res) => {
      const data = req.body;
      console.log(data);
      const id = data.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          scholarship_name: data.scholarship_name,
          university_name: data.university_name,
          university_image: data.university_image,
          university_country: data.university_country,
          university_city: data.university_city,
          university_world_rank: data.university_world_rank,
          subject_category: data.subject_category,
          scholarship_category: data.scholarship_category,
          degree: data.degree,
          tuition_fees: data.tuition_fees,
          application_fees: data.application_fees,
          service_charge: data.service_charge,
          application_deadline: data.application_deadline,
          post_date: data.post_date,
          scholarship_description: data.scholarship_description,
        },
      };

      const result = await scholarshipsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/scholarship", async (req, res) => {
      const id = req.body.id;
      const filter = { _id: new ObjectId(id) };
      const result = await scholarshipsCollection.deleteOne(filter);
      res.send(result);
    });

    // application related api

    app.post("/apply", logger, verifyToken, async (req, res) => {
      const applicationData = req.body;
      const result = await applicationCollection.insertOne(applicationData);
      res.send(result);
    });

    app.put("/apply/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          degree: data.degree,
          gender: data.gender,
          hsc: data.hsc,
          phone: data.phone,
          ssc: data.ssc,
          studyGap: data.studyGap,
          userAddress: data.userAddress,
        },
      };

      const result = await applicationCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/applications", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/all-applied-scholarships", async (req, res) => {
      const result = await applicationCollection.find().toArray();
      res.send(result);
    });

    app.put("/feedback", async (req, res) => {
      const data = req.body;
      const id = data.id;
      const feedback = data.feedback;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };

      const result = await applicationCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/application-status", async (req, res) => {
      const data = req.body;
      const id = data.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await applicationCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicationCollection.deleteOne(query);
      res.send(result);
    });

    // review related api

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.get("/myreviews", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/reveiw", async (req, res) => {
      const data = req.body;
      const reviewid = data.id;
      const filter = { _id: new ObjectId(reviewid) };
      const updateDoc = {
        $set: {
          comment: data.comment,
          rating: data.rating,
        },
      };

      const result = await reviewCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/review", async (req, res) => {
      const id = req.body.id;
      const filter = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(filter);
      res.send(result);
    });

    //  users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(req.headers);
      const query = { userEmail: user.userEmail };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);

      res.send(result);
    });

    app.get("/users", logger, verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // check user role

    app.get("/user/admin/:email", logger, verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "unauthorized accesss" });
      }

      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/user/moderator/:email", logger, verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }

      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      let moderator = false;
      if (user) {
        moderator = user?.role === "moderator";
      }
      res.send({ moderator });
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const query = {
        userEmail: email,
      };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.put("/user", logger, verifyToken, verifyAdmin, async (req, res) => {
      const id = req.body.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: req.body.role,
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // payment intent api
    app.post(
      "/create-payment-intent",
      logger,
      verifyToken,
      async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    );

    app.post("/payments", logger, verifyToken, async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymnetCollection.insertOne(payment);
      res.send(paymentResult);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Apply4scholar is working");
});

app.listen(port, () => {
  console.log(`Apply4scholar server is running on port ${port}`);
});

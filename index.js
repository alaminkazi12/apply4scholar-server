const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

// middlewares to pass data
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r90hnej.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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

    app.get("/scholarships", async (req, res) => {
      const result = await scholarshipsCollection.find().toArray();
      res.send(result);
    });

    app.get("/scholarships/:id", async (req, res) => {
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

    // application related api

    app.post("/apply", async (req, res) => {
      const applicationData = req.body;
      const result = await applicationCollection.insertOne(applicationData);
      res.send(result);
    });

    app.get("/applications", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    });

    //  users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { userEmail: user.userEmail };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);

      res.send(result);
    });

    // payment intent api
    app.post("/create-payment-intent", async (req, res) => {
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
    });

    app.post("/payments", async (req, res) => {
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

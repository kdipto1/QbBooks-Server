import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
const port = process.env.PORT || 5000;
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
require("dotenv").config();
const app = express();
import jwt from "jsonwebtoken";
import axios from "axios";
import { CronJob } from "cron";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const job = new CronJob("*/14 * * * *", async () => {
  try {
    await axios.get(process.env.PING_URL as string, { timeout: 30000 });
    console.log("URL pinged successfully");
  } catch (error: any) {
    console.error("Error pinging URL:", error.message);
    if (error) {
      setTimeout(async () => {
        await axios.get(process.env.PING_URL as string, { timeout: 10000 });
      }, 10000);
    }
  }
});

job.start();

//Verify token function:
function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET as string,
    function (err, decoded) {
      if (err) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      (req as any).decoded = decoded;
      next();
    }
  );
}
//MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI as string, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const booksCollection = client.db("qbBooks").collection("books");
    const userCollection = client.db("qbBooks").collection("users");
    const cartCollection = client.db("qbBooks").collection("cart");
    const paymentCollection = client.db("qbBooks").collection("payments");
    // const testCollection = client.db("qbBooks").collection("test");
    //Api for Payment
    app.post("/create-payment-intent", async (req, res) => {
      const order = req.body;
      // const price = req?.query.totalPrice;
      const price = parseInt(order.totalPrice);
      // console.log(parseFloat(order.totalPrice), "clg");
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    //Api for book posting test
    app.post("/addBook", async (req, res) => {
      const newBook = req.body;
      const result = await booksCollection.insertOne(newBook);
      res.send(result);
    });
    /* Api for getting jwt token */
    app.post("/login", async (req, res) => {
      const email = req.body;
      const token = await jwt.sign(
        email,
        process.env.ACCESS_TOKEN_SECRET as string
      );
      res.send({ token: token });
    });
    //Api for posting new book
    app.post("/book", async (req, res) => {
      const newBook = req.body;
      const result = await booksCollection.insertOne(newBook);
      res.send(result);
    });
    //Api for posting many books
    app.post("/books", async (req, res) => {
      const newBooks = req.body;
      const options = { ordered: true };
      const result = await booksCollection.insertMany(newBooks, options);
      res.send(result);
    });
    // Api for getting books for featured section
    app.get("/featuredBooks", async (req, res) => {
      const query = {};
      const cursor = booksCollection.find(query, { limit: 8 });
      const result = await cursor.toArray();
      res.send(result);
    });
    // Api for getting all book or category book
    app.get("/allBooks", async (req, res) => {
      const query = {};
      const cursor = booksCollection.find(query);
      const result = await (await cursor.toArray()).reverse();
      res.send(result);
    });
    // Api for getting category book
    app.get("/category", async (req, res) => {
      const category = req.query.category;
      const query = { category: category };
      // console.log(category);
      const cursor = booksCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    //Api for getting single book
    app.get("/book/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    //Api for posting new user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = await { email: email };
      if (filter) {
        const options = { upsert: true };
        const updatedDoc = {
          $set: user,
        };
        const result = await userCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      } else {
        res.send({ message: "Account available" });
      }
    });
    //Api for getting user by email
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    //Api for updating user info
    app.put("/users/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: data };
      const option = { upsert: true };
      const result = await userCollection.updateOne(filter, updateDoc, option);
      res.send(result);
    });
    //Api for single order
    app.get("/userCart/:id", verifyJWT, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      res.send(result);
    });
    //Api for posting product to cart
    app.post("/cart", async (req, res) => {
      const newProduct = req.body;
      const result = await cartCollection.insertOne(newProduct);
      res.send(result);
    });
    //Api for getting user added product from cart
    app.get("/userCart", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const cursor = cartCollection.find(query);
      const result = await (await cursor.toArray()).reverse();
      res.send(result);
      // console.log(result);
    });

    //Api for update user cart by id for payment info update
    app.patch("/userCart/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "paid",
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await cartCollection.updateOne(filter, updatedDoc);
      res.send(updatedDoc);
    });
    //Api for getting books by id
    app.get("/cartBooks/:id", async (req, res) => {
      const id = req.params;
      console.log(id);
      const bookData = req.body;
      // console.log(bookData,"body");
      const books = req.query;
      console.log(typeof books, "Params:", books);
      const arr = Object.entries(books);
      // const result = booksCollection.find({
      //   _id: {
      //     $in: [ObjectId(books)],
      //   },
      // });
      // res.send(result);
      // for (const id of books) {
      //   let result = [];
      //   let id = await booksCollection.find({ _id: ObjectId(id) });
      //   result.push(id);
      //   res.send(result);
      // }
      console.log("cc", Object.values(books));
      // const query = { _id: ObjectId(id) };
      // const result = await booksCollection.find(query);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.listen(port, () => {
  console.log(`Listening from port http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  console.log(
    "SIGTERM signal received: closing MongoDB connection and stopping cron job"
  );
  await client.close();
  job.stop();
  console.log("MongoDB connection closed, cron job stopped,");
  process.exit(0);
});

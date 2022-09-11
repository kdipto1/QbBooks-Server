const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
//middleware
app.use(cors());
app.use(express.json());

//mongodb connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p85dy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const booksCollection = client.db("qbBooks").collection("books");
    const userCollection = client.db("qbBooks").collection("users");
    const testCollection = client.db("qbBooks").collection("test");

    //Api for book posting test
    app.post("/test", async (req, res) => {
      const newBook = req.body;
      const result = await testCollection.insertOne(newBook);
      res.send(result);
    });
    /* Api for getting jwt token */
    app.post("/login", async (req, res) => {
      const email = req.body;
      const token = await jwt.sign(email, process.env.ACCESS_TOKEN_SECRET);
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
      const cursor = booksCollection.find(query, { limit: 6 });
      const result = await cursor.toArray();
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
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.listen(port, () => {
  console.log(`Listening from port ${port}`);
});

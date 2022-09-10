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
const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p85dy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const booksCollection = client.db("qbBooks").collection("books");
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
    })
    //Api for posting many books
    app.post("/books", async (req, res) => {
      const newBooks = req.body;
      const options = { ordered: true };
      const result = await booksCollection.insertMany(newBooks,options);
      res.send(result);
    })
    // Api for getting books for featured section
    app.get("/featuredBooks", async (req, res) => {
      const query = {}
      const cursor =  booksCollection.find(query, { limit: 6 })
      const result = await cursor.toArray();
      res.send(result)
    })
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

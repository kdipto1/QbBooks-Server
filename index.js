"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const port = process.env.PORT || 5000;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("dotenv").config();
const app = (0, express_1.default)();
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const cron_1 = require("cron");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//middleware
app.use((0, cors_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
const job = new cron_1.CronJob("*/14 * * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield axios_1.default.get(process.env.PING_URL, { timeout: 30000 });
        console.log("URL pinged successfully");
    }
    catch (error) {
        console.error("Error pinging URL:", error.message);
        if (error) {
            setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                yield axios_1.default.get(process.env.PING_URL, { timeout: 10000 });
            }), 10000);
        }
    }
}));
job.start();
//Verify token function:
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
    }
    const token = authHeader.split(" ")[1];
    jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
    });
}
//MongoDB connection
const client = new mongodb_1.MongoClient(process.env.MONGODB_URI, {
    serverApi: {
        version: mongodb_1.ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield client.connect();
            const booksCollection = client.db("qbBooks").collection("books");
            const userCollection = client.db("qbBooks").collection("users");
            const cartCollection = client.db("qbBooks").collection("cart");
            const paymentCollection = client.db("qbBooks").collection("payments");
            // const testCollection = client.db("qbBooks").collection("test");
            //Api for Payment
            app.post("/create-payment-intent", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const order = req.body;
                // const price = req?.query.totalPrice;
                const price = parseInt(order.totalPrice);
                // console.log(parseFloat(order.totalPrice), "clg");
                const amount = price * 100;
                const paymentIntent = yield stripe.paymentIntents.create({
                    amount: amount,
                    currency: "usd",
                    payment_method_types: ["card"],
                });
                res.send({ clientSecret: paymentIntent.client_secret });
            }));
            //Api for book posting test
            app.post("/addBook", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const newBook = req.body;
                const result = yield booksCollection.insertOne(newBook);
                res.send(result);
            }));
            /* Api for getting jwt token */
            app.post("/login", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const email = req.body;
                const token = yield jsonwebtoken_1.default.sign(email, process.env.ACCESS_TOKEN_SECRET);
                res.send({ token: token });
            }));
            //Api for posting new book
            app.post("/book", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const newBook = req.body;
                const result = yield booksCollection.insertOne(newBook);
                res.send(result);
            }));
            //Api for posting many books
            app.post("/books", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const newBooks = req.body;
                const options = { ordered: true };
                const result = yield booksCollection.insertMany(newBooks, options);
                res.send(result);
            }));
            // Api for getting books for featured section
            app.get("/featuredBooks", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const query = {};
                const cursor = booksCollection.find(query, { limit: 8 });
                const result = yield cursor.toArray();
                res.send(result);
            }));
            // Api for getting all book or category book
            app.get("/allBooks", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const query = {};
                const cursor = booksCollection.find(query);
                const result = yield (yield cursor.toArray()).reverse();
                res.send(result);
            }));
            // Api for getting category book
            app.get("/category", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const category = req.query.category;
                const query = { category: category };
                // console.log(category);
                const cursor = booksCollection.find(query);
                const result = yield cursor.toArray();
                res.send(result);
            }));
            //Api for getting single book
            app.get("/book/:id", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const { id } = req.params;
                const query = { _id: new mongodb_1.ObjectId(id) };
                const result = yield booksCollection.findOne(query);
                res.send(result);
            }));
            //Api for posting new user
            app.put("/user/:email", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const email = req.params.email;
                const user = req.body;
                const filter = yield { email: email };
                if (filter) {
                    const options = { upsert: true };
                    const updatedDoc = {
                        $set: user,
                    };
                    const result = yield userCollection.updateOne(filter, updatedDoc, options);
                    res.send(result);
                }
                else {
                    res.send({ message: "Account available" });
                }
            }));
            //Api for getting user by email
            app.get("/users", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const email = req.query.email;
                const query = { email: email };
                const result = yield userCollection.findOne(query);
                res.send(result);
            }));
            //Api for updating user info
            app.put("/users/:id", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const { id } = req.params;
                const data = req.body;
                const filter = { _id: new mongodb_1.ObjectId(id) };
                const updateDoc = { $set: data };
                const option = { upsert: true };
                const result = yield userCollection.updateOne(filter, updateDoc, option);
                res.send(result);
            }));
            //Api for single order
            app.get("/userCart/:id", verifyJWT, (req, res) => __awaiter(this, void 0, void 0, function* () {
                const { id } = req.params;
                const query = { _id: new mongodb_1.ObjectId(id) };
                const result = yield cartCollection.findOne(query);
                res.send(result);
            }));
            //Api for posting product to cart
            app.post("/cart", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const newProduct = req.body;
                const result = yield cartCollection.insertOne(newProduct);
                res.send(result);
            }));
            //Api for getting user added product from cart
            app.get("/userCart", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const email = req.query.email;
                const query = { email: email };
                const cursor = cartCollection.find(query);
                const result = yield (yield cursor.toArray()).reverse();
                res.send(result);
                // console.log(result);
            }));
            //Api for update user cart by id for payment info update
            app.patch("/userCart/:id", verifyJWT, (req, res) => __awaiter(this, void 0, void 0, function* () {
                const id = req.params.id;
                const payment = req.body;
                const filter = { _id: new mongodb_1.ObjectId(id) };
                const updatedDoc = {
                    $set: {
                        status: "paid",
                        transactionId: payment.transactionId,
                    },
                };
                const result = yield paymentCollection.insertOne(payment);
                const updatedOrder = yield cartCollection.updateOne(filter, updatedDoc);
                res.send(updatedDoc);
            }));
            //Api for getting books by id
            app.get("/cartBooks/:id", (req, res) => __awaiter(this, void 0, void 0, function* () {
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
            }));
        }
        finally {
        }
    });
}
run().catch(console.dir);
app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.listen(port, () => {
    console.log(`Listening from port http://localhost:${port}`);
});
process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("SIGTERM signal received: closing MongoDB connection and stopping cron job");
    yield client.close();
    job.stop();
    console.log("MongoDB connection closed, cron job stopped,");
    process.exit(0);
}));

const express = require('express');
const cors = require("cors");
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); 
const app = express();
const stripe = require("stripe")(process.env.STRIPE_Secret_key);
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g24kr.mongodb.net/?retryWrites=true&w=majority`;
    
  
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const MedicalCampsCollection = client.db("Medical-Camp").collection("camps");
    const UserCollection = client.db("Medical-Camp").collection("users");
    const JoinCampCollection = client.db("Medical-Camp").collection("joinCamp");
    const paymentCollection = client.db("Medical-Camp").collection("payments");


    // jwt related api
    app.post("/jwt", async(req,res)=>{
      const user = req.body;
      const token =jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:"1h"});
      res.send({token})
    })
    // Middleware
     const verifyToken=(req,res,next)=>{
       console.log("Inside verify token",req.headers.authorization);
       if (!req.headers.authorization) {
        return res.status(401).send({message: "unauthorized  access"})
       }
       const token = req.headers.authorization.split(' ')[1];
       jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if (err) {
          return res.status(401).send({message: "unauthorized  access"})
        }
        req.decoded = decoded
         next()
       })
     }
    // use verify admin after verifyToken
    const verifyAdmin=async(req,res,next)=>{
      const email = req.decoded.email;
      const query={email:email};
      const user= await UserCollection.findOne(query);
      const isAdmin = user?.role === "admin"
      if (!isAdmin) {
        return res.status(403).send({message: "forbidden access"})
      }
      next()
    }

    // payment-intent
    app.post("/create-payment-intent", async (req, res) => {
      try {
          const { totalCampFee } = req.body;
  
          if (!totalCampFee || isNaN(totalCampFee) || totalCampFee <= 0) {
              return res.status(400).send({ error: "Invalid totalCampFee. It must be a positive number." });
          }
  
          const amount = Math.round(totalCampFee * 100);
  
          const paymentIntent = await stripe.paymentIntents.create({
              amount,
              currency: "usd",
              payment_method_types: ["card"],
          });
  
          res.send({
              clientSecret: paymentIntent.client_secret,
          });
      } catch (error) {
          console.error("Error creating payment intent:", error);
          res.status(500).send({ error: "Internal Server Error" });
      }
  });
  app.post('/payments', async(req,res)=>{
    const payment= req.body;
    console.log("payment info",payment);
    const filter={_id:new ObjectId(payment.campId)}
    console.log(payment.campId);
    const updateDoc= {
      $set:{
        status:"paid",
        pendingStatus:"confirmed"
      }
    }
    const update = await JoinCampCollection.updateOne(filter,updateDoc);
    console.log(update);
    const paymentResult = await paymentCollection.insertOne(payment);
    res.send(paymentResult)
  })
 
  
    // JoinCamp
    app.post("/JoinCamp",async(req,res)=>{
      const joinCamp= req.body;
      const result= await JoinCampCollection.insertOne(joinCamp);
      const filter= {email:joinCamp.userEmail}
      const updateDoc= {
        $inc:{
          participantCount:1
        }
      }
      const CountCamp = await MedicalCampsCollection.updateOne(filter,updateDoc)
      console.log(updateDoc,CountCamp);
      res.send(result)
    })
    app.get("/JoinCamp",async(req,res)=>{
      const result = await JoinCampCollection.find().toArray();
      res.send(result)
    })

    app.delete("/JoinCamp/:id",async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await JoinCampCollection.deleteOne(query);
      res.send(result)
    })

    // MedicalCamps
    // get limit
    app.get("/medicalCamp",async(req,res)=>{
      const result = await MedicalCampsCollection.find().limit(6).toArray();
      res.send(result)
    })

    // get
    app.get("/medicalCamps",async(req,res)=>{
      const result = await MedicalCampsCollection.find().toArray();
      res.send(result)
    })
    // post
    app.post("/medicalCamps",async(req,res)=>{
      const camp= req.body;
      const result= await MedicalCampsCollection.insertOne(camp);
      res.send(result)
    })
    // details
    app.get("/medicalCamps/:id", async (req, res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id) };
      const result = await MedicalCampsCollection.findOne(query);
      res.send(result)
    })
    // delete
    app.delete("/medicalCamps/:id",async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await MedicalCampsCollection.deleteOne(query);
      res.send(result)
    })
    // Update
    app.put("/medicalCamps/:id", async (req, res) => {
      const id = req.params.id;
    
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ID format" });
      }
    
      const query = { _id: new ObjectId(id) };
      const updateData = req.body;
      const data = {
        $set: {
          campName: updateData.campName,
          healthcareName: updateData.healthcareName,
          photo: updateData.photo,
          campFees: updateData.campFees,
          location: updateData.location,
          participantCount: updateData.participantCount,
          description: updateData.description,
          date: updateData.date,
        },
      };
    
      const options = { upsert: true };
      try {
        const result = await MedicalCampsCollection.updateOne(query, data, options);
    
        if (result.modifiedCount === 0 && result.upsertedCount === 0) {
          return res.status(404).send({ message: "No document matched the ID provided." });
        }
    
        res.send({
          message: result.upsertedCount > 0 ? "Document created successfully" : "Document updated successfully",
          result,
        });
      } catch (error) {
        console.error("Error updating document:", error);
        res.status(500).send({ error: "Failed to update the document" });
      }
    });
    

    // user collection
    // post
    app.post("/user/:email",async(req,res)=>{
      const email = req.params.email;
      // console.log(email);
      const query = {email}
      const user = req.body;
      // check if user exists in db
      const isExist = await UserCollection.findOne(query);
      // console.log(isExist);
      if (isExist) {
        return res.send({message:"user already exist", insertedId:null})
      }
      const result = await UserCollection.insertOne(user);
      // console.log(result);
      res.send(result)
    })
    app.get("/user/:email",async(req,res)=>{
      const email = req.params.email;
      // console.log(email);
      const result = await UserCollection.findOne({ email });

      res.send(result)
    })

    app.put("/user/:id",async(req,res)=>{
      const id= req.params.id;

      console.log(id);
        const query = {_id:new ObjectId(id)}
        // const option= {upsert:true};
        const updateData= req.body;
        console.log("hello",updateData);
        const data = {
          $set:{
            ...updateData
          }
        }
        const result = await UserCollection.updateOne(query,data);
        res.send(result)
    })

    app.get("/user/admin/:email", async (req,res)=>{
      const email = req.params.email;
      // console.log(email);
      const query = {email:email}
      const user = await UserCollection.findOne(query);
      let admin = false
      if (user) {
        admin = user?.role === "admin"
      }
      res.send({admin})
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Root endpoint
app.get('/', (req, res) => {
  res.send('Medical Camp Server');
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

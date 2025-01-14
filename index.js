const express = require('express');
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
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

    // MedicalCamps
    // get
    app.get("/medicalCamp",async(req,res)=>{
      const result = await MedicalCampsCollection.find().limit(6).toArray();
      res.send(result)
    })

    // get
    app.get("/medicalCamps",async(req,res)=>{
      const result = await MedicalCampsCollection.find().toArray();
      res.send(result)
    })
    // details
    app.get("/medicalCamps/:id", async (req, res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id) };
      const result = await MedicalCampsCollection.findOne(query);
      res.send(result)
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

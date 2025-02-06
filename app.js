require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const nodemailer = require("nodemailer");
const Product = require("./models/product");
const Order = require("./models/ordermodel");
const authRoutes = require("./controllers/auth");
const adminAuthRoutes = require("./controllers/adminauth");
const cartRoutes = require("./controllers/cart");
const productRoutes = require("./controllers/product");
const complaintsRoutes = require("./controllers/complaints");
const couponRoutes = require("./controllers/coupon");
const imageRoutes = require("./controllers/image");
const reviewsRoutes = require("./controllers/reviews");
const SEORoutes = require("./controllers/seo");

if (!process.env.MONGO_URI) {
	throw new Error("Please Add MONGO_URI in environment variables...");
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	cors({
		origin: process.env.ALLOWED_ORIGINS?.split(",").map((origin) =>
			origin.trim()
		) || ["http://localhost:5000"],
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-Requested-With",
			"X-Api-Key",
			"X-Api-HMAC-SHA256",
		],
	})
);
app.use(require("cookie-parser")());
app.use(express.static("./public"));
app.use(express.static("./uploads"));

// Session Setup
app.use(
	session({
		secret: process.env.SECRET,
		resave: false,
		saveUninitialized: false,
		store: MongoStore.create({
			mongoUrl: process.env.MONGO_URI,
			collectionName: "sessions",
		}),
		cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
	})
);

// File Upload Configuration
const storage = multer.diskStorage({
	destination: "./uploads/",
	filename: (req, file, cb) => {
		cb(
			null,
			file.fieldname + "-" + Date.now() + path.extname(file.originalname)
		);
	},
});
const upload = multer({ storage, limits: { fileSize: 1000000 } }).single(
	"myFile"
);

// Email Transporter
const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_SERVER,
	port: parseInt(process.env.EMAIL_PORT) || 465,
	secure: process.env.EMAIL_SECURE === "true",
	auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
	tls: { rejectUnauthorized: false },
});

// Routes
app.use("/auth", authRoutes);
app.use("/admin", adminAuthRoutes);
app.use("/cart", cartRoutes);
app.use("/products", productRoutes);
app.use("/complaints", complaintsRoutes);
app.use("/coupon", couponRoutes);
app.use("/image", imageRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/seo", SEORoutes);

// Middleware for logging requests
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);

	if (req.method === "POST" || req.method === "PUT") {
		console.log("Request Body:", req.body);
	}

	if (Object.keys(req.query).length > 0) {
		console.log("Query Parameters:", req.query);
	}

	next(); // Pass control to the next handler
});

// Shiprocket API Integration
const calculate_hmac_sha256_as_base64 = (key, content) => {
    const hmac = crypto.createHmac('sha256', key).update(content).digest('base64'); 
    return hmac;
  };


// Write code for shiprocketapi 
// const axios = require('axios');

app.post('/shiprocketapi', async (req, res) => {
    console.log("Received request");
    const mydata = req.body;
    console.log("Requested body:", req.body);

    try {
        const apiKey = "F4ZJ0KzzTQw6M89A";
        const apiSecret = "XY9bc2WhIUnMorH0gPsEVDagZFuIFzfV";
        const makeApiRequest = async (apiKey, apiSecret, thedata) => {
            const timestamp = new Date().toISOString();

            const cartData = thedata;

            const requestBody = JSON.stringify(cartData);
            console.log("Cart Data:", requestBody);

            const signature = calculate_hmac_sha256_as_base64(apiSecret, requestBody);
            console.log("Signature:", signature);

            const config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: process.env.API_ACCESS_URL,
                headers: {
                    'X-Api-Key': apiKey,
                    'X-Api-HMAC-SHA256': signature,
                    'Content-Type': 'application/json'
                },
                data: requestBody // Use JSON stringified data
            };

            try {
                const response = await axios(config);
                console.log("Token genrated : ", response.data.result.token);
                console.log("API Response:", response.data);

                return response.data.result.token; // Adjust according to the API response
            } catch (error) {
                console.error("API request failed:", error.response?.data || error.message);
                throw new Error("Failed to communicate with the API.");
            }
        };

        // Call makeApiRequest with proper parameters
        const token = await makeApiRequest(apiKey, apiSecret, mydata);

        if (!token) {
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve token from Shiprocket API'
            });
        }

        console.log("Token:", token);

        res.status(200).json({
            token: token,
            success: true,
            message: 'Order processed successfully',
            orderId: 'ORDER12345' // Example Order ID
        });
    } catch (error) {
        console.error("Error processing order:", error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the order',
        });
    }
});


 


// Product Routes
app
	.route("/product/:productId")
	.get(async (req, res) => {
		try {
			const product = await Product.findById(req.params.productId);
			if (!product)
				return res
					.status(404)
					.json({ success: false, message: "Product not found" });
			res.status(200).json({ success: true, product });
		} catch (error) {
			res.status(500).json({ success: false, message: error.message });
		}
	})
	.delete(async (req, res) => {
		try {
			const result = await Product.findByIdAndDelete(req.params.productId);
			if (!result)
				return res
					.status(404)
					.json({ success: false, message: "Product not found" });
			res
				.status(200)
				.json({ success: true, message: "Product deleted successfully" });
		} catch (error) {
			res.status(500).json({ success: false, message: error.message });
		}
	});

// Order Routes
app.get("/orders", async (req, res) => {
	try {
		const orders = await Order.find().populate("productIds");
		res.status(200).json({ success: true, orders });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

// Initialize MONGODB
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => {
		console.log("Connected to MongoDB");
		const PORT = process.env.PORT || 5000;
		app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
		process.exit(1); // Exit the process if DB connection fails
	});

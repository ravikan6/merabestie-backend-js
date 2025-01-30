const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const authRoutes = require('./routes/auth');
const uuid = require('uuid');
const bcrypt = require('bcryptjs'); // Added bcrypt import
const couponRoutes = require('./routes/coupon')
const adminAuthRoutes = require('./routes/adminauth');
const cartRoutes = require('./routes/cart');
const complaintsRoutes = require('./routes/complaints');
const Order = require('./models/ordermodel'); // Replace with correct path;
const imageRoutes = require("./routes/image");
const reviewsRoutes = require('./routes/reviews');
const SEOroutes = require('./routes/seo');
const Product = require('./models/product');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const axios = require('axios');



if (!process.env.MONGO_URI) {
    throw new Error("Please Add MONGO_URI in envirement variables...")
}

const app = express();
app.use(express.json());
app.use(cors());

// Set up storage engine
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});


// HMAC code maker 

const calculate_hmac_sha256_as_base64 = (key, content) => {
    const hmac = crypto.createHmac('sha256', key).update(content).digest('base64');
    return hmac;
};

// Client-side checkout handler
const handleCheckout = async (event) => {
    try {
        const mydata = cartItems.map(item => ({
            variant_id: item.productId,
            quantity: item.quantity || 1
        }));

        const transformedData = {
            cart_data: { items: mydata },
            redirect_url: process.env.REDIRECT_URL,
            timestamp: new Date().toISOString()
        };

        const { data } = await axios.post('/shiprocketapi', transformedData);
        const { token } = data;

        window.HeadlessCheckout.addToCart(event, token, {
            fallbackUrl: process.env.FALLBACK_URL
        });
    } catch (error) {
        console.error('Checkout failed');
        // Optional: show user-friendly error notification
    }
};



// Initialize upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }, // Limit file size to 1MB
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('myFile');

// Check file type
function checkFileType(file, cb) {
    // Allowed ext
    const filetypes = /jpeg|jpg|png|gif|webp/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}

let origins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
// Middleware

app.use(cors({
    origin: ["https://www.merabestie.com", "http://localhost:3000", "*.merabestie.com"], // Specific origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Api-Key', 'X-Api-HMAC-SHA256']
}));


app.use(express.json());
app.use(require('cookie-parser')());
app.use(express.urlencoded({ extended: true }));
// Public folder
app.use(express.static('./public'));
app.use(express.static('./uploads'));

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER,
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || false, // use TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false,
    },
});

app.use(
    session({
        secret: "process.env.SECRET",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions',
        }),
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 day
        },
    })
);

// Routes
app.use('/auth', authRoutes);
app.use('/admin', adminAuthRoutes);
app.use('/api', adminAuthRoutes); // OLD API
app.use('/cart', cartRoutes);
app.use('/complaints', complaintsRoutes);
app.use('/coupon', couponRoutes)
app.use('/image', imageRoutes)
app.use('/reviews', reviewsRoutes);
app.use('/seo', SEOroutes);

// MongoDB Connection
const uri = process.env.MONGO_URI;
mongoose.connect(uri)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// ROOT PAGE
app.get('/', (req, res) => {
    res.status(200).json({
        hello: 'MeraBestie Backend Server @RK , HA HA HA..#devil'
    });
});

// Keep-Alive Route
app.get('/keep-alive', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is up and running, Configured By RK'
    });
});

app.post('/shiprocket/order', async (req, res) => {
    try {
        const { items, shippingDetails } = req.body;

        const timestamp = new Date().toISOString();
        const payload = {
            cart_data: { items },
            shippingDetails,
            timestamp
        };

        const signature = crypto.createHmac('sha256', process.env.SHIPROCKET_SECRET)
            .update(JSON.stringify(payload))
            .digest('base64');

        const response = await axios.post('https://api.shiprocket.in/v1/external/orders/create/adhoc', payload, {
            headers: {
                'X-Api-Key': process.env.SHIPROCKET_API_KEY,
                'X-Api-HMAC-SHA256': signature,
                'Content-Type': 'application/json',
            },
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to process order.' });
    }
});

// app.post('/shiprocketapi', async (req, res) => {
//     try {
//         const { cart_data } = req.body;

//         if (!cart_data || !Array.isArray(cart_data.items)) {
//             throw new Error('Invalid cart_data or items.');
//         }

//         console.log('Full Cart Data:', JSON.stringify(cart_data, null, 2));

//         // Validate each item's variantId
//         cart_data.items.forEach((item, index) => {
//             if (!item.variantId) {
//                 throw new Error(`Item at index ${index} is missing a variantId.`);
//             }
//         });

//         const response = await makeApiRequest(apiKey, apiSecret, cart_data.items);
//         res.status(200).json({ success: true, token: response });
//     } catch (error) {
//         console.error('Error processing order:', error.message);
//         res.status(400).json({ success: false, message: error.message });
//     }
// });

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


// Route to upload file
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            res.send(err);
        } else {
            if (req.file == undefined) {
                res.send({ error: "No File Selected!", success: false });
            } else {
                res.send({
                    success: true,
                    message: 'File Uploaded Successfully!',
                    file: req.file.filename,
                    fileUrl: `${process.env.UPLOAD_URI || "https://api.merabestie.com/uploads"}/${req.file.filename}`
                });
            }
        }
    });
});

// Get Products by Category Route
app.post('/product/category', async (req, res) => {
    try {
        const { category } = req.body;

        // Normalize the category to handle case variations
        let normalizedCategory = category.toLowerCase();
        let searchCategory;

        // Map normalized categories to their proper display versions
        switch (normalizedCategory) {
            case 'gift-boxes':
                searchCategory = 'Gift Boxes';
                break;
            case 'gift boxes':
                searchCategory = 'Gift Boxes';
                break;
            case 'books':
                searchCategory = 'Books';
                break;
            case 'stationery':
                searchCategory = 'Stationery';
                break;
            default:
                searchCategory = category;
        }

        const products = await Product.find({ category: searchCategory });

        res.status(200).json({
            success: true,
            products
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching products by category',
            error: error.message
        });
    }
});


// Create Product Route
app.post('/create-product', async (req, res) => {
    try {
        const productData = req.body;
        const product = new Product(productData);
        const result = await product.save();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating product',
            error: error.message
        });
    }
});

//delete complete product
app.post('/delete-product', async (req, res) => {
    try {
        const { productId } = req.body;

        // Find product by productId
        const product = await Product.findOne({ productId });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        const response = await Product.deleteOne({ productId })
        if (response.deletedCount === 1 && response.acknowledged === true)
            return res.status(200).json({
                success: true,
                message: 'Product deleted successfully',
            });
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: 'Error deleting product',
            error: error.message
        });
    }
});

// Get All Products Route
app.get('/get-product', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json({
            success: true,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
});

// Update Product Visibility Route
app.put('/update-visibility', async (req, res) => {
    try {
        const { productId, visibility } = req.body;

        // Find and update the product, creating visibility field if it doesn't exist
        const updatedProduct = await Product.findOneAndUpdate(
            { productId: productId },
            { $set: { visibility: visibility } },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product visibility updated successfully',
            product: updatedProduct
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating product visibility',
            error: error.message
        });
    }
});

// Get Product by ID Route
app.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error.message
        });
    }
});

// Update Stock Status Route
app.post('/instock-update', async (req, res) => {
    try {
        const { productId, price, name, category, inStockValue, soldStockValue, img, rating, visibility } = req.body;
        // Find and update the product
        const updatedProduct = await Product.findOneAndUpdate(
            { productId: productId }, // Match by productId
            {
                $set: {
                    name: name,
                    price: parseFloat(price || 0).toFixed(2),
                    category: category,
                    inStockValue: Number(inStockValue || 0),
                    soldStockValue: Number(soldStockValue || 0),
                    img: img,
                    rating: Number(rating || 0),
                    visibility: visibility || 'on'
                }
            },
            { new: true, upsert: false } // Return the updated document
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Stock status updated successfully',
            product: updatedProduct // Include updated product in response for verification
        });

    } catch (error) {
        // Log the error
        res.status(500).json({
            success: false,
            message: 'Error updating stock status',
            error: error.message
        });
    }
});

// Delete The Product
app.post('/delete-product', async (req, res) => {
    try {
        const { productId } = req.body;
        // Find and update the product
        const updatedProduct = await Product.deleteOne(
            { productId: productId }, // Match by productId
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product Deleted!',
            product: updatedProduct // Include updated product in response for verification
        });

    } catch (error) {
        // Log the error
        res.status(500).json({
            success: false,
            message: 'Error Deleting Product.',
            error: error.message
        });
    }
});

// Assign Product ID Route
app.get('/assign-productid', async (req, res) => {
    try {
        // Find all products
        const products = await Product.find();

        if (products.length === 0) {
            return res.status(404).send('No products found to assign productIds.');
        }

        // Update each product to add a productId
        const updatedProducts = [];
        const usedIds = new Set(); // Track used IDs to ensure uniqueness

        for (const product of products) {
            let productId;
            // Generate unique 6 digit number
            do {
                productId = Math.floor(100000 + Math.random() * 900000).toString();
            } while (usedIds.has(productId));

            usedIds.add(productId);

            const updateResult = await Product.findOneAndUpdate(
                { _id: product._id },
                { $set: { productId } },
                { new: true }
            );

            if (updateResult) {
                updatedProducts.push(updateResult);
            } else {
                console.error(`Failed to update product with ID: ${product._id}`);
            }
        }

        // Save all updated products
        await Promise.all(updatedProducts.map(product => product.save()));

        res.status(200).json({
            success: true,
            message: 'Product IDs assigned successfully',
            products: updatedProducts
        });
    } catch (err) {
        console.error('Error during product ID assignment:', err);
        res.status(500).json({
            success: false,
            message: 'Error assigning product IDs',
            error: err.message
        });
    }
});
// Address Schema
const addressSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    address: String
});

const Address = mongoose.model('Address', addressSchema);

// Update or Create Address Route
app.post('/update-address', async (req, res) => {
    try {
        const { userId, address } = req.body;

        // Try to find existing address for user
        const existingAddress = await Address.findOne({ userId });

        let result;
        if (existingAddress) {
            // Update existing address
            existingAddress.address = address;
            result = await existingAddress.save();
        } else {
            // Create new address entry
            const newAddress = new Address({
                userId,
                address
            });
            result = await newAddress.save();
        }

        res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            address: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating address',
            error: error.message
        });
    }
});

// Get All Orders Route
app.get('/get-orders', async (req, res) => {
    try {
        const orders = await Order.find();

        res.status(200).json({
            success: true,
            orders
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching orders',
            error: error.message
        });
    }
});

// Get User Details Route
app.get('/get-user', async (req, res) => {
    try {
        const users = await mongoose.model('User').find(
            {}, // Remove filter to get all users
            '-password' // Exclude only the password field
        );

        res.status(200).json({
            success: true,
            users
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user details',
            error: error.message
        });
    }
});

// Update Account Status Route
app.put('/update-account-status', async (req, res) => {
    try {
        const { userId, accountStatus } = req.body;

        // Find and update the user, and get the updated document
        const updatedUser = await mongoose.model('User').findOneAndUpdate(
            { userId: userId },
            { accountStatus },
            { new: true } // This option returns the modified document rather than the original
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Account status updated successfully',
            user: {
                userId: updatedUser.userId,
                accountStatus: updatedUser.accountStatus
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating account status',
            error: error.message
        });
    }
});


// Find My Order Route
app.post('/find-my-order', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Find orders for this user
        const orders = await Order.find({ userId });

        if (!orders || orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No orders found for this user'
            });
        }

        // Function to get product details for each productId
        const findProductDetails = async (productIds) => {
            try {
                const productDetails = [];

                // Make API calls for each productId
                for (const productId of productIds) {
                    try {
                        const product = await Product.findById(productId);
                        if (product) {
                            productDetails.push(product);
                        }
                    } catch (err) {
                        console.error(`Error fetching product ${productId}:`, err);
                    }
                }

                return productDetails;
            } catch (error) {
                throw new Error('Error fetching product details: ' + error.message);
            }
        };

        // Get product details for each order
        const ordersWithProducts = await Promise.all(
            orders.map(async (order) => {
                const productDetails = await findProductDetails(order.productIds);
                return {
                    ...order.toObject(),
                    products: productDetails
                };
            })
        );

        res.status(200).json({
            success: true,
            orders: ordersWithProducts
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error finding orders',
            error: error.message
        });
    }
});

// Get Product by Product ID Route
app.post('/:productId', async (req, res) => {
    try {
        const { productId } = req.body;

        // Find product by productId
        const product = await Product.findOne({ productId });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

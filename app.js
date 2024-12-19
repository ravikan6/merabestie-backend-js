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

const Product = require('./models/product');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require("dotenv")

dotenv.config()

if (!process.env.MONGO_URI) {
    throw new Error("Please Add MONGO_URI in envirement variables...")
}

const app = express();

let origins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
// Middleware
app.use(cors({
    origin: ["https://www.merabestie.com", "*.merabestie.com", ...origins], // Frontend URLs
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(require('cookie-parser')());
app.use(express.urlencoded({ extended: true }));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'pecommerce8@gmail.com', // Replace with your email
        pass: 'rqrdabxuzpaecigz' // Replace with your password
    }
});

app.use(
    session({
        secret: process.env.SECRET,
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
        const { productId, inStockValue, soldStockValue } = req.body;

        // Find and update the product
        const updatedProduct = await Product.findOneAndUpdate(
            { productId: productId },
            {
                $set: {
                    inStockValue: inStockValue,
                    soldStockValue: soldStockValue
                }
            },
            { new: true, upsert: false }
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
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating stock status',
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

// Order Schema
const orderSchema = new mongoose.Schema({
    orderId: String,
    userId: String,
    date: String,
    time: String,
    address: String,
    email: String,
    name: String,
    productIds: [String],
    trackingId: String,
    price: Number,
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending',
    },
    paymentMethod: {
        type: String,
        enum: ['Credit Card', 'Debit Card', 'Net Banking', 'UPI', 'COD'],
        required: false,
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Unpaid', 'Refunded', 'Pending'],
        default: 'Pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
    },
});

orderSchema.pre('save', function (next) {
    if (this.isModified()) {
        this.updatedAt = new Date();
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

app.post('/create-order', async (req, res) => {
    const { amount, currency, userId } = req.body; // Amount in smallest currency unit (e.g., paise for INR)

    try {
        const order = await razorpay.orders.create({
            amount: amount, // e.g., 50000 for ₹500
            currency: currency || 'INR',
            notes: {
                user: userId | null
            }
        });
        res.status(200).json(order);
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

app.post('/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const secret = process.env.RAZORPAY_SECRET; // Replace with your Razorpay Secret

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto.createHmac('sha256', secret)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        // Payment is valid
        res.json({ success: true });
    } else {
        // Payment is invalid
        res.json({ success: false });
    }
});

// Place Order Route
app.post('/place-order', async (req, res) => {
    try {
        const { userId, date, time, address, price, productsOrdered, paymentStatus, status } = req.body;

        // Generate random 6 digit orderId
        const orderId = Math.floor(100000 + Math.random() * 900000).toString();

        // Generate random 12 digit alphanumeric trackingId
        const trackingId = Math.random().toString(36).substring(2, 14).toUpperCase();

        // Find user details
        const findUserDetails = async (userId) => {
            // Use mongoose model directly instead of undefined User
            const user = await mongoose.model('User').findOne({ userId });
            if (!user) {
                throw new Error('User not found');
            }
            return {
                name: user.name,
                email: user.email
            };
        };

        // Extract product IDs
        const getProductIds = (productsOrdered) => {
            return productsOrdered.map(item => item.productId);
        };

        // Find product details
        // const productDetailsFinder = async (productIds) => {
        //   const products = await Product.find({ productId: { $in: productIds } });
        //   return products;
        // };

        // Get user details
        const userDetails = await findUserDetails(userId);

        // Get product IDs array
        const productIds = getProductIds(productsOrdered);

        // Get product details
        // const productDetails = await productDetailsFinder(productIds);
        // Create new order
        const order = new Order({
            userId,
            orderId,
            date,
            time,
            address,
            email: userDetails.email,
            name: userDetails.name,
            productIds,
            trackingId,
            price,
            status: status,
            paymentStatus: paymentStatus
        });

        await order.save();

        // Send confirmation email
        const sendingMail = async () => {
            const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: pink; padding: 20px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: #333; margin: 0;">Mera Bestie</h1>
          </div>
          
          <h2 style="color: #333; text-align: center;">Order Confirmation</h2>
          <p>Dear ${userDetails.name},</p>
          <p>Thank you for your order! Your order has been successfully placed.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Tracking ID:</strong> ${trackingId}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Time:</strong> ${time}</p>
            <p><strong>Delivery Address:</strong> ${address}</p>
          </div>

          <div style="margin-top: 20px; text-align: right;">
            <p><strong>Total Amount:</strong> ₹${price}</p>
          </div>

          <p style="margin-top: 30px;">You can track your order using the tracking ID provided above.</p>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>Your Mera Bestie Team</p>
        </div>
      `;

            await transporter.sendMail({
                from: '"Mera Bestie Support" <pecommerce8@gmail.com>',
                to: userDetails.email,
                subject: `Order Confirmation - Order #${orderId}`,
                html: emailHtml
            });
        };

        await sendingMail();

        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderId,
            trackingId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error placing order',
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

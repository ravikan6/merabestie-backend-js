const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const authRoutes = require('./routes/auth');
const uuid = require('uuid');
const Razorpay = require('razorpay');
const bcrypt = require('bcrypt'); // Added bcrypt import
const crypto = require('crypto');
const Seller = require('./models/seller');
const adminAuthRoutes = require('./routes/adminauth');
const cartRoutes = require('./routes/cart');
const complaintsRoutes = require('./routes/complaints');
const dotenv = require("dotenv")
dotenv.config()

if (!process.env.MONGO_URI) {
  throw new Error("Please Add MONGO_URI in envirement variables...")
}

const app = express();

let origins = process.env.ALLOWD_ORIGINS;
// Middleware
app.use(cors({
  origin: origins?.split(','), // Frontend URLs
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
app.use('/api', adminAuthRoutes);
app.use('/cart', cartRoutes);
app.use('/complaints', complaintsRoutes);

// MongoDB Connection
const uri = process.env.MONGO_URI;
mongoose.connect(uri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  img: String,
  category: String,
  rating: Number,
  productId: { type: String, unique: true }, // Added productId field
  inStockValue: Number, // Available stock value
  soldStockValue: Number, // Number of items sold
  visibility: { type: String, default: 'on' } // Visibility field with default 'on'
});

const Product = mongoose.model('Product', productSchema);


app.get('/', (req, res) => {
  res.status(200).json({
    hello: 'MeraBestie Backend Server @RK'
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

// Complaints Schema

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

const otpStore = new Map();

// Signup Route
app.post('/seller/signup', async (req, res) => {
  try {
    const { phoneNumber, emailId, password } = req.body;

    // Check if seller already exists
    const existingSeller = await Seller.findOne({ email: emailId });
    if (existingSeller) {
      return res.status(400).json({ error: 'Seller already exists' });
    }

    // Generate unique seller ID (MBSLR + 5 digits)
    let sellerId;
    let isUnique = false;
    while (!isUnique) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      sellerId = `MBSLR${randomNum}`;
      const existingId = await Seller.findOne({ sellerId });
      if (!existingId) isUnique = true;
    }

    // Create new seller with required fields from schema
    const seller = new Seller({
      name: 'Not Available',
      email: emailId,
      password: password,
      sellerId: sellerId,
      emailVerified: false,
      phoneVerified: false,
      phoneNumber: phoneNumber,
      businessName: 'Not Available',
      businessAddress: 'Not Available',
      businessType: 'Not Available'
    });

    await seller.save();

    // Store sellerId in session
    req.session.sellerId = sellerId;
    await req.session.save();

    res.status(201).json({
      message: 'Seller registered successfully',
      sellerId
    });

  } catch (err) {
    res.status(500).json({
      error: 'Error registering seller',
      message: err.message
    });
  }
});

// Send OTP Route
app.post('/seller/send-otp', async (req, res) => {
  try {
    const { emailId } = req.body;

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in MongoDB for this seller
    await Seller.findOneAndUpdate(
      { email: emailId },
      { otp: otp }
    );

    // Send OTP email
    const mailOptions = {
      from: '"Mera Bestie Support" <pecommerce8@gmail.com>',
      to: emailId,
      subject: 'Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Mera Bestie Seller Verification</h2>
          <p>Your verification OTP is: <strong>${otp}</strong></p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'OTP sent successfully' });

  } catch (error) {
    res.status(500).json({ error: 'Error sending OTP' });
  }
});

// Verify OTP Route
app.post('/seller/verify-otp', async (req, res) => {
  try {
    const { otp, emailId } = req.body;

    if (!otp || !emailId) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: {
          otp: !otp ? 'OTP is required' : null,
          emailId: !emailId ? 'Email ID is required' : null
        }
      });
    }

    // Get seller and check OTP
    const seller = await Seller.findOne({ email: emailId });

    if (!seller) {
      return res.status(400).json({
        error: 'Seller not found',
        details: `No seller found with email: ${emailId}`
      });
    }

    if (!seller.otp) {
      return res.status(400).json({
        error: 'No OTP found',
        details: 'OTP was not generated or has expired'
      });
    }

    if (seller.otp !== otp) {
      return res.status(400).json({
        error: 'Invalid OTP',
        details: 'The provided OTP does not match'
      });
    }

    // Update verification status and clear OTP
    try {
      await Seller.findOneAndUpdate(
        { email: emailId },
        {
          emailVerified: true,
          phoneVerified: true,
          otp: null
        }
      );
    } catch (updateError) {
      return res.status(500).json({
        error: 'Database update failed',
        details: updateError.message
      });
    }

    res.status(200).json({ message: 'OTP verified successfully' });

  } catch (error) {
    res.status(500).json({
      error: 'Error verifying OTP',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Login Route
app.post('/seller/login', async (req, res) => {
  try {
    const { sellerId, emailOrPhone, password } = req.body;

    // Validate required fields
    if (!sellerId || !emailOrPhone || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Seller ID, email/phone and password are required'
      });
    }

    // Find seller by ID and email/phone
    const seller = await Seller.findOne({
      sellerId,
      $or: [
        { email: emailOrPhone },
        { phoneNumber: emailOrPhone }
      ]
    });

    if (!seller) {
      return res.status(400).json({
        error: 'Invalid credentials',
        details: 'No seller found with provided ID and email/phone'
      });
    }

    // Check if email/phone is verified
    if (!seller.emailVerified && !seller.phoneVerified) {
      return res.status(401).json({
        error: 'Account not verified',
        details: 'Please verify your email or phone number before logging in'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(400).json({
        error: 'Invalid credentials',
        details: 'Incorrect password provided'
      });
    }

    // Store sellerId in session
    req.session.sellerId = sellerId;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      sellerId,
      businessName: seller.businessName
    });

  } catch (error) {
    res.status(500).json({
      error: 'Error logging in',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Logout Route
app.post('/seller/logout', async (req, res) => {
  try {
    const { sellerId } = req.body;

    if (!sellerId) {
      return res.status(400).json({
        error: 'Seller ID is required'
      });
    }

    const seller = await Seller.findOne({ sellerId });

    if (!seller) {
      return res.status(404).json({
        error: 'Seller not found'
      });
    }

    seller.loggedIn = 'loggedout';
    await seller.save();

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Error logging out' });
      }
      res.clearCookie('connect.sid');
      res.json({
        success: true,
        message: 'Seller logged out successfully',
        loggedIn: 'loggedout'
      });
    });

  } catch (error) {
    res.status(500).json({
      error: 'Error logging out',
      details: error.message
    });
  }
});
// Coupon Schema
const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  discountPercentage: {
    type: Number,
    required: true
  }
});

const Coupon = mongoose.model('Coupon', couponSchema);

// Function to send email to all users
async function sendEmailToAllUsers(subject, message) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'pecommerce8@gmail.com', // Replace with your email
        pass: 'rqrdabxuzpaecigz' // Replace with your password
      }
    });

    const users = await mongoose.model('User').find({}, 'email');

    for (const user of users) {
      await transporter.sendMail({
        from: 'pecommerce8@gmail.com',
        to: user.email,
        subject: subject,
        text: message
      });
    }
  } catch (error) {
    console.error('Error sending emails:', error);
  }
}

// Get all coupons route
app.get('/coupon', async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json({
      success: true,
      coupons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching coupons',
      error: error.message
    });
  }
});

// Save coupon route
app.post('/save-coupon', async (req, res) => {
  try {
    const { code, discountPercentage } = req.body;

    const coupon = new Coupon({
      code,
      discountPercentage
    });

    await coupon.save();

    // Send email to all users about new coupon
    const subject = 'New Coupon Available!';
    const message = `A new coupon ${code} is now available with ${discountPercentage}% discount. Use it in your next purchase!`;
    await sendEmailToAllUsers(subject, message);

    res.status(201).json({
      success: true,
      message: 'Coupon saved successfully',
      coupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error saving coupon',
      error: error.message
    });
  }
});

// Verify coupon route
app.post('/verify-coupon', async (req, res) => {
  try {
    const { code } = req.body;

    const coupon = await Coupon.findOne({ code });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    res.status(200).json({
      success: true,
      discountPercentage: coupon.discountPercentage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying coupon',
      error: error.message
    });
  }
});

// Delete coupon route
app.delete('/delete-coupon', async (req, res) => {
  try {
    const { code, discountPercentage } = req.body;

    const deletedCoupon = await Coupon.findOneAndDelete({
      code,
      discountPercentage
    });

    if (!deletedCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Send email to all users about expired coupon
    const subject = 'Coupon Expired';
    const message = `The coupon ${code} with ${discountPercentage}% discount has expired.`;
    await sendEmailToAllUsers(subject, message);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting coupon',
      error: error.message
    });
  }
});

// Verify Seller ID Route
app.post('/verify-seller', async (req, res) => {
  try {
    const { sellerId } = req.body;

    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Seller ID is required'
      });
    }

    // Find seller by sellerId
    const seller = await Seller.findOne({ sellerId });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Invalid seller ID'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Valid seller ID',
      loggedIn: seller.loggedIn
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying seller ID',
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
app.get('/:productId', async (req, res) => {
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

const express = require('express');
const bcrypt = require('bcryptjs'); // Added bcrypt import
const Seller = require('../models/seller'); // Adjust the path to your Seller schema
const router = express.Router();

// Seller Login
router.post('/login', async (req, res) => {
  try {
    const { sellerId, emailOrPhone, password } = req.body;

    // Validate required fields
    if (!sellerId || !emailOrPhone || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Seller ID, email/phone, and password are required'
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
    // if (!seller.emailVerified && !seller.phoneVerified) {
    //   return res.status(401).json({
    //     error: 'Account not verified',
    //     details: 'Please verify your email or phone number before logging in'
    //   });
    // }

    // Verify password
    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(400).json({
        error: 'Invalid credentials',
        details: 'Incorrect password provided'
      });
    }
    // Update loggedIn status
    seller.loggedIn = 'loggedin';
    await seller.save();
    // Store sellerId in session
    req.session.sellerId = sellerId;
    res.status(200).json({
      success: true,
      message: 'Login successful',
      sellerId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error logging in',
      details: error.message
    });
  }
});

// Seller Signup
router.post('/seller/signup', async (req, res) => {
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

router.post('/verify-seller', async (req, res) => {
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

router.post('/logout', async (req, res) => {
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

router.post('/seller/send-otp', async (req, res) => {
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
router.post('/seller/verify-otp', async (req, res) => {
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

module.exports = router;

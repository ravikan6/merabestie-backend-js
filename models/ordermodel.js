const mongoose = require('mongoose');
const crypto = require('crypto');

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

module.exports = Order;